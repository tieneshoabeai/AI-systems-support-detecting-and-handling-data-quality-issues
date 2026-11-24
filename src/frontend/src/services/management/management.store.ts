import type { postWorkspacesWorkspaceRequestBody as CreateWorkspaceBody, patchWorkspacesByIdWorkspaceRequestBody as UpdateWorkspaceBody, postWorkspacesByIdMemberRequestBody as WorkspaceMemberBody, postWorkspacesByIdTransferOwnerRequestBody as WorkspaceTransferBody } from '../../types/services-type/workspaces'
import type { postWorkspacesByWorkspaceIdProjectRequestBody as CreateProjectBody, patchProjectsByIdProjectRequestBody as UpdateProjectBody, postProjectsByIdMemberRequestBody as ProjectMemberBody, patchProjectsByIdAndUserIdMemberRequestBody as UpdateProjectMemberBody, postProjectsByIdTransferOwnerRequestBody as ProjectTransferBody } from '../../types/services-type/projects'
import type { postIssuesReportRequestBody as CreateReportBody } from '../../types/services-type/issues'
import type { patchUsersProfileRequestBody as ProfileBody } from '../../types/services-type/users'
import type { patchUsersPreferencesRequestBody as PreferencesBody } from '../../types/services-type/notifications'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'
import type { ManagementStore, WorkspaceDetailOverview, WorkspaceOverview } from './management.types'
import { validateCsvFile } from './upload-validation'
import { createAdminService } from './admin.service'
import { createDatasetService } from '../processing/dataset.service'
import { createAnalysisService } from '../processing/analysis.service'
import { listRecentProjects } from '../processing/recent-projects.service'
import { ApiError, isRecord, normalizeApiError } from '../../lib/api-error'
import { mapSessionDetail } from './session.mapper'
import type { Person, PreviewStoreState, PreviewMutationResult, PreviewNotification, PreviewReport, Workspace, Project, DatasetSummary } from '../../types/preview/preview.types'

type Member = { userId: string; role: string; email?: string | null; name?: string; firstName?: string | null; lastName?: string | null; joinedAt?: string }
// Hai dạng phân trang cùng tồn tại trong các bản backend: trang-số ({ items, total }) và con trỏ
// ({ items, meta: { hasMore, nextCursor } }). Đọc được cả hai để một bản frontend chạy với cả hai.
type PageResult<T> = { items?: T[]; total?: number; meta?: { hasMore?: boolean; nextCursor?: string | null } }
// Danh sách thành viên cũng có hai hình dạng: { members, total } và { items, meta }.
type MembersResult = { members?: Member[]; items?: Member[]; meta?: { hasMore: boolean; nextCursor: string | null } }
const memberRows = (result: MembersResult): Member[] => {
  const rows = result.members ?? result.items
  if (!Array.isArray(rows) || rows.some(row => !isRecord(row) || typeof row['userId'] !== 'string'
    || !row['userId'] || !['owner', 'member', 'viewer'].includes(String(row['role'])))) {
    throw new ApiError({ kind: 'invalid-response', message: 'Danh sách thành viên từ máy chủ không hợp lệ.' })
  }
  return rows
}
type WorkspaceDto = { id: string; name: string; description: string; ownerId: string; members: Member[]; storageUsedBytes: number; createdAt: string; updatedAt: string; lastAccessedAt: string | null; version: number }
type ProjectDto = { id: string; workspaceId: string; workspaceName?: string | null; name: string; description: string; createdBy: string; members: Member[]; status: string; hasDataset: boolean; createdAt: string; updatedAt: string; version: number }
type DatasetDto = { id: string; originalFileName: string; rowCount: number; columnCount: number; fileSizeBytes: number; createdAt: string; status: string }
function validateWorkspace(value: unknown): asserts value is WorkspaceDto {
  if (!isRecord(value) || !['id', 'name', 'description', 'ownerId', 'createdAt', 'updatedAt'].every(key => typeof value[key] === 'string')
    || !Array.isArray(value['members']) || !Number.isInteger(value['version']) || (value['version'] as number) < 1
    || typeof value['storageUsedBytes'] !== 'number' || !Number.isFinite(value['storageUsedBytes']) || value['storageUsedBytes'] < 0
    || (value['lastAccessedAt'] !== null && typeof value['lastAccessedAt'] !== 'string')) {
    throw new ApiError({ kind: 'invalid-response', message: 'Thông tin workspace từ máy chủ không hợp lệ.' })
  }
}
function validateProject(value: unknown): asserts value is ProjectDto {
  if (!isRecord(value) || !['id', 'workspaceId', 'name', 'description', 'createdBy', 'createdAt', 'updatedAt'].every(key => typeof value[key] === 'string')
    || !Array.isArray(value['members']) || !Number.isInteger(value['version']) || (value['version'] as number) < 1
    || typeof value['hasDataset'] !== 'boolean' || !['not_started', 'in_progress', 'completed'].includes(String(value['status']))) {
    throw new ApiError({ kind: 'invalid-response', message: 'Thông tin project từ máy chủ không hợp lệ.' })
  }
}
const WORKSPACE_CONCURRENCY = 3
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

export function createManagementStore(api: ApiClient, account: Person, options: {
  readSessionId?: () => string | null; projectId?: string; signal?: AbortSignal; recent?: boolean; progressiveProjects?: boolean
} = {}) {
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
  let workspaceLoad: AbortController | undefined
  let cardSources = new Map<string, { project: ProjectDto; workspace?: WorkspaceDto }>()
  let cardRevision = new AbortController()
  const lifecycle = new AbortController()
  const ensureActive = () => {
    if (disposed || options.signal?.aborted) throw new ApiError({ kind: 'cancelled', message: 'Phiên dữ liệu đã kết thúc. Thao tác cũ không được tiếp tục.' })
  }
  const sessionApi: ApiClient = {
    async request<T>(requestOptions: ApiRequestOptions): Promise<T> {
      ensureActive()
      const signals = [lifecycle.signal, ...(options.signal ? [options.signal] : []), ...(requestOptions.signal ? [requestOptions.signal] : [])]
      const value = await api.request<T>({ ...requestOptions, signal: AbortSignal.any(signals) })
      ensureActive()
      return value
    },
  }
  const publish = (next: PreviewStoreState) => { if (!disposed) { state = next; listeners.forEach(fn => fn()) } }
  const request = <T>(path: string, requestOptions: Omit<Exclude<ApiRequestOptions, { includeStatus: true }>, 'path' | 'auth'> = {}) =>
    sessionApi.request<T>({ path, auth: 'session', ...requestOptions })
  async function loadMembers(path: string, signal: AbortSignal): Promise<Member[]> {
    const all: Member[] = []
    const visited = new Set<string>()
    let cursor: string | undefined
    for (;;) {
      const result = await request<MembersResult>(path, { signal, params: { limit: 100, ...(cursor ? { cursor } : {}) } })
      if (!isRecord(result)) throw new ApiError({ kind: 'invalid-response', message: 'Danh sách thành viên từ máy chủ không hợp lệ.' })
      all.push(...memberRows(result))
      if (result.meta === undefined) return all // Earlier backend responses used { members, total }.
      const meta = result.meta
      if (!isRecord(meta) || typeof meta.hasMore !== 'boolean' || (meta.nextCursor !== null && typeof meta.nextCursor !== 'string')) {
        throw new ApiError({ kind: 'invalid-response', message: 'Phân trang thành viên không hợp lệ.' })
      }
      if (!meta.hasMore) return all
      if (!meta.nextCursor || visited.has(meta.nextCursor)) throw new ApiError({ kind: 'invalid-response', message: 'Con trỏ thành viên bị thiếu hoặc lặp lại.' })
      cursor = meta.nextCursor
      visited.add(cursor)
    }
  }
  // Bản backend mới trả firstName/lastName thay vì name đã ghép sẵn.
  const memberName = (m: Member): string =>
    (m.name ?? `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim()) || people.get(m.userId)?.name || m.userId
  const person = (m: Member): Person => ({ ...people.get(m.userId), id: m.userId,
    name: memberName(m),
    initials: memberName(m).slice(0, 2).toUpperCase(),
    ...(m.joinedAt === undefined ? {} : { joinedAt: m.joinedAt }), email: m.email ?? people.get(m.userId)?.email ?? '', role: label(m.role) })
  const email = (p: Person) => { if (!p.email) throw new Error('Máy chủ chưa cung cấp email thành viên này. Vui lòng tải lại danh sách.'); return p.email }
  const projectModel = (p: ProjectDto, w: WorkspaceDto | undefined, members: Member[], dataset: Project['dataset']): Project => {
    const roster = members.map(person)
    const ownsWorkspace = w?.ownerId === account.id
    const canManage = ownsWorkspace || roster.some(m => m.id === account.id && m.role === 'Owner')
    const canWorkOnProject = canManage || roster.some(m => m.id === account.id && m.role === 'Member') || account.role.toLowerCase() === 'admin'
    return { canManage, canDelete: ownsWorkspace, canUpload: canManage,
      canUpdateDatasetMetadata: canWorkOnProject, canComplete: canWorkOnProject, id: p.id, code: p.id.slice(-6).toUpperCase(), name: p.name,
      description: p.description, workspaceId: p.workspaceId, workspaceName: w?.name ?? p.workspaceId,
      status: p.status === 'completed' ? 'completed' : p.status === 'in_progress' ? 'processing' : 'active',
      cover: 'blue', dataset, members: roster, owner: roster.find(m => m.role === 'Owner') ?? person({ userId: p.createdBy, role: 'owner' }),
      createdAt: displayDate(p.createdAt), updatedAt: displayDate(p.updatedAt) }
  }
  async function loadDataset(project: ProjectDto, signal?: AbortSignal): Promise<DatasetSummary | null> {
    if (!project.hasDataset) return null
    return requestProjectDataset(project.id, signal)
  }
  async function requestProjectDataset(id: string, signal?: AbortSignal): Promise<DatasetSummary | null> {
    const response = await request<unknown>(`/projects/${encodeURIComponent(id)}/datasets`, signal ? { signal } : {})
    if (!isRecord(response)) throw new ApiError({ kind: 'invalid-response', message: 'Thông tin dataset từ máy chủ không hợp lệ.' })
    if (response['dataset'] === null) return null
    const dataset = response['dataset']
    if (!isRecord(dataset) || !['id', 'originalFileName', 'createdAt'].every(key => typeof dataset[key] === 'string')
      || !['rowCount', 'columnCount', 'fileSizeBytes'].every(key => typeof dataset[key] === 'number' && Number.isFinite(dataset[key]) && dataset[key] >= 0)
      || !['INGESTING', 'READY', 'FAILED'].includes(String(dataset['status']))) {
      throw new ApiError({ kind: 'invalid-response', message: 'Thông tin dataset từ máy chủ không hợp lệ.' })
    }
    const checked = dataset as DatasetDto
    return { id: checked.id, fileName: checked.originalFileName, format: 'CSV', rows: checked.rowCount, columns: checked.columnCount,
      sizeMb: checked.fileSizeBytes / 1048576, importedAt: checked.createdAt,
      status: checked.status === 'READY' ? 'processed' : checked.status === 'FAILED' ? 'failed' : 'processing' }
  }
  async function loadProject(id: string, onProjectSummary?: () => void) {
    const current = ++revision
    const requestOptions = options.signal ? { signal: options.signal } : {}
    const projectRequest = request<{ project: ProjectDto }>(`/projects/${encodeURIComponent(id)}`, requestOptions)
    // Observe the speculative request even if Project fails or has no dataset.
    const datasetRequest = requestProjectDataset(id, options.signal).then(
      value => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    )
    const { project } = await projectRequest
    validateProject(project)
    if (project?.id !== id || !project.workspaceId || !Array.isArray(project.members)) {
      throw new Error('Thông tin project từ máy chủ không hợp lệ.')
    }
    if (disposed || current !== revision) return
    const workspaceRequest = request<{ workspace: WorkspaceDto }>(`/workspaces/${encodeURIComponent(project.workspaceId)}`, requestOptions).then(
      value => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    )
    const datasetResult = project.hasDataset ? await datasetRequest : { ok: true as const, value: null }
    const missingResource = (error: unknown) => normalizeApiError(error).status === 404
      ? new Error('Không tìm thấy workspace hoặc dataset của project.') : error
    if (!datasetResult.ok) throw missingResource(datasetResult.error)
    if (disposed || current !== revision) return
    const selection = { workspaceId: project.workspaceId, projectId: project.id }
    if (onProjectSummary) {
      const summary = projectModel(project, undefined, project.members, datasetResult.value)
      publish({ ...state, selection, projects: [{
        ...summary,
        workspaceName: typeof project.workspaceName === 'string' && project.workspaceName.trim() ? project.workspaceName : summary.workspaceName,
        canManage: false, canDelete: false, canUpload: false, canUpdateDatasetMetadata: false, canComplete: false,
      }] })
      onProjectSummary()
    }
    const workspaceResult = await workspaceRequest
    if (disposed || current !== revision) return
    if (!workspaceResult.ok) throw missingResource(workspaceResult.error)
    const { workspace } = workspaceResult.value
    validateWorkspace(workspace)
    if (workspace?.id !== project.workspaceId) throw new Error('Thông tin workspace của project không hợp lệ.')
    versions.set(project.id, project.version)
    publish({ ...state, selection, projects: [projectModel(project, workspace, project.members, datasetResult.value)] })
  }
  async function pages<T>(path: string, signal: AbortSignal): Promise<T[]> {
    const items: T[] = []
    const seen = new Set<string>()
    let cursor: string | null = null
    for (let page = 1; ; page++) {
      signal.throwIfAborted()
      const params: Record<string, string | number> = cursor !== null ? { cursor, limit: 100 }
        : path === '/projects' && page === 1 ? { limit: 100 } : { page, limit: 100 }
      const result = await request<PageResult<T>>(path, { params, signal })
      if (!isRecord(result) || !Array.isArray(result.items)) throw new ApiError({ kind: 'invalid-response', message: 'Danh sách từ máy chủ không hợp lệ.' })
      items.push(...result.items)
      // Con trỏ: chỉ dừng khi máy chủ nói hết trang.
      if (typeof result.meta?.hasMore === 'boolean') {
        if (!result.meta.hasMore) return items
        const next = result.meta.nextCursor ?? null
        if (!next || seen.has(next)) throw new Error('Phân trang từ máy chủ không hợp lệ.')
        seen.add(next)
        cursor = next
        continue
      }
      // Trang số: dừng khi đã gom đủ tổng số bản ghi.
      if (!Number.isFinite(result.total)) throw new Error('Danh sách từ máy chủ không hợp lệ.')
      if (items.length >= (result.total as number)) return items
      if (!result.items.length) throw new Error('Phân trang từ máy chủ không đầy đủ.')
    }
  }
  async function load(onProjectSummary?: () => void) {
    if (options.projectId) return loadProject(options.projectId, onProjectSummary)
    if (disposed) return
    const current = ++revision
    workspaceLoad?.abort()
    const controller = new AbortController()
    workspaceLoad = controller
    try {
      return await loadWorkspaces(current, controller.signal)
    } catch (error) {
      if (controller.signal.aborted) return
      controller.abort()
      throw error
    } finally {
      if (workspaceLoad === controller) workspaceLoad = undefined
    }
  }
  async function loadProjectResources(project: ProjectDto, signal: AbortSignal) {
    validateProject(project)
    signal.throwIfAborted()
    const [members, dataset] = await Promise.all([
      loadMembers(`/projects/${project.id}/members`, signal),
      loadDataset(project, signal),
    ])
    return { project, members, dataset }
  }
  async function loadWorkspace(w: WorkspaceDto, signal: AbortSignal, indexedProjects?: ProjectDto[]) {
    validateWorkspace(w)
    const workspacePath = `/workspaces/${w.id}`
    const [members, projectRows] = await Promise.all([
      loadMembers(`${workspacePath}/members`, signal),
      indexedProjects ?? pages<ProjectDto>(`${workspacePath}/projects`, signal),
    ])
    const projects = []
    for (const project of projectRows) {
      projects.push(await loadProjectResources(project, signal))
    }
    return { workspace: w, members, projects }
  }
  async function loadProjectCards(current: number, signal: AbortSignal, rows: WorkspaceDto[], index: ProjectDto[] | null) {
    const rowsById = new Map(rows.map(workspace => {
      validateWorkspace(workspace)
      return [workspace.id, workspace] as const
    }))
    const fallback = new Map<string, ProjectDto[]>()
    if (index === null) {
      const queue = rows.values()
      await Promise.all(Array.from({ length: Math.min(WORKSPACE_CONCURRENCY, rows.length) }, async () => {
        for (const workspace of queue) {
          fallback.set(workspace.id, await pages<ProjectDto>(`/workspaces/${workspace.id}/projects`, signal))
        }
      }))
    }
    if (signal.aborted || disposed || current !== revision) return
    const projectRows = index ?? rows.flatMap(workspace => fallback.get(workspace.id) ?? [])
    const counts = new Map<string, { projects: number; datasets: number }>()
    const sources = new Map<string, { project: ProjectDto; workspace?: WorkspaceDto }>()
    const nextVersions = new Map<string, number>()
    const workspaces = rows.map((workspace): Workspace => {
      const members = memberRows({ members: workspace.members }).map(person)
      members.forEach(member => people.set(member.id, member))
      nextVersions.set(workspace.id, workspace.version)
      return {
        id: workspace.id, name: workspace.name, description: workspace.description,
        canManage: workspace.ownerId === account.id, currentUserId: account.id, status: 'active',
        projects: 0, datasets: 0, members: members.length, cover: 'blue',
        storageGb: workspace.storageUsedBytes / 1073741824,
        favorite: state.workspaces.find(item => item.id === workspace.id)?.favorite ?? false,
        createdAt: displayDate(workspace.createdAt), updatedAt: displayDate(workspace.updatedAt),
        ...(workspace.lastAccessedAt === null ? {} : { accessedAt: displayDate(workspace.lastAccessedAt) }),
        owner: members.find(member => member.id === workspace.ownerId) ?? person({ userId: workspace.ownerId, role: 'owner' }),
        memberPreview: members, memberRoles: Object.fromEntries(members.map(member => [member.id, member.role])),
      }
    })
    const projects = projectRows.map((project): Project => {
      validateProject(project)
      const workspace = rowsById.get(project.workspaceId)
      const count = counts.get(project.workspaceId) ?? { projects: 0, datasets: 0 }
      count.projects++
      if (project.hasDataset) count.datasets++
      counts.set(project.workspaceId, count)
      sources.set(project.id, { project, ...(workspace ? { workspace } : {}) })
      nextVersions.set(project.id, project.version)
      return {
        ...projectModel(project, workspace, memberRows({ members: project.members }), project.hasDataset ? undefined : null),
        canManage: false, canDelete: false, canUpload: false, canUpdateDatasetMetadata: false, canComplete: false,
        supplementary: { revision: current, hasDataset: project.hasDataset, dataset: project.hasDataset ? 'idle' : 'success', members: 'idle' },
      }
    })
    cardRevision.abort()
    cardRevision = new AbortController()
    cardSources = sources
    versions.clear()
    nextVersions.forEach((version, id) => versions.set(id, version))
    publish({
      ...state,
      workspaces: workspaces.map(workspace => ({ ...workspace, ...counts.get(workspace.id) })),
      projects,
      selection: {
        workspaceId: rowsById.has(state.selection.workspaceId) ? state.selection.workspaceId : '',
        projectId: sources.has(state.selection.projectId) ? state.selection.projectId : '',
      },
    })
    return current
  }

  async function loadCardData(ids: readonly string[], field: 'dataset' | 'members', signal: AbortSignal, retry = false) {
    const scope = AbortSignal.any([signal, cardRevision.signal, lifecycle.signal])
    const queue = ids.values()
    const worker = async () => {
      for (const id of queue) {
        if (scope.aborted || disposed) return
        const source = cardSources.get(id)
        const row = state.projects.find(project => project.id === id)
        if (!source || !row?.supplementary || row.supplementary[field] !== (retry ? 'error' : 'idle')) continue
        const update = (status: NonNullable<Project['supplementary']>['dataset'], patch: Partial<Project> = {}) => {
          if (cardSources.get(id) !== source || disposed || !state.projects.some(project => project.id === id)) return
          publish({ ...state, projects: state.projects.map(project => project.id === id && project.supplementary
            ? { ...project, ...patch, supplementary: { ...project.supplementary, [field]: status } } : project) })
        }
        update('loading')
        // Clear the pending state synchronously when leaving the visible page or workspace.
        // The old result is ignored even if the transport resolves after cancellation.
        const reset = () => update('idle')
        scope.addEventListener('abort', reset, { once: true })
        try {
          if (field === 'dataset') {
            const dataset = await loadDataset(source.project, scope)
            if (!scope.aborted) update('success', { dataset })
          } else {
            const members = await loadMembers(`/projects/${encodeURIComponent(id)}/members`, scope)
            const model = projectModel(source.project, source.workspace, members, undefined)
            if (!scope.aborted) update('success', {
              members: model.members, owner: model.owner, canManage: model.canManage === true,
              canDelete: model.canDelete === true, canUpload: model.canUpload === true,
              canUpdateDatasetMetadata: model.canUpdateDatasetMetadata === true, canComplete: model.canComplete === true,
            })
          }
        } catch {
          if (!scope.aborted) update('error')
        } finally {
          scope.removeEventListener('abort', reset)
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(WORKSPACE_CONCURRENCY, ids.length) }, worker))
  }

  async function loadWorkspaces(current: number, signal: AbortSignal) {
    const rows = await pages<WorkspaceDto>('/workspaces', signal)
    const projectIndex = await pages<ProjectDto>('/projects', signal).catch((error: unknown) => {
      if (normalizeApiError(error).status === 404) return null
      throw error
    })
    if (options.progressiveProjects) return loadProjectCards(current, signal, rows, projectIndex)
    const projectsByWorkspace = new Map<string, ProjectDto[]>()
    for (const project of projectIndex ?? []) {
      validateProject(project)
      const group = projectsByWorkspace.get(project.workspaceId) ?? []
      group.push(project)
      projectsByWorkspace.set(project.workspaceId, group)
    }
    const loaded: Awaited<ReturnType<typeof loadWorkspace>>[] = []
    const queue = rows.entries()
    const worker = async () => {
      for (const [index, workspace] of queue) {
        signal.throwIfAborted()
        loaded[index] = await loadWorkspace(workspace, signal,
          projectIndex === null ? undefined : projectsByWorkspace.get(workspace.id) ?? [])
      }
    }
    await Promise.all(Array.from({ length: Math.min(WORKSPACE_CONCURRENCY, rows.length) }, worker))
    const workspaceIds = new Set(rows.map(workspace => workspace.id))
    const projectsOutsideWorkspaces = []
    for (const project of projectIndex ?? []) {
      if (!workspaceIds.has(project.workspaceId)) projectsOutsideWorkspaces.push(await loadProjectResources(project, signal))
    }
    if (signal.aborted || disposed || current !== revision) return

    const workspaces: Workspace[] = []
    const projects: Project[] = []
    const nextVersions = new Map<string, number>()
    // Dựng model theo thứ tự gốc để cache tên thành viên và thứ tự UI ổn định.
    for (const { workspace: w, members: workspaceMembers, projects: projectRows } of loaded) {
      const members = workspaceMembers.map(person)
      members.forEach(p => people.set(p.id, p))
      for (const { project, members: projectMembers, dataset } of projectRows) {
        projects.push(projectModel(project, w, projectMembers, dataset))
        nextVersions.set(project.id, project.version)
      }
      workspaces.push({ canManage: w.ownerId === account.id, id: w.id, name: w.name, description: w.description, status: 'active', currentUserId: account.id,
        projects: projectRows.length, datasets: projectRows.filter(({ project }) => project.hasDataset).length, members: members.length,
        storageGb: w.storageUsedBytes / 1073741824, favorite: state.workspaces.find(item => item.id === w.id)?.favorite ?? false, cover: 'blue',
        createdAt: displayDate(w.createdAt), updatedAt: displayDate(w.updatedAt),
        ...(w.lastAccessedAt === null ? {} : { accessedAt: displayDate(w.lastAccessedAt) }),
        owner: members.find(m => m.id === w.ownerId) ?? person({ userId: w.ownerId, role: 'owner' }), memberPreview: members,
        memberRoles: Object.fromEntries(members.map(m => [m.id, m.role])) })
      nextVersions.set(w.id, w.version)
    }
    for (const { project, members, dataset } of projectsOutsideWorkspaces) {
      projects.push(projectModel(project, undefined, members, dataset))
      nextVersions.set(project.id, project.version)
    }
    if (projectIndex !== null) {
      const order = new Map(projectIndex.map((project, index) => [project.id, index]))
      projects.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    }
    versions.clear(); nextVersions.forEach((v, k) => versions.set(k, v))
    const workspaceId = workspaces.some(w => w.id === state.selection.workspaceId) ? state.selection.workspaceId : ''
    const projectId = projects.some(p => p.id === state.selection.projectId) ? state.selection.projectId : ''
    publish({ ...state, workspaces, projects, selection: { workspaceId, projectId } })
    return current
  }
  async function mutate(path: string, method: NonNullable<ApiRequestOptions['method']>, data?: unknown) {
    await request<void>(path, { method, data, ...(data instanceof FormData ? { timeoutMs: 120000 } : {}) })
    if (options.progressiveProjects) {
      cardRevision.abort()
      const deletedId = method === 'DELETE' ? path.match(/^\/projects\/([^/]+)$/)?.[1] : undefined
      if (deletedId) {
        cardSources.delete(deletedId)
        versions.delete(deletedId)
        publish({ ...state, projects: state.projects.filter(project => project.id !== deletedId),
          selection: state.selection.projectId === deletedId ? { ...state.selection, projectId: '' } : state.selection })
      }
    }
    try { await load() } catch { throw new Error('Đã lưu trên máy chủ nhưng chưa tải lại được danh sách. Hãy tải lại trang, không gửi lại thao tác.') }
    return saved('Đã lưu thay đổi trên máy chủ.')
  }
  const issueTypes = { system: 'display_error', feature: 'function_error', data: 'data_error', suggestion: 'feature_feedback', other: 'other' } as const
  type NotificationDto = { id: string; title: string; summary: string | null; type: string; readAt: string | null; createdAt: string; payload?: { targetType?: string; targetId?: string } }
  type IssueDto = { id: string; issueType: string; title: string; description: string; status: string; createdAt: string; updatedAt: string; version?: number; attachments?: { id: string; filename: string; sizeBytes: number }[] }
  function publishIssue(id: string, value: unknown) {
    if (!isRecord(value) || value['id'] !== id
      || !['issueType', 'title', 'description', 'status', 'createdAt', 'updatedAt'].every(key => typeof value[key] === 'string')) {
      throw new ApiError({ kind: 'invalid-response', message: 'Máy chủ trả về báo cáo không hợp lệ. Hãy mở lại chi tiết để kiểm tra.' })
    }
    const issue = value as IssueDto
    const report: PreviewReport = {
      id, code: id, title: issue.title, description: issue.description,
      ...(Number.isInteger(issue.version) && (issue.version ?? 0) > 0 ? { version: issue.version } : {}),
      issueType: (Object.keys(issueTypes) as (keyof typeof issueTypes)[]).find(key => issueTypes[key] === issue.issueType) ?? 'other',
      status: issue.status === 'needs_info' ? 'needs-info'
        : issue.status === 'new' || issue.status === 'closed' || issue.status === 'resolved' ? issue.status : 'processing',
      createdAt: new Date(issue.createdAt).toLocaleString('vi-VN'), updatedAt: issue.updatedAt,
      attachment: issue.attachments?.[0] ? {
        id: issue.attachments[0].id, name: issue.attachments[0].filename,
        sizeLabel: `${Math.ceil(issue.attachments[0].sizeBytes / 1024)} KB`,
      } : null,
    }
    publish({ ...state, reports: state.reports.map(row => row.id === id ? report : row) })
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
  async function loadPersonal(expectedRevision?: number) {
    const [profile, notifications, reports, unread] = await Promise.all([
      request<{ firstName: string; lastName: string; email: string; role: string; notificationsEnabled: boolean; phone?: string | null; bio?: string | null }>('/users/me'),
      cursorPages<NotificationDto>('/notifications'), cursorPages<IssueDto>('/issues'),
      request<{ unreadCount: number }>('/notifications/unread-count'),
    ])
    if (disposed || (expectedRevision !== undefined && expectedRevision !== revision)) return
    if (!isRecord(profile) || !(['firstName', 'lastName', 'email'] as const).every(key => typeof profile[key] === 'string')
      || !['admin', 'analyst'].includes(String(profile.role)) || typeof profile.notificationsEnabled !== 'boolean') {
      throw new ApiError({ kind: 'invalid-response', message: 'Hồ sơ từ máy chủ không hợp lệ.' })
    }
    if (!Number.isInteger(unread.unreadCount) || unread.unreadCount < 0) throw new Error('Số thông báo chưa đọc từ máy chủ không hợp lệ.')
    const enabled = profile.notificationsEnabled
    publish({ ...state,
      unreadNotificationCount: unread.unreadCount,
      profile: { ...state.profile, name: `${profile.firstName} ${profile.lastName}`.trim(), email: profile.email, role: profile.role,
        phone: profile.phone ?? '', bio: profile.bio ?? '' },
      notificationPrefs: { system: enabled, projects: enabled, quality: enabled, workspace: enabled },
      notifications: notifications.map(n => ({ id: n.id, title: n.title, context: n.summary ?? '', description: n.summary ?? '', tone: 'info', kind: 'system', unread: !n.readAt, at: n.createdAt, atFull: new Date(n.createdAt).toLocaleString('vi-VN'), projectId: n.payload?.targetType === 'project' ? n.payload.targetId ?? null : null })),
      reports: reports.map(r => ({ id: r.id, code: r.id, title: r.title, description: r.description,
        ...(Number.isInteger(r.version) && (r.version ?? 0) > 0 ? { version: r.version } : {}),
        issueType: (Object.keys(issueTypes) as (keyof typeof issueTypes)[]).find(k => issueTypes[k] === r.issueType) ?? 'other',
        status: r.status === 'needs_info' ? 'needs-info' : r.status === 'new' ? 'new' : r.status === 'closed' ? 'closed' : r.status === 'resolved' ? 'resolved' : 'processing',
        createdAt: new Date(r.createdAt).toLocaleString('vi-VN'), updatedAt: r.updatedAt,
        attachment: r.attachments?.[0] ? { id: r.attachments[0].id, name: r.attachments[0].filename, sizeLabel: `${Math.ceil(r.attachments[0].sizeBytes / 1024)} KB` } : null })),
    })
  }
  const projectRole = (role: string) => {
    const value = role.toLowerCase()
    if (value !== 'member' && value !== 'viewer') throw new Error('Project chỉ hỗ trợ vai trò Member hoặc Viewer.')
    return value
  }
  async function loadSessions() {
    const response = await request<unknown>('/auth/sessions')
    if (!Array.isArray(response)) throw new ApiError({ kind: 'invalid-response', message: 'Danh sách phiên đăng nhập từ máy chủ không hợp lệ.' })
    const rows = response.map(mapSessionDetail)
    const currentId = options.readSessionId?.()
    publish({ ...state, sessions: rows.map(row => ({
      id: row.id, platform: row.deviceName || 'Thiết bị không xác định',
      browser: row.userAgent || 'Không có thông tin trình duyệt', icon: 'monitor',
      location: 'Máy chủ không cung cấp vị trí', ip: row.ipAddress || 'Không có thông tin',
      current: row.id === currentId,
      startedAt: row.createdAt ? new Date(row.createdAt).toLocaleString('vi-VN') : 'Không có thông tin',
    })) })
  }
  function requireCurrentSession() {
    const id = options.readSessionId?.()
    if (!id) throw new Error('Không xác định được phiên hiện tại. Vui lòng đăng nhập lại trước khi thu hồi phiên.')
    return id
  }
  const version = (id: string): number => { const value = versions.get(id); if (value === undefined) throw new Error('Hãy tải lại tài nguyên trước khi lưu thay đổi.'); return value }
  let processingPanels: Promise<void> | undefined
  const recentWorkspaceNames = new Map<string, Promise<string | undefined>>()
  const getRecentWorkspaceName = (id: string) => {
    const cached = recentWorkspaceNames.get(id)
    if (cached) return cached
    const lookup = request<{ workspace: { name: string } }>(`/workspaces/${encodeURIComponent(id)}`)
      .then(result => {
        const name = result.workspace?.name
        if (typeof name === 'string' && name.trim()) return name
        recentWorkspaceNames.delete(id)
        return undefined
      }).catch(() => {
        recentWorkspaceNames.delete(id)
        return undefined
      })
    recentWorkspaceNames.set(id, lookup)
    return lookup
  }
  const analysisService = createAnalysisService(sessionApi)
  const store: ManagementStore = {
    ...(options.progressiveProjects ? {
      loadCardData,
      loadProjectWizardRoster: async (workspaceId: string, signal: AbortSignal) =>
        (await loadMembers(`/workspaces/${encodeURIComponent(workspaceId)}/members`, signal)).map(person),
    } : {}),
    refreshProject: async (id, signal) => {
      const current = revision
      const { project } = await request<{ project: ProjectDto }>(`/projects/${encodeURIComponent(id)}`, { signal })
      validateProject(project)
      if (project.id !== id) throw new ApiError({ kind: 'invalid-response', message: 'Chi tiết project không khớp yêu cầu.' })
      const [{ workspace }, dataset] = await Promise.all([
        request<{ workspace: WorkspaceDto }>(`/workspaces/${encodeURIComponent(project.workspaceId)}`, { signal }),
        loadDataset(project, signal),
      ])
      validateWorkspace(workspace)
      signal.throwIfAborted()
      if (disposed || revision !== current) return
      if (workspace.id !== project.workspaceId) throw new ApiError({ kind: 'invalid-response', message: 'Workspace không khớp project.' })
      versions.set(id, project.version)
      cardSources.delete(id)
      const item = projectModel(project, workspace, project.members, dataset)
      publish({ ...state, projects: state.projects.some(row => row.id === id)
        ? state.projects.map(row => row.id === id ? item : row) : [...state.projects, item] })
    },
    completeProject: id => mutate(`/projects/${encodeURIComponent(id)}/snapshot`, 'PUT', { expectedVersion: version(id) }),
    listRecentProjects: (cursor, signal) => listRecentProjects(sessionApi, cursor, signal),
    ...(options.recent ? {
      getRecentWorkspaceName,
      loadProcessingPanels: () => processingPanels ??= loadPersonal().catch((error: unknown) => {
        processingPanels = undefined
        throw error
      }),
    } : {}),
    ...(account.role.toLowerCase() === 'admin' ? { adminService: createAdminService(sessionApi) } : {}),
    datasetService: createDatasetService(sessionApi),
    analysisService,
    readAnalysisResult: async (id, signal) => {
      try {
        return await analysisService.getResult(id, signal)
      } catch (error) {
        if (normalizeApiError(error).status === 404) return null
        throw error
      }
    },
    runAnalysis: id => analysisService.run(id, {}),
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
    getSessionDetail: async sessionId => {
      const resource = sessionId === options.readSessionId?.() ? 'me' : encodeURIComponent(sessionId)
      const detail = mapSessionDetail(await request<unknown>(`/auth/sessions/${resource}`))
      if (detail.id !== sessionId) throw new ApiError({ kind: 'invalid-response', message: 'Chi tiết phiên không khớp yêu cầu.' })
      return detail
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
      publishIssue(id, await request<unknown>(`/issues/${encodeURIComponent(id)}`))
    },
    updateIssue: async (id, input) => {
      const updated = await request<unknown>(`/issues/${encodeURIComponent(id)}`, { method: 'PATCH', data: input })
      if (updated !== undefined && updated !== null && updated !== '') {
        publishIssue(id, updated)
        return
      }
      try { await store.getIssueDetail?.(id) } catch {
        throw new Error('Đã gửi bổ sung trên máy chủ nhưng chưa tải lại được báo cáo. Hãy mở lại báo cáo, không gửi lại thao tác.')
      }
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
      const { workspace } = await request<{ workspace: WorkspaceDto }>('/workspaces', { method: 'POST', requireBody: true, data: { name: input.name, description: input.description } satisfies CreateWorkspaceBody })
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
        const { project } = await request<{ project: ProjectDto }>(`/workspaces/${input.workspaceId}/projects`, { method: 'POST', requireBody: true, data: { name: input.name, description: input.description } satisfies CreateProjectBody })
        draft = { project, uploaded: false, members: new Set() }; drafts.set(key, draft)
      }
      const { project } = draft
      let failedStep = 'tải CSV'
      try {
        const form = new FormData(); form.append('file', input.dataset.file)
        if (!draft.uploaded) { await request(`/projects/${project.id}/datasets/upload`, { method: 'POST', data: form, timeoutMs: 120000 }); draft.uploaded = true }
        failedStep = 'thêm thành viên'
        for (const p of input.members) { if (draft.members.has(email(p))) continue; await request(`/projects/${project.id}/members`, { method: 'POST', data: { email: email(p), role: projectRole(p.role) } satisfies ProjectMemberBody }); draft.members.add(email(p)) }
      } catch {
        await load().catch(() => {})
        throw new Error(`Project “${input.name}” đã được tạo, nhưng bước ${failedStep} chưa hoàn tất. Mở project để kiểm tra trước khi thử lại.`)
      }
      drafts.delete(key)
      try {
        await load()
      } catch {
        return saved('Project đã được lưu, nhưng chưa tải lại được danh sách. Hãy tải lại trang để xem project.')
      }
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
      if (!draft) { const report = await request<{ id: string }>('/issues', { method: 'POST', requireBody: true, data: { issueType: issueTypes[input.issueType], title: input.title.trim(), description: input.description.trim() } satisfies CreateReportBody }); draft = { id: report.id, attachmentUploaded: false }; issueDrafts.set(key, draft) }
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
      await request('/users/me', { method: 'PATCH', data: { first_name: parts.slice(0, -1).join(' '), last_name: parts.at(-1) ?? '',
        phone: edit.phone.trim() || null, bio: edit.bio.trim() || null } satisfies ProfileBody })
      await loadPersonal(); return saved('Đã cập nhật hồ sơ.')
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
  return {
    store,
    loadCore: async (onProjectSummary?: () => void) => { await load(onProjectSummary) },
    loadPersonal: () => loadPersonal(),
    load: async () => {
      const loadedRevision = await load()
      if (loadedRevision !== undefined && loadedRevision === revision && !disposed) await loadPersonal(loadedRevision)
    },
    dispose: () => { disposed = true; revision++; lifecycle.abort(); workspaceLoad?.abort(); cardRevision.abort(); listeners.clear() },
  }
}
