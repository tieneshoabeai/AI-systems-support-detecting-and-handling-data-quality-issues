import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'
import type { ManagementStore } from './management.types'
import { validateCsvFile } from './upload-validation'
import type { Person, PreviewStoreState, PreviewMutationResult, Workspace, Project, DatasetSummary } from '../../types/preview/preview.types'

type Member = { userId: string; role: string; email?: string; name?: string; joinedAt?: string }
type WorkspaceDto = { id: string; name: string; description: string; ownerId: string; members: Member[]; storageUsedBytes: number; createdAt: string; updatedAt: string; lastAccessedAt: string | null; version: number }
type ProjectDto = { id: string; workspaceId: string; name: string; description: string; createdBy: string; members: Member[]; status: string; hasDataset: boolean; createdAt: string; updatedAt: string; version: number }
type DatasetDto = { id: string; originalFileName: string; rowCount: number; columnCount: number; fileSizeBytes: number; createdAt: string; status: string }
const label = (role: string) => role.charAt(0).toUpperCase() + role.slice(1)
const unsupported = (): Promise<PreviewMutationResult> => Promise.reject(new Error('Chức năng này chưa được kết nối với máy chủ.'))
const saved = (message: string): PreviewMutationResult => ({ message, persisted: true, undo: () => { throw new Error('Thao tác đã được lưu trên máy chủ.') } })

export function createManagementStore(api: ApiClient, account: Person) {
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
  const publish = (next: PreviewStoreState) => { if (!disposed) { state = next; listeners.forEach(fn => fn()) } }
  const request = <T>(path: string, options: Omit<ApiRequestOptions, 'path' | 'auth'> = {}) => api.request<T>({ path, auth: 'session', ...options })
  const person = (m: Member): Person => ({ ...people.get(m.userId), id: m.userId,
    name: m.name ?? people.get(m.userId)?.name ?? m.userId,
    initials: (m.name ?? people.get(m.userId)?.name ?? m.userId).slice(0, 2).toUpperCase(),
    ...(m.joinedAt === undefined ? {} : { joinedAt: m.joinedAt }), email: m.email ?? people.get(m.userId)?.email ?? '', role: label(m.role) })
  const email = (p: Person) => { if (!p.email) throw new Error('Máy chủ chưa cung cấp email thành viên này. Vui lòng tải lại danh sách.'); return p.email }
  async function pages<T>(path: string): Promise<T[]> {
    const items: T[] = []
    for (let page = 1; ; page++) {
      const result = await request<{ items: T[]; total: number }>(path, { params: { page, limit: 100 } })
      if (!Array.isArray(result.items) || !Number.isFinite(result.total)) throw new Error('Danh sách từ máy chủ không hợp lệ.')
      items.push(...result.items)
      if (items.length >= result.total) return items
      if (!result.items.length) throw new Error('Phân trang từ máy chủ không đầy đủ.')
    }
  }
  async function load() {
    const current = ++revision
    const rows = await pages<WorkspaceDto>('/workspaces')
    const workspaces: Workspace[] = []
    const projects: Project[] = []
    const nextVersions = new Map<string, number>()
    for (const w of rows) {
      const memberResult = await request<{ members: Member[] }>(`/workspaces/${w.id}/members`)
      const members = memberResult.members.map(person)
      members.forEach(p => people.set(p.id, p))
      const projectRows = await pages<ProjectDto>(`/workspaces/${w.id}/projects`)
      for (const p of projectRows) {
        const memberResult = await request<{ members: Member[] }>(`/projects/${p.id}/members`)
        let dataset: DatasetSummary | null = null
        if (p.hasDataset) {
          const { dataset: d } = await request<{ dataset: DatasetDto }>(`/projects/${p.id}/datasets`)
          dataset = { id: d.id, fileName: d.originalFileName, format: 'CSV', rows: d.rowCount, columns: d.columnCount,
            sizeMb: d.fileSizeBytes / 1048576, importedAt: d.createdAt, status: d.status === 'READY' ? 'processed' : d.status === 'FAILED' ? 'failed' : 'processing' }
        }
        const roster = memberResult.members.map(person)
        projects.push({ canManage: w.ownerId === account.id || roster.some(m => m.id === account.id && m.role === 'Owner'), canDelete: w.ownerId === account.id, canUpload: w.ownerId === account.id || roster.some(m => m.id === account.id && m.role === 'Owner'), id: p.id, code: p.id.slice(-6).toUpperCase(), name: p.name, description: p.description,
          workspaceId: w.id, workspaceName: w.name, status: p.status === 'completed' ? 'completed' : p.status === 'in_progress' ? 'processing' : 'active',
          cover: 'blue', dataset, members: roster, owner: roster.find(m => m.role === 'Owner') ?? person({ userId: p.createdBy, role: 'owner' }), createdAt: p.createdAt, updatedAt: p.updatedAt })
        nextVersions.set(p.id, p.version)
      }
      workspaces.push({ canManage: w.ownerId === account.id, id: w.id, name: w.name, description: w.description, status: 'active', currentUserId: account.id,
        projects: projectRows.length, datasets: projectRows.filter(p => p.hasDataset).length, members: members.length,
        storageGb: w.storageUsedBytes / 1073741824, favorite: state.workspaces.find(item => item.id === w.id)?.favorite ?? false, cover: 'blue',
        createdAt: w.createdAt, updatedAt: w.updatedAt, ...(w.lastAccessedAt === null ? {} : { accessedAt: w.lastAccessedAt }),
        owner: members.find(m => m.id === w.ownerId) ?? person({ userId: w.ownerId, role: 'owner' }), memberPreview: members,
        memberRoles: Object.fromEntries(members.map(m => [m.id, m.role])) })
      nextVersions.set(w.id, w.version)
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
  const issueTypes = { system: 'display_error', feature: 'function_error', data: 'data_error', suggestion: 'feature_feedback', other: 'other' }
  type NotificationDto = { id: string; title: string; summary: string | null; type: string; readAt: string | null; createdAt: string; payload?: { targetType?: string; targetId?: string } }
  type IssueDto = { id: string; issueType: string; title: string; description: string; status: string; createdAt: string; updatedAt: string; attachments?: { id: string; filename: string; sizeBytes: number }[] }
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
    const [profile, notifications, reports] = await Promise.all([
      request<{ firstName: string; lastName: string; email: string; role: string; notificationsEnabled: boolean }>('/users/me'),
      cursorPages<NotificationDto>('/notifications'), cursorPages<IssueDto>('/issues'),
    ])
    const enabled = profile.notificationsEnabled
    publish({ ...state,
      profile: { ...state.profile, name: `${profile.firstName} ${profile.lastName}`.trim(), email: profile.email, role: profile.role },
      notificationPrefs: { system: enabled, projects: enabled, quality: enabled, workspace: enabled },
      notifications: notifications.map(n => ({ id: n.id, title: n.title, context: n.summary ?? '', description: n.summary ?? '', tone: 'info', kind: 'system', unread: !n.readAt, at: n.createdAt, atFull: new Date(n.createdAt).toLocaleString('vi-VN'), projectId: n.payload?.targetType === 'project' ? n.payload.targetId ?? null : null })),
      reports: reports.map(r => ({ id: r.id, code: r.id, title: r.title, description: r.description,
        issueType: (Object.keys(issueTypes) as (keyof typeof issueTypes)[]).find(k => issueTypes[k] === r.issueType) ?? 'other',
        status: r.status === 'new' ? 'new' : r.status === 'closed' ? 'closed' : r.status === 'resolved' ? 'resolved' : 'processing',
        createdAt: new Date(r.createdAt).toLocaleString('vi-VN'), updatedAt: r.updatedAt,
        attachment: r.attachments?.[0] ? { id: r.attachments[0].id, name: r.attachments[0].filename, sizeLabel: `${Math.ceil(r.attachments[0].sizeBytes / 1024)} KB` } : null })),
    })
  }
  const projectRole = (role: string) => {
    const value = role.toLowerCase()
    if (value !== 'member' && value !== 'viewer') throw new Error('Project chỉ hỗ trợ vai trò Member hoặc Viewer.')
    return value
  }
  const store: ManagementStore = {
    subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn) } }, getState: () => state,
    selectWorkspace: workspaceId => { if (workspaceId && !state.workspaces.some(w => w.id === workspaceId)) return; publish({ ...state, selection: { workspaceId, projectId: '' } }) },
    selectProject: projectId => { const p = state.projects.find(p => p.id === projectId); if (p) publish({ ...state, selection: { workspaceId: p.workspaceId, projectId } }) },
    clearProject: () => publish({ ...state, selection: { ...state.selection, projectId: '' } }),
    touchWorkspace: id => { void request(`/workspaces/${id}`).then(() => publish({ ...state, workspaces: state.workspaces.map(w => w.id === id ? { ...w, accessedAt: new Date().toISOString() } : w) })).catch(() => {}) },
    transferOwner: (kind, id, email) => mutate(`/${kind === 'workspace' ? 'workspaces' : 'projects'}/${id}/transfer-owner`, 'POST', { email, expectedVersion: versions.get(id) }),
    leaveWorkspace: id => mutate(`/workspaces/${id}/leave`, 'POST'),
    downloadAttachment: (id, attachmentId) => request<Blob>(`/issues/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`, { responseType: 'blob' }),
    uploadDataset: async (id, file) => {
      validateCsvFile(file)
      const form = new FormData(); form.append('file', file)
      return mutate(`/projects/${id}/datasets/upload`, 'POST', form)
    },
    toggleFavorite: id => { publish({ ...state, workspaces: state.workspaces.map(w => w.id === id ? { ...w, favorite: !w.favorite } : w) }); return Promise.resolve(saved('Đã đổi yêu thích trong phiên hiện tại.')) },
    rename: (kind, id, name) => mutate(`/${kind === 'workspace' ? 'workspaces' : 'projects'}/${id}`, 'PATCH', { name, expectedVersion: versions.get(id) }),
    updateWorkspace: (id, edit) => mutate(`/workspaces/${id}`, 'PATCH', { ...edit, expectedVersion: versions.get(id) }),
    remove: (kind, id) => mutate(`/${kind === 'workspace' ? 'workspaces' : 'projects'}/${id}`, 'DELETE'),
    addWorkspaceMember: async ({ workspaceId, person: p }) => mutate(`/workspaces/${workspaceId}/members`, 'POST', { email: email(p), role: 'member' }),
    setWorkspaceMemberRole: unsupported,
    removeWorkspaceMember: (id, userId) => mutate(`/workspaces/${id}/members/${userId}`, 'DELETE'),
    addProjectMember: async ({ projectId, person: p, role }) => mutate(`/projects/${projectId}/members`, 'POST', { email: email(p), role: projectRole(role) }),
    setProjectMemberRole: async (id, userId, role) => mutate(`/projects/${id}/members/${userId}`, 'PATCH', { role: projectRole(role), expectedVersion: versions.get(id) }),
    removeProjectMember: (id, userId) => mutate(`/projects/${id}/members/${userId}`, 'DELETE'),
    createWorkspace: async input => {
      input.members.forEach(email)
      const { workspace } = await request<{ workspace: WorkspaceDto }>('/workspaces', { method: 'POST', data: { name: input.name, description: input.description } })
      try {
        for (const p of input.members) await request(`/workspaces/${workspace.id}/members`, { method: 'POST', data: { email: email(p), role: 'member' } })
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
        const { project } = await request<{ project: ProjectDto }>(`/workspaces/${input.workspaceId}/projects`, { method: 'POST', data: { name: input.name, description: input.description } })
        draft = { project, uploaded: false, members: new Set() }; drafts.set(key, draft)
      }
      const { project } = draft
      try {
        const form = new FormData(); form.append('file', input.dataset.file)
        if (!draft.uploaded) { await request(`/projects/${project.id}/datasets/upload`, { method: 'POST', data: form, timeoutMs: 120000 }); draft.uploaded = true }
        for (const p of input.members) { if (draft.members.has(email(p))) continue; await request(`/projects/${project.id}/members`, { method: 'POST', data: { email: email(p), role: projectRole(p.role) } }); draft.members.add(email(p)) }
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
      if (!draft) { const report = await request<{ id: string }>('/issues', { method: 'POST', data: { issueType: issueTypes[input.issueType], title: input.title.trim(), description: input.description.trim() } }); draft = { id: report.id, attachmentUploaded: false }; issueDrafts.set(key, draft) }
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
      await request('/users/me', { method: 'PATCH', data: { first_name: parts.slice(0, -1).join(' ') || parts[0], last_name: parts.length > 1 ? parts.at(-1) : parts[0] } })
      await loadPersonal(); return saved('Đã cập nhật họ tên.')
    },
    revokeSession: unsupported, revokeOtherSessions: unsupported,
    setNotificationPref: async (_key, value) => {
      await request('/users/me/notification-preferences', { method: 'PATCH', data: { notificationsEnabled: value } })
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
