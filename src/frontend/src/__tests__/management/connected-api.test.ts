import { describe, expect, it, vi } from 'vitest'
import { createAdminService } from '../../services/management/admin.service'
import { createDatasetService } from '../../services/processing/dataset.service'
import { createManagementStore } from '../../services/management/management.store'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'

const transport = (respond: (options: ApiRequestOptions) => unknown) => {
  const request = vi.fn((options: ApiRequestOptions) => Promise.resolve().then(() => respond(options)))
  return { request, api: { request } as ApiClient }
}
const issue = {
  id: 'issue1', userId: 'u1', issueType: 'data_error', title: 'Missing records', description: 'Missing CSV records',
  status: 'new', version: 2, createdAt: '2026-11-18', updatedAt: '2026-11-18',
}
const account = { id: 'u1', name: 'Test User', email: 'user@example.test', role: 'analyst', initials: 'TU' }

describe('connected dataset API', () => {
  it('sends query conditions and cancellation with the current session', async () => {
    const page = { items: [{ rowIndex: 1, props: { c0: 21 } }], meta: { hasMore: true, nextCursor: 'next' } }
    const { api, request } = transport(() => page)
    const signal = new AbortController().signal
    const query = { limit: 50, filters: [{ column: 'c0', operator: 'greaterThan' as const, value: 20 }] }

    await expect(createDatasetService(api).records('data/1', query, signal)).resolves.toEqual(page)

    expect(request).toHaveBeenCalledExactlyOnceWith({
      path: '/datasets/data%2F1/records/query', method: 'POST', data: query, auth: 'session', signal,
    })
  })

  it('rejects an incomplete cursor response instead of showing a broken next page', async () => {
    const { api } = transport(() => ({ items: [], meta: { hasMore: true, nextCursor: null } }))
    await expect(createDatasetService(api).records('d1', { limit: 50 }, new AbortController().signal))
      .rejects.toThrow('Trang dữ liệu')
  })

  it('propagates a rejected column write without reporting success', async () => {
    const { api, request } = transport(() => { throw new Error('Forbidden') })
    await expect(createDatasetService(api).renameColumns('d1', { columns: [{ key: 'c0', name: 'Age' }] }))
      .rejects.toThrow('Forbidden')
    expect(request).toHaveBeenCalledExactlyOnceWith({
      path: '/datasets/d1/columns', method: 'PATCH', data: { columns: [{ key: 'c0', name: 'Age' }] }, auth: 'session',
    })
  })
})

describe('connected admin API', () => {
  it('sends the selected status and expected version', async () => {
    const updated = { ...issue, status: 'resolved', version: 3 }
    const { api, request } = transport(() => updated)
    await expect(createAdminService(api).updateIssueStatus('issue1', 'resolved', 2)).resolves.toEqual(updated)
    expect(request).toHaveBeenCalledExactlyOnceWith({
      path: '/admin/issues/issue1/status', method: 'PATCH', auth: 'session', data: { status: 'resolved', expectedVersion: 2 },
    })
  })

  it('rejects unsupported issue statuses from the server', async () => {
    const { api } = transport(() => ({ items: [{ ...issue, status: 'unknown' }] }))
    await expect(createAdminService(api).listIssues()).rejects.toThrow('issue quản trị')
  })

  it('only exposes admin actions to an admin account', () => {
    const { api, request } = transport(() => ({}))
    expect(createManagementStore(api, account).store.adminService).toBeUndefined()
    expect(createManagementStore(api, { ...account, role: 'admin' }).store.adminService).toBeDefined()
    expect(request).not.toHaveBeenCalled()
  })
})

describe('connected session API', () => {
  it('protects the current session while revoking another session', async () => {
    const { api, request } = transport(options => options.path === '/auth/sessions'
      ? [{ id: 'current' }, { id: 'other' }] : undefined)
    const { store } = createManagementStore(api, account, { readSessionId: () => 'current' })
    await store.loadSessions!()
    expect(store.getState().sessions.find(row => row.id === 'current')?.current).toBe(true)

    await expect(store.revokeSession('current')).rejects.toThrow('Đăng xuất')
    expect(request).toHaveBeenCalledTimes(1)
    await store.revokeSession('other')
    expect(request).toHaveBeenLastCalledWith({ path: '/auth/sessions/other', method: 'DELETE', auth: 'session' })
    expect(store.getState().sessions.map(row => row.id)).toEqual(['current'])
  })
})
