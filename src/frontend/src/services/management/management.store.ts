import type { postWorkspacesWorkspaceRequestBody as CreateWorkspaceBody, patchWorkspacesByIdWorkspaceRequestBody as UpdateWorkspaceBody, postWorkspacesByIdMemberRequestBody as WorkspaceMemberBody, postWorkspacesByIdTransferOwnerRequestBody as WorkspaceTransferBody } from '../../types/services-type/workspaces'
import type { postWorkspacesByWorkspaceIdProjectRequestBody as CreateProjectBody, patchProjectsByIdProjectRequestBody as UpdateProjectBody, postProjectsByIdMemberRequestBody as ProjectMemberBody, patchProjectsByIdAndUserIdMemberRequestBody as UpdateProjectMemberBody, postProjectsByIdTransferOwnerRequestBody as ProjectTransferBody } from '../../types/services-type/projects'
import type { postIssuesReportRequestBody as CreateReportBody } from '../../types/services-type/issues'
import type { patchUsersProfileRequestBody as ProfileBody } from '../../types/services-type/users'
import type { patchUsersPreferencesRequestBody as PreferencesBody } from '../../types/services-type/notifications'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'
import type { ManagementStore, SessionDetail, WorkspaceDetailOverview, WorkspaceOverview } from './management.types'
import { validateCsvFile } from './upload-validation'
import { createAdminService } from './admin.service'
import { createDatasetService } from '../processing/dataset.service'
import { ApiError } from '../../lib/api-error'
import type { Person, PreviewStoreState, PreviewMutationResult, PreviewNotification, PreviewReport, Workspace, Project, DatasetSummary } from '../../types/preview/preview.types'
import { createAnalysisService } from '../processing/analysis.service'

type Member = { userId: string; role: string; email?: string; name?: string; firstName?: string; lastName?: string; joinedAt?: string }
// Hai dạng phân trang cùng tồn tại trong các bản backend: trang-số ({ items, total }) và con trỏ
// ({ items, meta: { hasMore, nextCursor } }). Đọc được cả hai để một bản frontend chạy với cả hai.
type PageResult<T> = { items?: T[]; members?: T[]; total?: number; meta?: { hasMore?: boolean; nextCursor?: string | null } }
type WorkspaceDto = { id: string; name: string; description: string; ownerId: string; members: Member[]; storageUsedBytes: number; createdAt: string; updatedAt: string; lastAccessedAt: string | null; version: number }
type ProjectDto = { id: string; workspaceId: string; name: string; description: string; createdBy: string; members: Member[]; status: string; hasDataset: boolean; createdAt: string; updatedAt: string; version: number }
type DatasetDto = { id: string; originalFileName: string; rowCount: number; columnCount: number; fileSizeBytes: number; createdAt: string; status: string }
const isWorkspaceOverview = (value: unknown): value is WorkspaceOverview => {
  if (typeof value !== 'object' || value === null) return false
  return ['totalWorkspaces', 'totalProjects', 'ownedWorkspaces', 'sharedWorkspaces', 'myProjects']
    .every(key => {
      const count = (value as Record<string, unknown>)[key]
      return typeof count === 'number' && Number.isInteger(count) && count >= 0
    })
}
const isWorkspaceDetailOverview = (value: unknown): value is WorkspaceDetailOverview => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record['workspaceId'] === 'string'
    && ['projectCount', 'notStartedCount', 'inProgressCount', 'completedCount', 'memberCount', 'storageUsedBytes']
      .every(key => {
        const count = record[key]
        return typeof count === 'number' && Number.isFinite(count) && count >= 0
      })
    && (record['lastAccessedAt'] === null || typeof record['lastAccessedAt'] === 'string')
}
const label = (role: string) => role.charAt(0).toUpperCase() + role.slice(1)
// Máy chủ trả ISO; card và tiêu đề chi tiết hiển thị ngày theo vi-VN thay vì chuỗi ISO thô.
const displayDate = (value: string): string => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}
const unsupported = (): Promise<PreviewMutationResult> => Promise.reject(new Error('Chức năng này chưa được kết nối với máy chủ.'))
const saved = (message: string): PreviewMutationResult => ({ message, persisted: true, undo: () => { throw new Error('Thao tác đã được lưu trên máy chủ.') } })

export function createManagementStore(api: ApiClient, account: Person, options: { readSessionId?: () => string | null } = {}) {
  let state: PreviewStoreState = {
    source: 'api', workspaces: [], projects: [], notifications: [], reports: [], sessions: [],
    profile: { name: account.name, email: account.email ?? '', role: account.role, organization: '', phone: '', bio: '' },
    notificationPrefs: { system: false, projects: false, quality: false, workspace: false },
    selection: { workspaceId: '', projectId: '' },
  }
  const listeners = new Set<() => void>()
  const versions = new Map<string, number>()
  const people = new Map<string, Person>([[account.id, account]])
  const issueDrafts = new Map<string, { id: string; attachmentUploaded: boolean }>()
  const drafts = new Map<string, { project: ProjectDto; uploaded: boolean; members: Set<string> }>()
  const inFlight = new Map<string, Promise<PreviewMutationResult>>()
  let revision = 0
  let disposed = false
  let hasProjectIndex = true
  const publish = (next: PreviewStoreState) => { if (!disposed) { state = next; listeners.forEach(fn => fn()) } }
  const request = <T>(path: string, options: Omit<ApiRequestOptions, 'path' | 'auth'> = {}) => api.request<T>({ path, auth: 'session', ...options })
  // Bản backend mới trả firstName/lastName thay vì name đã ghép sẵn.
  const memberName = (m: Member): string =>
    (m.name ?? `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim()) || people.get(m.userId)?.name || m.userId
  const person = (m: Member): Person => ({ ...people.get(m.userId), id: m.userId,
    name: memberName(m),
    initials: memberName(m).slice(0, 2).toUpperCase(),
    ...(m.joinedAt === undefined ? {} : { joinedAt: m.joinedAt }), email: m.email ?? people.get(m.userId)?.email ?? '', role: label(m.role) })
  const email = (p: Person) => { if (!p.email) throw new Error('Máy chủ chưa cung cấp email thành viên này. Vui lòng tải lại danh sách.'); return p.email }
  async function readProjectDataset(projectId: string, signal?: AbortSignal): Promise<DatasetSummary | null> {
    const { dataset } = await request<{ dataset: DatasetDto | null }>(`/projects/${encodeURIComponent(projectId)}/datasets`, signal ? { signal } : {})
    if (!dataset) return null
    return {
      id: dataset.id, fileName: dataset.originalFileName, format: 'CSV', rows: dataset.rowCount, columns: dataset.columnCount,
      sizeMb: dataset.fileSizeBytes / 1048576, importedAt: dataset.createdAt,
      status: dataset.status === 'READY' ? 'processed' : dataset.status === 'FAILED' ? 'failed' : 'processing',
    }
  }
  async function pages<T>(path: string, memberList = false): Promise<T[]> {
    const items: T[] = []
    const seen = new Set<string>()
    let cursor: string | null = null
    for (let page = 1; ; page++) {
      const params: Record<string, string | number> = { limit: 100 }
      if (cursor !== null) params['cursor'] = cursor
      else if (!memberList && (path !== '/projects' || page > 1)) params['page'] = page
      const result = await request<PageResult<T>>(path, { params })
      const rows = result.items ?? (memberList ? result.members : undefined)
      if (!Array.isArray(rows)) throw new Error('Danh sách từ máy chủ không hợp lệ.')
      items.push(...rows)
      // Con trỏ: chỉ dừng khi máy chủ nói hết trang.
      if (typeof result.meta?.hasMore === 'boolean') {
        if (!result.meta.hasMore) return items
        const next = result.meta.nextCursor ?? null
        if (!next || seen.has(next)) throw new Error('Phân trang từ máy chủ không hợp lệ.')
        seen.add(next)
        cursor = next
        continue
      }
      if (memberList) return items
      // Trang số: dừng khi đã gom đủ tổng số bản ghi.
      if (!Number.isFinite(result.total)) throw new Error('Danh sách từ máy chủ không hợp lệ.')
      if (items.length >= (result.total as number)) return items
      if (!rows.length) throw new Error('Phân trang từ máy chủ không đầy đủ.')
    }
  }
  async function load() {
    const current = ++revision
    const rows = await pages<WorkspaceDto>('/workspaces')
    let visibleProjects: ProjectDto[] | undefined
    if (hasProjectIndex) {
      try {
        visibleProjects = await pages<ProjectDto>('/projects')
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error
        hasProjectIndex = false
      }
    }
    const projectsByWorkspace = new Map<string, ProjectDto[]>()
    for (const project of visibleProjects ?? []) {
      const group = projectsByWorkspace.get(project.workspaceId)
      if (group) group.push(project)
      else projectsByWorkspace.set(project.workspaceId, [project])
    }
    const workspaceById = new Map(rows.map(workspace => [workspace.id, workspace]))
    const legacyProjects: ProjectDto[] = []
    const workspaces: Workspace[] = []
    const projects: Project[] = []
    const nextVersions = new Map<string, number>()
    for (const w of rows) {
      const members = (await pages<Member>(`/workspaces/${w.id}/members`, true)).map(person)
      members.forEach(p => people.set(p.id, p))
      const projectRows = visibleProjects
        ? projectsByWorkspace.get(w.id) ?? []
        : await pages<ProjectDto>(`/workspaces/${w.id}/projects`)
      if (!visibleProjects) legacyProjects.push(...projectRows)
      workspaces.push({ canManage: w.ownerId === account.id, id: w.id, name: w.name, description: w.description, status: 'active', currentUserId: account.id,
        projects: projectRows.length, datasets: projectRows.filter(p => p.hasDataset).length, members: members.length,
        storageGb: w.storageUsedBytes / 1073741824, favorite: state.workspaces.find(item => item.id === w.id)?.favorite ?? false, cover: 'blue',
        createdAt: displayDate(w.createdAt), updatedAt: displayDate(w.updatedAt),
        ...(w.lastAccessedAt === null ? {} : { accessedAt: displayDate(w.lastAccessedAt) }),
        owner: members.find(m => m.id === w.ownerId) ?? person({ userId: w.ownerId, role: 'owner' }), memberPreview: members,
        memberRoles: Object.fromEntries(members.map(m => [m.id, m.role])) })
      nextVersions.set(w.id, w.version)
    }
    for (const p of visibleProjects ?? legacyProjects) {
      const workspace = workspaceById.get(p.workspaceId)
      const roster = (await pages<Member>(`/projects/${p.id}/members`, true)).map(person)
      const dataset = p.hasDataset ? await readProjectDataset(p.id) : null
      const projectRole = roster.find(member => member.id === account.id)?.role
      const ownsWorkspace = workspace?.ownerId === account.id
      const canManage = ownsWorkspace || projectRole === 'Owner'
      const canWorkOnProject = canManage || projectRole === 'Member' || account.role === 'admin'
      projects.push({ canManage, canDelete: ownsWorkspace, canUpload: canManage,
        canUpdateDatasetMetadata: canWorkOnProject, canComplete: canWorkOnProject,
        id: p.id, code: p.id.slice(-6).toUpperCase(), name: p.name, description: p.description,
        workspaceId: p.workspaceId, workspaceName: workspace?.name ?? p.workspaceId,
        status: p.status === 'completed' ? 'completed' : p.status === 'in_progress' ? 'processing' : 'active',
        cover: 'blue', dataset, members: roster, owner: roster.find(m => m.role === 'Owner') ?? person({ userId: p.createdBy, role: 'owner' }),
        createdAt: displayDate(p.createdAt), updatedAt: displayDate(p.updatedAt) })
      nextVersions.set(p.id, p.version)
    }
    if (disposed || current !== revision) return
    versions.clear(); nextVersions.forEach((v, k) => versions.set(k, v))
    const workspaceId = workspaces.some(w => w.id === state.selection.workspaceId) ? state.selection.workspaceId : ''
    const projectId = projects.some(p => p.id === state.selection.projectId) ? state.selection.projectId : ''
    publish({ ...state, workspaces, projects, selection: { workspaceId, projectId } })
  }
  async function mutate(path: string, method: NonNullable<ApiRequestOptions['method']>, data?: unknown) {
    await request(path, { method, data, ...(data instanceof FormData ? { timeoutMs: 120000 } : {}) })
    try { await load() } catch { throw new Error('Đã lưu trên máy chủ nhưng chưa tải lại được danh sách. Hãy tải lại trang, không gửi lại thao tác.') }
    return saved('Đã lưu thay đổi trên máy chủ.')
  }
  const issueTypes = { system: 'display_error', feature: 'function_error', data: 'data_error', suggestion: 'feature_feedback', other: 'other' } as const
  type NotificationDto = { id: string; title: string; summary: string | null; type: string; readAt: string | null; createdAt: string; payload?: { targetType?: string; targetId?: string } }
  type IssueDto = { id: string; issueType: string; title: string; description: string; status: string; version?: number; createdAt: string; updatedAt: string; attachments?: { id: string; filename: string; sizeBytes: number }[] }
  const mapIssue = (issue: IssueDto): PreviewReport => {
    const attachment = issue.attachments?.[0]
    return {
      id: issue.id, code: issue.id, title: issue.title, description: issue.description,
      ...(issue.version === undefined ? {} : { version: issue.version }),
      issueType: (Object.keys(issueTypes) as (keyof typeof issueTypes)[]).find(key => issueTypes[key] === issue.issueType) ?? 'other',
      status: issue.status === 'needs_info' ? 'needs-info'
        : issue.status === 'new' || issue.status === 'closed' || issue.status === 'resolved' ? issue.status : 'processing',
      createdAt: new Date(issue.createdAt).toLocaleString('vi-VN'), updatedAt: issue.updatedAt,
      attachment: attachment ? {
        id: attachment.id, name: attachment.filename, sizeLabel: `${Math.ceil(attachment.sizeBytes / 1024)} KB`,
      } : null,
    }
  }
  const publishIssue = (issue: IssueDto) => {
    const detail = mapIssue(issue)
    publish({ ...state, reports: state.reports.map(row => row.id === detail.id && (row.version ?? 0) <= (detail.version ?? 0) ? detail : row) })
  }
  async function cursorPages<T>(path: string): Promise<T[]> {
    const items: T[] = []; let cursor: string | undefined
    const visited = new Set<string>()
    for (;;) {
      const page = await request<{ items: T[]; meta: { hasMore: boolean; nextCursor: string | null } }>(path, { params: { limit: 100, ...(cursor ? { cursor } : {}) } })
      items.push(...page.items)
      if (!page.meta.hasMore) return items
      if (!page.meta.nextCursor || visited.has(page.meta.nextCursor)) throw new Error('Phân trang không hợp lệ.')
      cursor = page.meta.nextCursor; visited.add(cursor)
    }
  }
  async function loadPersonal() {
    const [profile, notifications, reports, unread] = await Promise.all([
      request<{ firstName: string; lastName: string; email: string; role: string; notificationsEnabled: boolean; phone?: string | null; bio?: string | null }>('/users/me'),
      cursorPages<NotificationDto>('/notifications'), cursorPages<IssueDto>('/issues'),
      request<{ unreadCount: number }>('/notifications/unread-count'),
    ])
    if (!Number.isInteger(unread.unreadCount) || unread.unreadCount < 0) throw new Error('Số thông báo chưa đọc từ máy chủ không hợp lệ.')
    const enabled = profile.notificationsEnabled
    publish({ ...state,
      unreadNotificationCount: unread.unreadCount,
      profile: { ...state.profile, name: `${profile.firstName} ${profile.lastName}`.trim(), email: profile.email, role: profile.role,
        phone: profile.phone ?? '', bio: profile.bio ?? '' },
      notificationPrefs: { system: enabled, projects: enabled, quality: enabled, workspace: enabled },
      notifications: notifications.map(n => ({ id: n.id, title: n.title, context: n.summary ?? '', description: n.summary ?? '', tone: 'info', kind: 'system', unread: !n.readAt, at: n.createdAt, atFull: new Date(n.createdAt).toLocaleString('vi-VN'), projectId: n.payload?.targetType === 'project' ? n.payload.targetId ?? null : null })),
      reports: reports.map(mapIssue),
    })
  }
  const projectRole = (role: string) => {
    const value = role.toLowerCase()
    if (value !== 'member' && value !== 'viewer') throw new Error('Project chỉ hỗ trợ vai trò Member hoặc Viewer.')
    return value
  }
  async function loadSessions() {
    const rows = await request<{
      id: string
      device_name?: string | null; user_agent?: string | null; ip_address?: string | null; created_at?: string | null
      deviceName?: string | null; userAgent?: string | null; ipAddress?: string | null; createdAt?: string | null
    }[]>('/auth/sessions')
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row.id !== 'string')) {
      throw new Error('Danh sách phiên đăng nhập từ máy chủ không hợp lệ.')
    }
    const currentId = options.readSessionId?.()
    publish({ ...state, sessions: rows.map(row => {
      const createdAt = row.created_at ?? row.createdAt
      return {
        id: row.id, platform: (row.device_name ?? row.deviceName) || 'Thiết bị không xác định',
        browser: (row.user_agent ?? row.userAgent) || 'Không có thông tin trình duyệt', icon: 'monitor',
        location: 'Máy chủ không cung cấp vị trí', ip: (row.ip_address ?? row.ipAddress) || 'Không có thông tin',
        current: row.id === currentId,
        startedAt: createdAt ? new Date(createdAt).toLocaleString('vi-VN') : 'Không có thông tin',
      }
    }) })
  }
  function requireCurrentSession() {
    const id = options.readSessionId?.()
    if (!id) throw new Error('Không xác định được phiên hiện tại. Vui lòng đăng nhập lại trước khi thu hồi phiên.')
    return id
  }
  const version = (id: string): number => { const value = versions.get(id); if (value === undefined) throw new Error('Hãy tải lại tài nguyên trước khi lưu thay đổi.'); return value }
  const store: ManagementStore = {
    ...(account.role.toLowerCase() === 'admin' ? { adminService: createAdminService(api) } : {}),
    datasetService: createDatasetService(api),
    analysisService: createAnalysisService(api),
    completeProject: id => mutate(`/projects/${encodeURIComponent(id)}/snapshot`, 'PUT', { expectedVersion: version(id) }),
    getWorkspaceOverview: async () => {
      const overview = await request<unknown>('/overview/workspaces')
      if (!isWorkspaceOverview(overview)) throw new Error('Tổng quan workspace từ máy chủ không hợp lệ.')
      return overview
    },
    getWorkspaceDetailOverview: async workspaceId => {
      const overview = await request<unknown>(`/workspaces/${encodeURIComponent(workspaceId)}/overview`)
      if (!isWorkspaceDetailOverview(overview) || overview.workspaceId !== workspaceId) {
        throw new Error('Tổng quan workspace từ máy chủ không hợp lệ.')
      }
      return overview
    },
    refreshProject: async (projectId, signal) => {
      const { project } = await request<{ project: ProjectDto & { workspaceName?: string | null } }>(
        `/projects/${encodeURIComponent(projectId)}`, { signal },
      )
      if (project?.id !== projectId) throw new Error('Chi tiết project từ máy chủ không hợp lệ.')
      const cached = state.projects.find(item => item.id === projectId)
      if (!cached) return
      const dataset = project.hasDataset ? await readProjectDataset(projectId, signal) : null
      if (signal.aborted || disposed || (versions.get(projectId) ?? 0) > project.version) return
      versions.set(projectId, project.version)
      publish({ ...state, projects: state.projects.map(item => item.id === projectId ? {
        ...item, name: project.name, description: project.description, workspaceName: project.workspaceName ?? item.workspaceName,
        status: project.status === 'completed' ? 'completed' : project.status === 'in_progress' ? 'processing' : 'active',
        dataset,
        createdAt: displayDate(project.createdAt), updatedAt: displayDate(project.updatedAt),
      } : item) })
    },
    getSessionDetail: async sessionId => {
      const resource = sessionId === options.readSessionId?.() ? 'me' : encodeURIComponent(sessionId)
      const detail = await request<Record<string, unknown>>(`/auth/sessions/${resource}`)
      if (typeof detail['id'] !== 'string' || detail['id'] !== sessionId
        || typeof detail['is_revoked'] !== 'boolean' || typeof detail['remember_me'] !== 'boolean') {
        throw new Error('Chi tiết phiên từ máy chủ không hợp lệ.')
      }
      const optionalString = (value: unknown): string | null => typeof value === 'string' ? value : null
      const result: SessionDetail = {
        id: detail['id'], deviceName: optionalString(detail['device_name']),
        ipAddress: optionalString(detail['ip_address']), userAgent: optionalString(detail['user_agent']),
        lastUsedAt: optionalString(detail['last_used_at']), expiresAt: optionalString(detail['expires_at']),
        createdAt: optionalString(detail['created_at']), isRevoked: detail['is_revoked'],
        rememberMe: detail['remember_me'],
      }
      return result
    },
    getNotificationDetail: async id => {
      const notification = await request<NotificationDto>(`/notifications/${encodeURIComponent(id)}`)
      const item: PreviewNotification = {
        id: notification.id, title: notification.title, context: notification.summary ?? '',
        description: notification.summary ?? '', tone: 'info', kind: 'system', unread: false,
        at: notification.createdAt, atFull: new Date(notification.createdAt).toLocaleString('vi-VN'),
        projectId: notification.payload?.targetType === 'project' ? notification.payload.targetId ?? null : null,
      }
      const previous = state.notifications.find(row => row.id === id)
      const unreadCount = state.unreadNotificationCount
      publish({
        ...state,
        notifications: state.notifications.map(row => row.id === id ? item : row),
        ...(previous?.unread && unreadCount !== undefined
          ? { unreadNotificationCount: Math.max(0, unreadCount - 1) } : {}),
      })
    },
    getIssueDetail: async id => {
      const issue = await request<IssueDto>(`/issues/${encodeURIComponent(id)}`)
      if (issue?.id !== id) throw new Error('Chi tiết báo cáo từ máy chủ không hợp lệ.')
      publishIssue(issue)
    },
    updateIssue: async (id, input) => {
      const updated = await request<IssueDto>(`/issues/${encodeURIComponent(id)}`, { method: 'PATCH', data: input })
      if (updated?.id !== id) throw new Error('Máy chủ trả về báo cáo không khớp. Hãy mở lại chi tiết để kiểm tra.')
      publishIssue(updated)
    },
    subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn) } }, getState: () => state,
    selectWorkspace: workspaceId => { if (workspaceId && !state.workspaces.some(w => w.id === workspaceId)) return; publish({ ...state, selection: { workspaceId, projectId: '' } }) },
    selectProject: projectId => { const p = state.projects.find(p => p.id === projectId); if (p) publish({ ...state, selection: { workspaceId: p.workspaceId, projectId } }) },
    clearProject: () => publish({ ...state, selection: { ...state.selection, projectId: '' } }),
    touchWorkspace: id => { void request(`/workspaces/${id}`).then(() => publish({ ...state, workspaces: state.workspaces.map(w => w.id === id ? { ...w, accessedAt: new Date().toISOString() } : w) })).catch(() => {}) },
    transferOwner: (kind, id, email) => mutate(`/${kind === 'workspace' ? 'workspaces' : 'projects'}/${id}/transfer-owner`, 'POST', { email, expectedVersion: version(id) } satisfies WorkspaceTransferBody & ProjectTransferBody),
    leaveWorkspace: id => mutate(`/workspaces/${id}/leave`, 'POST'),
    downloadAttachment: (id, attachmentId) => request<Blob>(`/issues/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`, { responseType: 'blob' }),
    uploadDataset: async (id, file) => {
      validateCsvFile(file)
      const form = new FormData(); form.append('file', file)
      return mutate(`/projects/${id}/datasets/upload`, 'POST', form)
    },
    toggleFavorite: id => { publish({ ...state, workspaces: state.workspaces.map(w => w.id === id ? { ...w, favorite: !w.favorite } : w) }); return Promise.resolve(saved('Đã đổi yêu thích trong phiên hiện tại.')) },
    rename: (kind, id, name) => mutate(`/${kind === 'workspace' ? 'workspaces' : 'projects'}/${id}`, 'PATCH', { name, expectedVersion: version(id) } satisfies UpdateWorkspaceBody & UpdateProjectBody),
    updateWorkspace: (id, edit) => mutate(`/workspaces/${id}`, 'PATCH', { ...edit, expectedVersion: version(id) } satisfies UpdateWorkspaceBody),
    remove: (kind, id) => mutate(`/${kind === 'workspace' ? 'workspaces' : 'projects'}/${id}`, 'DELETE'),
    addWorkspaceMember: async ({ workspaceId, person: p }) => mutate(`/workspaces/${workspaceId}/members`, 'POST', { email: email(p), role: 'member' } satisfies WorkspaceMemberBody),
    setWorkspaceMemberRole: unsupported,
    removeWorkspaceMember: (id, userId) => mutate(`/workspaces/${id}/members/${userId}`, 'DELETE'),
    addProjectMember: async ({ projectId, person: p, role }) => mutate(`/projects/${projectId}/members`, 'POST', { email: email(p), role: projectRole(role) } satisfies ProjectMemberBody),
    setProjectMemberRole: async (id, userId, role) => mutate(`/projects/${id}/members/${userId}`, 'PATCH', { role: projectRole(role), expectedVersion: version(id) } satisfies UpdateProjectMemberBody),
    removeProjectMember: (id, userId) => mutate(`/projects/${id}/members/${userId}`, 'DELETE'),
    createWorkspace: async input => {
      input.members.forEach(email)
      const { workspace } = await request<{ workspace: WorkspaceDto }>('/workspaces', { method: 'POST', data: { name: input.name, description: input.description } satisfies CreateWorkspaceBody })
      try {
        for (const p of input.members) await request(`/workspaces/${workspace.id}/members`, { method: 'POST', data: { email: email(p), role: 'member' } satisfies WorkspaceMemberBody })
        await load()
      } catch { await load().catch(() => {}); throw new Error(`Workspace “${input.name}” đã được tạo, nhưng chưa hoàn tất thêm thành viên hoặc tải lại. Mở workspace để kiểm tra, không tạo lại.`) }
      return saved('Đã tạo Workspace.')
    },
    createProject: async input => {
      if (!input.dataset.file) throw new Error('Hãy chọn lại tệp CSV để tải lên máy chủ.')
      validateCsvFile(input.dataset.file)
      input.members.forEach(p => { email(p); projectRole(p.role) })
      const key = `${input.workspaceId}:${input.name.trim().toLowerCase()}`
      let draft = drafts.get(key)
      if (!draft) {
        const { project } = await request<{ project: ProjectDto }>(`/workspaces/${input.workspaceId}/projects`, { method: 'POST', data: { name: input.name, description: input.description } satisfies CreateProjectBody })
        draft = { project, uploaded: false, members: new Set() }; drafts.set(key, draft)
      }
      const { project } = draft
      try {
        const form = new FormData(); form.append('file', input.dataset.file)
        if (!draft.uploaded) { await request(`/projects/${project.id}/datasets/upload`, { method: 'POST', data: form, timeoutMs: 120000 }); draft.uploaded = true }
        for (const p of input.members) { if (draft.members.has(email(p))) continue; await request(`/projects/${project.id}/members`, { method: 'POST', data: { email: email(p), role: projectRole(p.role) } satisfies ProjectMemberBody }); draft.members.add(email(p)) }
        await load()
      } catch { await load().catch(() => {}); throw new Error(`Project “${input.name}” đã được tạo, nhưng tải CSV/thêm thành viên chưa hoàn tất. Mở project để kiểm tra, không tạo lại.`) }
      drafts.delete(key)
      return saved('Đã tạo Project và tải CSV.')
    },
    markNotificationsRead: async ids => {
      for (const id of ids) await request(`/notifications/${id}/read`, { method: 'PATCH' })
      await loadPersonal(); return saved('Đã đánh dấu thông báo đã đọc.')
    },
    removeNotifications: () => Promise.reject(new Error('Máy chủ chưa hỗ trợ xóa thông báo.')),
    markAllNotificationsRead: async () => store.markNotificationsRead(state.notifications.filter(n => n.unread).map(n => n.id)),
    createReport: async input => {
      const file = input.attachment?.file
      if (file && (file.size > 10 * 1024 * 1024 || !['image/png', 'image/jpeg', 'application/pdf'].includes(file.type))) throw new Error('Tệp đính kèm phải là PNG, JPG hoặc PDF, tối đa 10 MB.')
      const key = JSON.stringify([input.issueType, input.title.trim(), input.description.trim()])
      let draft = issueDrafts.get(key)
      if (!draft) { const report = await request<{ id: string }>('/issues', { method: 'POST', data: { issueType: issueTypes[input.issueType], title: input.title.trim(), description: input.description.trim() } satisfies CreateReportBody }); draft = { id: report.id, attachmentUploaded: false }; issueDrafts.set(key, draft) }
      if (file && !draft.attachmentUploaded) {
        const form = new FormData(); form.append('file', file)
        try { await request(`/issues/${draft.id}/attachments`, { method: 'POST', data: form }); draft.attachmentUploaded = true }
        catch { await loadPersonal().catch(() => {}); throw new Error('Báo cáo đã tạo nhưng tệp chưa tải lên được. Thử lại trong hộp thoại này để tiếp tục tải tệp.') }
      }
      await loadPersonal(); issueDrafts.delete(key); return saved('Đã gửi báo cáo sự cố.')
    },
    updateProfile: async edit => {
      const parts = edit.name.trim().split(/\s+/)
      if (parts.length < 2) throw new Error('Vui lòng nhập đầy đủ họ và tên.')
      const data = {
        first_name: parts.slice(0, -1).join(' '), last_name: parts.at(-1) ?? '',
        phone: edit.phone.trim() || null, bio: edit.bio.trim() || null,
      } satisfies ProfileBody
      await request('/users/me', { method: 'PATCH', data })
      await loadPersonal(); return saved('Đã cập nhật hồ sơ cá nhân.')
    },
    loadSessions,
    changePassword: async input => {
      await request('/auth/change-password', { method: 'POST', data: input })
      // A successful password change must not be reported as failed if the follow-up read fails.
      publish({ ...state, sessions: [] })
    },
    revokeSession: async id => {
      if (id === requireCurrentSession()) throw new Error('Hãy dùng Đăng xuất để kết thúc phiên hiện tại.')
      await request(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
      publish({ ...state, sessions: state.sessions.filter(row => row.id !== id) })
      return saved('Đã thu hồi phiên đăng nhập.')
    },
    revokeOtherSessions: async () => {
      const currentId = requireCurrentSession()
      await loadSessions()
      for (const row of [...state.sessions]) {
        if (row.id === currentId) continue
        await request(`/auth/sessions/${encodeURIComponent(row.id)}`, { method: 'DELETE' })
        publish({ ...state, sessions: state.sessions.filter(item => item.id !== row.id) })
      }
      return saved('Đã thu hồi các phiên đăng nhập khác.')
    },
    setNotificationPref: async (_key, value) => {
      await request('/users/me/notification-preferences', { method: 'PATCH', data: { notificationsEnabled: value } satisfies PreferencesBody })
      await loadPersonal(); return saved('Đã lưu tùy chọn thông báo.')
    },
    reset: () => saved('Dữ liệu thật không thể đặt lại bằng dữ liệu mẫu.'), getFixtureSet: () => 'demo',
  }
  const createProject = store.createProject
  store.createProject = input => {
    const key = `${input.workspaceId}:${input.name.trim().toLowerCase()}`
    const pending = inFlight.get(key)
    if (pending) return pending
    const operation = createProject(input).finally(() => inFlight.delete(key))
    inFlight.set(key, operation); return operation
  }
  return { store, load: async () => { await load(); await loadPersonal() }, dispose: () => { disposed = true; revision++; listeners.clear() } }
}
