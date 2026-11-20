import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { normalizeApiError } from '../../lib/api-error'
import { createManagementStore } from '../../services/management/management.store'
import { mapSessionDetail } from '../../services/management/session.mapper'
import { createDatasetService } from '../../services/processing/dataset.service'
import { createAdminService } from '../../services/management/admin.service'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'

const account = { id: 'u1', name: 'Test User', email: 'test@example.test', role: 'analyst', initials: 'TU' }
const session = { id: 's1', device_name: 'Laptop', ip_address: null, user_agent: 'Browser', is_revoked: false,
  remember_me: true, last_used_at: null, expires_at: '2026-12-18T00:00:00Z', created_at: '2026-11-18T00:00:00Z' }

it('maps the actual snake_case session response and excludes unknown fields', () => {
  expect(mapSessionDetail({ ...session, internal: 'ignored' })).toEqual({ id: 's1', deviceName: 'Laptop',
    ipAddress: null, userAgent: 'Browser', isRevoked: false, rememberMe: true, lastUsedAt: null,
    expiresAt: session.expires_at, createdAt: session.created_at })
})

it.each([null, { ...session, remember_me: 'true' }, { ...session, expires_at: 'invalid' }])(
  'rejects malformed sessions with a classified error', value => {
    expect(() => mapSessionDetail(value)).toThrow(expect.objectContaining({ kind: 'invalid-response' }))
  },
)

it('loads all member cursors, including nullable profile fields', async () => {
  const workspace = { id: 'w1', name: 'Workspace', description: '', ownerId: 'u1', members: [], storageUsedBytes: 0,
    version: 1, createdAt: '2026-11-18', updatedAt: '2026-11-18', lastAccessedAt: null }
  const request = vi.fn((options: ApiRequestOptions) => Promise.resolve().then(() => {
    if (options.path === '/workspaces') return { items: [workspace], meta: { hasMore: false, nextCursor: null } }
    if (options.path === '/projects') return { items: [], meta: { hasMore: false, nextCursor: null } }
    if (options.path.endsWith('/members')) return options.params?.['cursor'] === 'next'
      ? { items: [{ userId: 'u2', role: 'member', firstName: null, lastName: null, email: null }], meta: { hasMore: false, nextCursor: null } }
      : { items: [{ userId: 'u1', role: 'owner', firstName: 'Test', lastName: 'User', email: account.email }], meta: { hasMore: true, nextCursor: 'next' } }
    if (options.path === '/users/me') return { firstName: 'Test', lastName: 'User', email: account.email, role: 'analyst', notificationsEnabled: true }
    if (options.path === '/notifications/unread-count') return { unreadCount: 0 }
    if (options.path === '/issues' || options.path === '/notifications') return { items: [], meta: { hasMore: false, nextCursor: null } }
    throw new Error('Unexpected request')
  }))
  const data = createManagementStore({ request } as ApiClient, account)
  await data.load()
  expect(data.store.getState().workspaces[0]?.members).toBe(2)
  expect(data.store.getState().workspaces[0]?.memberPreview.map(member => member.id)).toEqual(['u1', 'u2'])
  expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: '/workspaces/w1/members', params: { limit: 100, cursor: 'next' } }))
})

it('does not upload or publish success when project creation completes after disposal', async () => {
  let finish!: (value: unknown) => void
  const request = vi.fn<(options: ApiRequestOptions) => Promise<unknown>>(() => new Promise(resolve => { finish = resolve }))
  const data = createManagementStore({ request } as ApiClient, account)
  const pending = data.store.createProject({ workspaceId: 'w1', name: 'Project', description: '', members: [], dataset: {
    file: new File(['id\n1'], 'data.csv', { type: 'text/csv' }), fileName: 'data.csv', format: 'CSV', rows: 1, columns: 1, sizeMb: 0.001,
  } })
  const rejected = expect(pending).rejects.toMatchObject({ kind: 'cancelled' })
  data.dispose()
  finish({ project: { id: 'p1' } })
  await rejected
  expect(request).toHaveBeenCalledTimes(1)
})

describe('dataset response validation', () => {
  it.each([null, { columns: [{ key: 'c0', name: 'Age', dataType: {} }] },
    { columns: [{ key: 'c0', name: 'A', dataType: 'number' }, { key: 'c0', name: 'B', dataType: 'number' }] }])(
    'rejects malformed schema before it reaches React', async response => {
      const api = { request: () => Promise.resolve(response) } as ApiClient
      await expect(createDatasetService(api).schema('d1', new AbortController().signal)).rejects.toMatchObject({ kind: 'invalid-response' })
    },
  )
  it('rejects a null page with ApiError instead of leaking a TypeError', async () => {
    const api = { request: () => Promise.resolve(null) } as ApiClient
    await expect(createDatasetService(api).records('d1', { limit: 50 }, new AbortController().signal)).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})

it('keeps the backend OTP cooldown without retaining raw Axios response data', () => {
  const error = new AxiosError('throttle', undefined, undefined, undefined, { status: 429, statusText: 'Too Many Requests',
    headers: new AxiosHeaders(), config: { headers: new AxiosHeaders() },
    data: { success: false, error: { code: 'LIMIT_EXCEEDED', message: 'Wait', details: { retryAfterSeconds: 30 } } } })
  expect(normalizeApiError(error)).toMatchObject({ kind: 'http', status: 429, code: 'LIMIT_EXCEEDED', retryAfterMs: 30_000 })
  expect(normalizeApiError(error)).not.toHaveProperty('response')
})

it('passes the admin cursor to the next page and rejects a repeated cursor', async () => {
  const request = vi.fn<(options: ApiRequestOptions) => Promise<unknown>>(() => Promise.resolve({ items: [], meta: { hasMore: true, nextCursor: 'next' } }))
  const service = createAdminService({ request } as ApiClient)
  await expect(service.listUsersPage()).resolves.toEqual({ items: [], nextCursor: 'next' })
  await expect(service.listUsersPage('next')).rejects.toThrow('lặp lại')
  expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/admin/users', params: { limit: 15, cursor: 'next' } }))
})

it('keeps Retry-After seconds from an HTTP 429 response', () => {
  const error = new AxiosError('throttle', undefined, undefined, undefined, { status: 429, statusText: 'Too Many Requests',
    headers: new AxiosHeaders({ 'retry-after': '12' }), config: { headers: new AxiosHeaders() }, data: {} })
  expect(normalizeApiError(error).retryAfterMs).toBe(12_000)
})
