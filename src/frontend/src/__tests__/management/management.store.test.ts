import { describe, expect, it, vi } from 'vitest'
import { createManagementStore } from '../../services/management/management.store'
import { ApiError } from '../../lib/api-error'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'
const account = { id: 'u1', name: 'Tai', email: 'tai@example.com', role: 'analyst', initials: 'TA' }
const workspace = { id: 'w1', name: 'Workspace', description: '', ownerId: 'u1', members: [], storageUsedBytes: 0, version: 3, createdAt: '2026-11-15', updatedAt: '2026-11-15', lastAccessedAt: null }
const project = { id: 'p1', name: 'Project', description: '', workspaceId: 'w1', createdBy: 'u1', members: [], status: 'not_started', hasDataset: false, version: 4, createdAt: '2026-11-15', updatedAt: '2026-11-15' }
function harness(override?: (r: ApiRequestOptions) => unknown, options?: { readSessionId: () => string }) {
  const request = vi.fn(async (r: ApiRequestOptions) => {
    const result = override?.(r)
    if (result !== undefined) return await Promise.resolve(result)
    if (r.path === '/users/me') return { firstName: 'Tai', lastName: 'Nguyen', email: account.email, role: 'analyst', notificationsEnabled: true }
    if (r.path === '/notifications/unread-count') return { unreadCount: 0 }
    if (['/issues', '/notifications'].includes(r.path)) return { items: [], meta: { hasMore: false, nextCursor: null } }
    if (r.path.endsWith('/members')) return { members: [{ userId: 'u1', role: 'owner', name: 'Tai', email: account.email }] }
    if (r.path === '/workspaces') return { items: [workspace], total: 1 }
    if (r.path === '/projects') return { items: [project], total: 1 }
    if (r.path === '/workspaces/w1/projects') return { items: [project], total: 1 }
    return {}
  })
  const data = createManagementStore({ request } as ApiClient, account, options)
  return { ...data, request }
}
describe('manager API integration', () => {
  it('loads the authenticated project index and follows pages across workspaces', async () => {
    const { store, load, request } = harness(r => {
      if (r.path === '/workspaces') return { items: [workspace, { ...workspace, id: 'w2' }], total: 2 }
      if (r.path === '/projects') return r.params?.['cursor'] === 'p2'
        ? { items: [{ ...project, id: 'p2', workspaceId: 'w2' }], meta: { hasMore: false, nextCursor: null } }
        : { items: [project], meta: { hasMore: true, nextCursor: 'p2' } }
      return undefined
    })
    await load()
    expect(store.getState().projects.map(item => item.id)).toEqual(['p1', 'p2'])
    expect(request).toHaveBeenCalledWith({ path: '/projects', auth: 'session', params: { limit: 100 } })
    expect(request).toHaveBeenCalledWith({ path: '/projects', auth: 'session', params: { cursor: 'p2', limit: 100 } })
    expect(request.mock.calls.map(([r]) => r.path)).not.toContain('/workspaces/w1/projects')
  })
  it('uses the workspace route only when the legacy backend returns 404 on the project index', async () => {
    const { store, load, request } = harness(r => {
      if (r.path === '/projects') throw new ApiError({ kind: 'http', status: 404, message: 'Not found' })
      return undefined
    })
    await load()
    await load()
    expect(store.getState().projects.map(item => item.id)).toEqual(['p1'])
    expect(request.mock.calls.filter(([r]) => r.path === '/projects')).toHaveLength(1)
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: '/workspaces/w1/projects' }))
  })
  it('loads real records, owner identity and versions without fixture data', async () => {
    const { store, load, request } = harness()
    expect(store.getState().workspaces).toEqual([])
    await load()
    expect(store.getState().workspaces[0]).toMatchObject({ id: 'w1', currentUserId: 'u1', owner: { email: account.email } })
    await store.rename('project', 'p1', 'Renamed')
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: '/projects/p1', method: 'PATCH', auth: 'session', data: { name: 'Renamed', expectedVersion: 4 } }))
  })
  it('does not mutate locally or report success when the server rejects a write', async () => {
    const { store, load } = harness(r => r.method === 'DELETE' ? Promise.reject(new Error('Forbidden')) : undefined)
    await load()
    await expect(store.remove('workspace', 'w1')).rejects.toThrow('Forbidden')
    expect(store.getState().workspaces).toHaveLength(1)
  })
  it('loads every page rather than silently dropping records', async () => {
    const { load, store, request } = harness(r => r.path === '/workspaces' ? { items: [{ ...workspace, id: r.params?.['page'] === 1 ? 'w1' : 'w2' }], total: 2 } : r.path === '/workspaces/w2/projects' ? { items: [], total: 0 } : undefined)
    await load()
    expect(store.getState().workspaces).toHaveLength(2)
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: '/workspaces', params: { page: 2, limit: 100 } }))
  })
  // Bản backend đang chạy trả phân trang con trỏ và danh sách thành viên dạng { items }, không có
  // total. Test này giữ cho store đọc được bản đó mà không phải bỏ hỗ trợ dạng trang-số.
  it('reads cursor pagination and member items from the deployed backend contract', async () => {
    const { load, store, request } = harness(r => {
      if (r.path === '/workspaces' && r.params?.['cursor'] === undefined) return { items: [{ ...workspace, id: 'w1' }], meta: { hasMore: true, nextCursor: 'c2' } }
      if (r.path === '/workspaces' && r.params?.['cursor'] === 'c2') return { items: [{ ...workspace, id: 'w2' }], meta: { hasMore: false, nextCursor: null } }
      if (r.path === '/workspaces/w1/members') return r.params?.['cursor'] === 'm2'
        ? { items: [{ userId: 'u2', role: 'member', name: 'Member' }], meta: { hasMore: false, nextCursor: null } }
        : { items: [{ userId: 'u1', role: 'owner', firstName: 'Tai', lastName: 'Nguyen', email: account.email }], meta: { hasMore: true, nextCursor: 'm2' } }
      if (r.path.endsWith('/members')) return { items: [], meta: { hasMore: false, nextCursor: null } }
      if (r.path.endsWith('/projects')) return { items: [], meta: { hasMore: false, nextCursor: null } }
      return undefined
    })
    await load()
    expect(store.getState().workspaces).toHaveLength(2)
    expect(store.getState().workspaces[0]!.owner.name).toBe('Tai Nguyen')
    expect(store.getState().workspaces[0]!.members).toBe(2)
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: '/workspaces', params: { cursor: 'c2', limit: 100 } }))
  })
  it('reads deployed session fields and uses the current-session endpoint', async () => {
    const detail = { id: 's1', device_name: 'Desktop', ip_address: '127.0.0.1', user_agent: 'Browser', is_revoked: false, remember_me: true }
    const { store, request } = harness(r => r.path === '/auth/sessions' ? [detail] : detail, { readSessionId: () => 's1' })
    await store.loadSessions!()
    expect(store.getState().sessions[0]).toMatchObject({ platform: 'Desktop', browser: 'Browser', ip: '127.0.0.1', current: true })
    await expect(store.getSessionDetail!('s1')).resolves.toMatchObject({ id: 's1', rememberMe: true })
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/auth/sessions/me', auth: 'session' }))
  })
  it('lists reports that need information and submits the edited report version', async () => {
    const issue = { id: 'i1', title: 'Issue', description: 'Initial', issueType: 'data_error', status: 'needs_info',
      version: 2, createdAt: '2026-11-15', updatedAt: '2026-11-15' }
    const { store, load, request } = harness(r => {
      if (r.path === '/issues') return { items: [issue], meta: { hasMore: false, nextCursor: null } }
      if (r.path === '/issues/i1') return r.method === 'PATCH'
        ? { ...issue, description: 'More information', status: 'in_progress', version: 3 } : issue
      return undefined
    })
    await load()
    expect(store.getState().reports[0]).toMatchObject({ status: 'needs-info', version: 2 })
    await store.getIssueDetail!('i1')
    await store.updateIssue!('i1', { description: 'More information', expectedVersion: 2 })
    expect(request).toHaveBeenLastCalledWith({ path: '/issues/i1', method: 'PATCH', auth: 'session',
      data: { description: 'More information', expectedVersion: 2 } })
    expect(store.getState().reports[0]).toMatchObject({ description: 'More information', status: 'processing', version: 3 })
  })
  it('uses GET for default record pages and POST for filtered or sorted records', async () => {
    const { store, request } = harness(() => ({ items: [], meta: { hasMore: false, nextCursor: null } }))
    const signal = new AbortController().signal
    await store.datasetService!.records('d1', { limit: 50, cursor: 'c2' }, signal)
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/datasets/d1/records', params: { limit: 50, cursor: 'c2' }, signal }))
    const query = { limit: 50, sort: [{ column: 'c0', order: 'asc' as const }] }
    await store.datasetService!.records('d1', query, signal)
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/datasets/d1/records/query', method: 'POST', data: query, signal }))
  })
  it('uses the dataset soft-delete endpoint', async () => {
    const { store, request } = harness()
    await store.datasetService!.delete('d1')
    expect(request).toHaveBeenLastCalledWith({ path: '/datasets/d1', method: 'DELETE', auth: 'session' })
  })
  it('updates project information and its version from the detail endpoint', async () => {
    const { store, load, request } = harness(r => r.path === '/projects/p1' && !r.method
      ? { project: { ...project, name: 'Updated', workspaceName: 'Workspace details', version: 5 } } : undefined)
    await load()
    const signal = new AbortController().signal
    await store.refreshProject!('p1', signal)
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/projects/p1', signal }))
    expect(store.getState().projects[0]).toMatchObject({ name: 'Updated', workspaceName: 'Workspace details' })
    await store.rename('project', 'p1', 'Renamed')
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'PATCH', data: { name: 'Renamed', expectedVersion: 5 } }))
  })
  it('uploads the original CSV after creation and only then reports success', async () => {
    const { store, request } = harness(r => r.path === '/workspaces/w1/projects' && r.method === 'POST' ? { project } : undefined)
    const file = new File(['a,b\n1,2'], 'data.csv', { type: 'text/csv' })
    const result = await store.createProject({ workspaceId: 'w1', name: 'Project', description: '', members: [], dataset: { file, fileName: file.name, format: 'CSV', rows: 1, columns: 2, sizeMb: 0.01 } })
    const upload = request.mock.calls.map(([r]) => r).find(r => r.path.endsWith('/upload'))!
    expect((upload.data as FormData).get('file')).toBe(file)
    expect(result.persisted).toBe(true)
  })
  it('reports partial creation clearly if upload fails', async () => {
    const { store } = harness(r => r.path.endsWith('/upload') ? Promise.reject(new Error('Upload failed')) : r.method === 'POST' ? { project } : undefined)
    await expect(store.createProject({ workspaceId: 'w1', name: 'Project', description: '', members: [], dataset: { file: new File(['a'], 'a.csv'), fileName: 'a.csv', format: 'CSV', rows: 0, columns: 1, sizeMb: 0 } })).rejects.toThrow('đã được tạo')
  })
  it('never invents an email for member writes', async () => {
    const { store, request } = harness()
    await expect(store.addProjectMember({ projectId: 'p1', person: { id: 'u2', name: 'Someone', initials: 'SO', role: 'Member' }, role: 'Member' })).rejects.toThrow('email')
    expect(request).not.toHaveBeenCalled()
  })
  it('does not publish an in-flight load after disposal', async () => {
    const { store, load, dispose } = harness()
    const loading = load(); dispose(); await loading
    expect(store.getState().workspaces).toEqual([])
  })
})

it('resumes a failed upload without creating another project', async () => {
  let attempts = 0
  const { store, request } = harness(r => {
    if (r.path === '/workspaces/w1/projects' && r.method === 'POST') return { project }
    if (r.path.endsWith('/upload') && ++attempts === 1) return Promise.reject(new Error('offline'))
    return undefined
  })
  const input = { workspaceId: 'w1', name: 'Project', description: '', members: [], dataset: { file: new File(['a\n1'], 'a.csv'), fileName: 'a.csv', format: 'CSV' as const, rows: 1, columns: 1, sizeMb: 0 } }
  await expect(store.createProject(input)).rejects.toThrow('đã được tạo')
  await store.createProject(input)
  expect(request.mock.calls.filter(([r]) => r.path === '/workspaces/w1/projects' && r.method === 'POST')).toHaveLength(1)
})
it('sends ownership version and the single global notification preference contract', async () => {
  const { store, load, request } = harness()
  await load()
  await store.transferOwner!('workspace', 'w1', 'member@example.com')
  expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: '/workspaces/w1/transfer-owner', method: 'POST', data: { email: 'member@example.com', expectedVersion: 3 } }))
  await store.setNotificationPref('system', false)
  expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: '/users/me/notification-preferences', data: { notificationsEnabled: false } }))
})
it('rejects unsupported or oversized files before creating a project', async () => {
  const { store, request } = harness()
  await expect(store.uploadDataset!('p1', new File(['x'], 'a.zip'))).rejects.toThrow('CSV')
  expect(request).not.toHaveBeenCalled()
})

it('does not upload an attachment twice when refreshing after a saved report fails', async () => {
  let failedRefresh = false
  const { store, request } = harness(r => {
    if (r.path === '/issues' && r.method === 'POST') return { id: 'issue1' }
    if (r.path === '/issues' && !r.method && !failedRefresh) {
      failedRefresh = true
      return Promise.reject(new Error('refresh offline'))
    }
    return undefined
  })
  const input = { issueType: 'system' as const, title: 'Display issue', description: 'Screen does not render',
    attachment: { name: 'screen.png', sizeLabel: '1 KB', file: new File(['image'], 'screen.png', { type: 'image/png' }) } }
  await expect(store.createReport(input)).rejects.toThrow('refresh offline')
  await store.createReport(input)
  expect(request.mock.calls.filter(([r]) => r.path === '/issues' && r.method === 'POST')).toHaveLength(1)
  expect(request.mock.calls.filter(([r]) => r.path === '/issues/issue1/attachments')).toHaveLength(1)
})
