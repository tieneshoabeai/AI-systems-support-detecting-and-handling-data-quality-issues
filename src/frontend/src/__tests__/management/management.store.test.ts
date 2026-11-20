import { describe, expect, it, vi } from 'vitest'
import { createManagementStore } from '../../services/management/management.store'
import { ApiError } from '../../lib/api-error'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'
const account = { id: 'u1', name: 'Tai', email: 'tai@example.com', role: 'analyst', initials: 'TA' }
const workspace = { id: 'w1', name: 'Workspace', description: '', ownerId: 'u1', members: [], storageUsedBytes: 0, version: 3, createdAt: '2026-11-15', updatedAt: '2026-11-15', lastAccessedAt: null }
const project = { id: 'p1', name: 'Project', description: '', workspaceId: 'w1', createdBy: 'u1', members: [], status: 'not_started', hasDataset: false, version: 4, createdAt: '2026-11-15', updatedAt: '2026-11-15' }
function harness(override?: (r: ApiRequestOptions) => unknown) {
  const request = vi.fn(async (r: ApiRequestOptions) => {
    const result = override?.(r)
    if (result !== undefined) return await Promise.resolve(result)
    if (r.path === '/users/me') return { firstName: 'Tai', lastName: 'Nguyen', email: account.email, role: 'analyst', notificationsEnabled: true }
    if (r.path === '/notifications/unread-count') return { unreadCount: 0 }
    if (['/issues', '/notifications'].includes(r.path)) return { items: [], meta: { hasMore: false, nextCursor: null } }
    if (r.path.endsWith('/members')) return { members: [{ userId: 'u1', role: 'owner', name: 'Tai', email: account.email }] }
    if (r.path === '/workspaces') return { items: [workspace], total: 1 }
    if (r.path === '/projects') throw new ApiError({ kind: 'http', status: 404, message: 'Route unavailable' })
    if (r.path === '/workspaces/w1/projects') return { items: [project], total: 1 }
    return {}
  })
  const data = createManagementStore({ request } as ApiClient, account)
  return { ...data, request }
}
describe('manager API integration', () => {
  it('uses the global project cursor and keeps projects outside the workspace list', async () => {
    const { load, store, request } = harness(r => {
      if (r.path !== '/projects') return undefined
      return r.params?.['cursor'] === 'next'
        ? { items: [project], meta: { hasMore: false, nextCursor: null } }
        : { items: [{ ...project, id: 'p2', workspaceId: 'shared' }], meta: { hasMore: true, nextCursor: 'next' } }
    })

    await load()

    expect(store.getState().projects.map(item => item.id)).toEqual(['p2', 'p1'])
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: '/projects', params: { limit: 100, cursor: 'next' } }))
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ path: '/workspaces/w1/projects' }))
  })
  it('completes a project with its loaded version and updates its state', async () => {
    let completed = false
    const { store, load, request } = harness(r => {
      if (r.path === '/projects/p1/snapshot') { completed = true; return { project: { ...project, status: 'completed', version: 5 } } }
      if (completed && r.path === '/workspaces/w1/projects') return { items: [{ ...project, status: 'completed', version: 5 }], total: 1 }
      return undefined
    })
    await load()
    await store.completeProject!('p1')
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: '/projects/p1/snapshot', method: 'PUT', data: { expectedVersion: 4 } }))
    expect(store.getState().projects.find(row => row.id === 'p1')?.status).toBe('completed')
  })

  it('starts three workspaces together and fills a freed slot without reordering results', async () => {
    const ids = ['w1', 'w2', 'w3', 'w4']
    const finish = new Map<string, (result: { members: [] }) => void>()
    const { load, store, request } = harness(r => {
      if (r.path === '/workspaces') return { items: ids.map(id => ({ ...workspace, id })), total: ids.length }
      if (r.path !== '/projects' && r.path.endsWith('/projects')) return { items: [], total: 0 }
      if (r.path.endsWith('/members')) return new Promise<{ members: [] }>(resolve => { finish.set(r.path, resolve) })
      return undefined
    })
    const loading = load()
    await vi.waitFor(() => expect(finish.size).toBe(3))
    expect(request.mock.calls.map(([r]) => r.path)).toContain('/workspaces/w2/projects')
    expect(finish.has('/workspaces/w4/members')).toBe(false)

    finish.get('/workspaces/w2/members')?.({ members: [] })
    await vi.waitFor(() => expect(finish.has('/workspaces/w4/members')).toBe(true))
    for (const id of ['w4', 'w3', 'w1']) finish.get(`/workspaces/${id}/members`)?.({ members: [] })
    await loading
    expect(store.getState().workspaces.map(w => w.id)).toEqual(ids)
  })

  it('stops queued work and preserves the previous snapshot when a required request fails', async () => {
    let fail = false
    const finishMembers: Array<(result: { members: [] }) => void> = []
    const { load, store, request } = harness(r => {
      if (fail && r.path === '/workspaces') {
        return { items: ['w1', 'w2', 'w3', 'w4'].map(id => ({ ...workspace, id })), total: 4 }
      }
      if (fail && r.path === '/workspaces/w1/members') return Promise.reject(new Error('Offline'))
      if (fail && r.path.endsWith('/members')) return new Promise<{ members: [] }>(resolve => { finishMembers.push(resolve) })
      if (fail && r.path.endsWith('/projects')) return { items: [], total: 0 }
      return undefined
    })
    await load()
    const previous = store.getState()
    request.mockClear()
    fail = true

    await expect(load()).rejects.toThrow('Offline')
    for (const finish of finishMembers) finish({ members: [] })
    await Promise.resolve()
    expect(store.getState()).toBe(previous)
    expect(request.mock.calls.some(([r]) => r.path.startsWith('/workspaces/w4/'))).toBe(false)
  })

  it('aborts an older load and ignores its late response after reloading', async () => {
    let firstRequest = true
    let finishOldLoad!: (result: { items: typeof workspace[]; total: number }) => void
    const { load, store, request } = harness(r => {
      if (r.path !== '/workspaces') return undefined
      if (!firstRequest) return { items: [], total: 0 }
      firstRequest = false
      return new Promise(resolve => { finishOldLoad = resolve })
    })
    const oldLoad = load()
    const oldSignal = request.mock.calls[0]?.[0].signal

    await load()
    const latest = store.getState()
    finishOldLoad({ items: [workspace], total: 1 })
    await oldLoad

    expect(oldSignal?.aborted).toBe(true)
    expect(store.getState()).toBe(latest)
    expect(request.mock.calls.some(([r]) => r.path.startsWith('/workspaces/w1/'))).toBe(false)
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
      if (r.path === '/workspaces/w1/members') return { items: [{ userId: 'u1', role: 'owner', firstName: 'Tai', lastName: 'Nguyen', email: account.email }] }
      if (r.path.endsWith('/members')) return { items: [], meta: { hasMore: false, nextCursor: null } }
      if (r.path.endsWith('/projects')) return { items: [], meta: { hasMore: false, nextCursor: null } }
      return undefined
    })
    await load()
    expect(store.getState().workspaces).toHaveLength(2)
    expect(store.getState().workspaces[0]!.owner.name).toBe('Tai Nguyen')
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: '/workspaces', params: { cursor: 'c2', limit: 100 } }))
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

it('shares a concurrent create and reports a saved project when only the list reload fails', async () => {
  const { store, request } = harness(r => {
    if (r.path === '/workspaces/w1/projects' && r.method === 'POST') return { project }
    if (r.path === '/workspaces') return Promise.reject(new Error('Offline'))
    return undefined
  })
  const file = new File(['a\n1'], 'a.csv')
  const input = { workspaceId: 'w1', name: 'Project', description: '', members: [], dataset: { file, fileName: file.name, format: 'CSV' as const, rows: 1, columns: 1, sizeMb: 0.01 } }
  const results = await Promise.all([store.createProject(input), store.createProject(input)])

  for (const result of results) {
    expect(result).toMatchObject({ persisted: true, message: expect.stringContaining('chưa tải lại được danh sách') })
  }
  expect(request.mock.calls.filter(([r]) => r.method === 'POST').map(([r]) => r.path))
    .toEqual(['/workspaces/w1/projects', '/projects/p1/datasets/upload'])
})

it('reports the member step when adding a member fails after CSV upload', async () => {
  const { store } = harness(r => {
    if (r.path === '/workspaces/w1/projects' && r.method === 'POST') return { project }
    if (r.path === '/projects/p1/members' && r.method === 'POST') return Promise.reject(new Error('Offline'))
    return undefined
  })
  const file = new File(['a\n1'], 'a.csv')
  await expect(store.createProject({
    workspaceId: 'w1', name: 'Project', description: '',
    members: [{ id: 'u2', name: 'Member', initials: 'M', email: 'member@example.test', role: 'Member' }],
    dataset: { file, fileName: file.name, format: 'CSV', rows: 1, columns: 1, sizeMb: 0.01 },
  })).rejects.toThrow('bước thêm thành viên chưa hoàn tất')
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
