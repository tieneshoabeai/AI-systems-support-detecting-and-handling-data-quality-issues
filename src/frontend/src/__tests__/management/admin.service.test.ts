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
  it('loads all admin users using the returned cursor', async () => {
    const request = vi.fn(async (options: ApiRequestOptions) => options.params?.['cursor'] === 'users-2'
      ? { items: [user('u2')], meta: { hasMore: false, nextCursor: null, limit: 100 } }
      : { items: [user('u1')], meta: { hasMore: true, nextCursor: 'users-2', limit: 100 } })
    const service = createAdminService({ request } as ApiClient)

    await expect(service.listUsers()).resolves.toMatchObject([{ id: 'u1' }, { id: 'u2' }])
    expect(request).toHaveBeenNthCalledWith(1, { path: '/admin/users', method: 'GET', auth: 'session', params: { limit: 100 } })
    expect(request).toHaveBeenNthCalledWith(2, { path: '/admin/users', method: 'GET', auth: 'session', params: { limit: 100, cursor: 'users-2' } })
  })

  it('preserves admin issue sorting and limit on every cursor page', async () => {
    const request = vi.fn(async (options: ApiRequestOptions) => options.params?.['cursor'] === 'issues-2'
      ? { items: [issue('i2')], meta: { hasMore: false, nextCursor: null } }
      : { items: [issue('i1')], meta: { hasMore: true, nextCursor: 'issues-2' } })
    const service = createAdminService({ request } as ApiClient)
    const params = { limit: 1, sortBy: 'createdAt', sortOrder: 'desc' }

    await expect(service.listIssues(1)).resolves.toMatchObject([{ id: 'i1' }, { id: 'i2' }])
    expect(request).toHaveBeenNthCalledWith(1, { path: '/admin/issues', method: 'GET', auth: 'session', params })
    expect(request).toHaveBeenNthCalledWith(2, { path: '/admin/issues', method: 'GET', auth: 'session', params: { ...params, cursor: 'issues-2' } })
  })

  it('rejects a repeated cursor instead of looping forever', async () => {
    const request = vi.fn(async () => ({ items: [user('u1')], meta: { hasMore: true, nextCursor: 'same' } }))
    const service = createAdminService({ request } as unknown as ApiClient)

    await expect(service.listUsers()).rejects.toThrow('Phân trang quản trị')
    expect(request).toHaveBeenCalledTimes(2)
  })
})
