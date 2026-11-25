import { describe, expect, it, vi } from 'vitest'
import { createAdminService } from '../../services/management/admin.service'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'

const user = (id: string) => ({
  id, email: `${id}@example.com`, firstName: 'Test', lastName: 'User', role: 'analyst', status: 'active',
  createdAt: '2026-11-15T00:00:00.000Z', updatedAt: '2026-11-15T00:00:00.000Z',
})
const issue = (id: string) => ({
  id, userId: 'u1', issueType: 'data_error', title: `Issue ${id}`, description: 'Details', status: 'new', version: 1,
  createdAt: '2026-11-15T00:00:00.000Z', updatedAt: '2026-11-15T00:00:00.000Z',
})

describe('admin API pagination', () => {
  it('loads admin users one page at a time using the returned cursor', async () => {
    const request = vi.fn((options: ApiRequestOptions) => Promise.resolve(options.params?.['cursor'] === 'users-2'
      ? { items: [user('u2')], meta: { hasMore: false, nextCursor: null, limit: 100 } }
      : { items: [user('u1')], meta: { hasMore: true, nextCursor: 'users-2', limit: 100 } }))
    const service = createAdminService({ request } as ApiClient)

    const first = await service.listUsersPage()
    expect(first).toMatchObject({ items: [{ id: 'u1' }], nextCursor: 'users-2' })
    expect(request).toHaveBeenCalledOnce()
    await expect(service.listUsersPage(first.nextCursor!)).resolves.toMatchObject({ items: [{ id: 'u2' }], nextCursor: null })
    expect(request).toHaveBeenNthCalledWith(1, { path: '/admin/users', method: 'GET', auth: 'session', params: { limit: 15 } })
    expect(request).toHaveBeenNthCalledWith(2, { path: '/admin/users', method: 'GET', auth: 'session', params: { limit: 15, cursor: 'users-2' } })
  })

  it('preserves admin issue sorting and limit on every cursor page', async () => {
    const request = vi.fn((options: ApiRequestOptions) => Promise.resolve(options.params?.['cursor'] === 'issues-2'
      ? { items: [issue('i2')], meta: { hasMore: false, nextCursor: null } }
      : { items: [issue('i1')], meta: { hasMore: true, nextCursor: 'issues-2' } }))
    const service = createAdminService({ request } as ApiClient)
    const params = { limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }

    await expect(service.listIssuesPage()).resolves.toMatchObject({ items: [{ id: 'i1' }], nextCursor: 'issues-2' })
    await expect(service.listIssuesPage('issues-2')).resolves.toMatchObject({ items: [{ id: 'i2' }], nextCursor: null })
    expect(request).toHaveBeenNthCalledWith(1, { path: '/admin/issues', method: 'GET', auth: 'session', params })
    expect(request).toHaveBeenNthCalledWith(2, { path: '/admin/issues', method: 'GET', auth: 'session', params: { ...params, cursor: 'issues-2' } })
  })

  it('rejects a repeated cursor instead of looping forever', async () => {
    const request = vi.fn(() => Promise.resolve({ items: [user('u1')], meta: { hasMore: true, nextCursor: 'same' } }))
    const service = createAdminService({ request } as unknown as ApiClient)

    const first = await service.listUsersPage()
    await expect(service.listUsersPage(first.nextCursor!)).rejects.toThrow('Con trỏ quản trị')
    expect(request).toHaveBeenCalledTimes(2)
  })
})
