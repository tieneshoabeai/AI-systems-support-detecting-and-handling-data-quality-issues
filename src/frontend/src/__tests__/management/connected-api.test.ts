import { Blob } from 'node:buffer'
import { AxiosError } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { createAdminService } from '../../services/management/admin.service'
import { createDatasetService } from '../../services/processing/dataset.service'
import { createAnalysisService } from '../../services/processing/analysis.service'
import { createManagementStore } from '../../services/management/management.store'
import { createAxiosClient } from '../../lib/axios-client'
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
  it('uses GET for plain records and keeps the cursor', async () => {
    const page = { items: [], meta: { hasMore: false, nextCursor: null } }
    const { api, request } = transport(() => page)
    const signal = new AbortController().signal
    await expect(createDatasetService(api).records('d1', { limit: 50, cursor: 'next' }, signal)).resolves.toEqual(page)
    expect(request).toHaveBeenCalledExactlyOnceWith({ path: '/datasets/d1/records', params: { limit: 50, cursor: 'next' }, auth: 'session', signal })
  })

  it('preserves PII metadata and rejects a malformed flag', async () => {
    let isPii: unknown = true
    const { api } = transport(() => ({ columns: [{ key: 'c0', name: 'Email', dataType: 'string', isPii }] }))
    const service = createDatasetService(api)
    const signal = new AbortController().signal
    await expect(service.schema('d1', signal)).resolves.toEqual([{ key: 'c0', name: 'Email', dataType: 'string', isPii: true }])
    isPii = 'yes'
    await expect(service.schema('d1', signal)).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('rejects a dataset detail belonging to another dataset', async () => {
    const { api } = transport(() => ({ dataset: { id: 'other', name: 'CSV', rowCount: 3, columnCount: 2 } }))
    await expect(createDatasetService(api).detail('d1', new AbortController().signal)).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('does not retry PII or delete mutations after a failure', async () => {
    const { api, request } = transport(() => { throw new Error('Forbidden') })
    const service = createDatasetService(api)
    await expect(service.updateColumnPii('data/1', 'c0', true)).rejects.toThrow('Forbidden')
    expect(request).toHaveBeenCalledExactlyOnceWith({ path: '/datasets/data%2F1/columns/pii', method: 'PATCH', data: { columns: [{ columnKey: 'c0', isPii: true }] }, auth: 'session' })
    request.mockClear()
    await expect(service.delete('data/1')).rejects.toThrow('Forbidden')
    expect(request).toHaveBeenCalledExactlyOnceWith({ path: '/datasets/data%2F1', method: 'DELETE', auth: 'session' })
  })

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

  it('propagates a rejected dataset read without retrying it', async () => {
    const { api, request } = transport(() => { throw new Error('Forbidden') })
    const signal = new AbortController().signal
    await expect(createDatasetService(api).schema('d1', signal))
      .rejects.toThrow('Forbidden')
    expect(request).toHaveBeenCalledExactlyOnceWith({
      path: '/datasets/d1/schema', auth: 'session', signal,
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
  it.each([['current', 'me'], ['other', 'other']])('reads session %s using %s and maps the backend fields', async (id, resource) => {
    const { api, request } = transport(() => ({
      id, device_name: null, ip_address: null, user_agent: null,
      is_revoked: false, remember_me: true, last_used_at: null, created_at: null,
      expires_at: '2026-11-20T12:00:00.000Z',
    }))
    const { store } = createManagementStore(api, account, { readSessionId: () => 'current' })

    await expect(store.getSessionDetail!(id)).resolves.toMatchObject({ id, rememberMe: true })
    expect(request).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ path: `/auth/sessions/${resource}` }))
  })

  it.each([true, false])('submits an issue supplement with its version (PATCH has body: %s)', async hasBody => {
    const { api, request } = transport(options => {
      if (options.path === '/issues/issue1' && options.method === 'PATCH' && !hasBody) return ''
      if (options.path === '/issues/issue1') return { ...issue, status: 'in_progress', version: 3 }
      throw new Error('Unexpected request')
    })
    const { store } = createManagementStore(api, account)
    await store.updateIssue!('issue1', { title: 'Updated', description: 'More information', expectedVersion: 2 })
    expect(request.mock.calls.map(([r]) => ({ path: r.path, method: r.method ?? 'GET', data: r.data }))).toEqual([
      { path: '/issues/issue1', method: 'PATCH', data: { title: 'Updated', description: 'More information', expectedVersion: 2 } },
      ...(hasBody ? [] : [{ path: '/issues/issue1', method: 'GET', data: undefined }]),
    ])
  })

  it('propagates an issue version conflict without retry or reload', async () => {
    const { api, request } = transport(() => { throw new Error('Version conflict') })
    const { store } = createManagementStore(api, account)
    await expect(store.updateIssue!('issue1', { title: 'Updated', expectedVersion: 2 })).rejects.toThrow('Version conflict')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('protects the current session while revoking another session', async () => {
    const { api, request } = transport(options => options.path === '/auth/sessions'
      ? ['current', 'other'].map(id => ({ id, device_name: 'Laptop', ip_address: null, user_agent: 'Browser',
        is_revoked: false, remember_me: true, last_used_at: null, expires_at: '2026-12-18T00:00:00Z', created_at: '2026-11-18T00:00:00Z' })) : undefined)
    const { store } = createManagementStore(api, account, { readSessionId: () => 'current' })
    await store.loadSessions!()
    expect(store.getState().sessions.find(row => row.id === 'current')?.current).toBe(true)

    await expect(store.revokeSession('current')).rejects.toThrow('Đăng xuất')
    expect(request).toHaveBeenCalledTimes(1)
    await store.revokeSession('other')
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/auth/sessions/other', method: 'DELETE', auth: 'session' }))
    expect(store.getState().sessions.map(row => row.id)).toEqual(['current'])
  })
})

it('uses HTTP status to distinguish pending metadata from a PDF through the session transport', async () => {
  const pending = new Blob(['{"status":"queued"}'], { type: 'application/octet-stream' })
  const file = new Blob(['%PDF-1.7'])
  const request = vi.fn().mockResolvedValueOnce({ status: 202, data: pending }).mockResolvedValueOnce({ status: 200, data: file })
  const api = createAxiosClient({ baseUrl: 'https://example.test/api/v1', readToken: () => 'test-token', adapter: request })
  const service = createManagementStore(api, account).store.analysisService!

  await expect(service.downloadReport('p1', 'r1')).resolves.toEqual({ status: 'pending', metadata: { status: 'queued' } })
  await expect(service.downloadReport('p1', 'r1')).resolves.toEqual({ status: 'ready', file })
  expect(request).toHaveBeenCalledWith(expect.objectContaining({
    url: 'https://example.test/api/v1/projects/p1/report/r1/file', responseType: 'blob', signal: expect.any(AbortSignal),
  }))
})

it('keeps plain text from a 202 response as pending metadata', async () => {
  const { api } = transport(() => ({ status: 202, data: new Blob(['Still queued']) }))
  await expect(createAnalysisService(api).downloadReport('p1', 'r1'))
    .resolves.toEqual({ status: 'pending', metadata: 'Still queued' })
})

it.each([200, 204])('rejects HTTP %i when the response does not contain a downloadable PDF', async status => {
  const { api } = transport(() => ({ status, data: new Blob(['{"status":"queued"}'], { type: 'application/pdf' }) }))
  const service = createAnalysisService(api)

  await expect(service.downloadReport('p1', 'r1')).rejects.toMatchObject({ kind: 'invalid-response', status })
})

it('preserves the HTTP error when the report download is rejected', async () => {
  const api = createAxiosClient({
    baseUrl: 'https://example.test/api/v1',
    readToken: () => 'test-token',
    adapter: async config => {
      throw new AxiosError('Report unavailable', undefined, config, undefined, {
        status: 404, statusText: 'Not Found', headers: {}, data: new Blob([]), config,
      })
    },
  })
  await expect(createAnalysisService(api).downloadReport('p1', 'r1')).rejects.toMatchObject({ kind: 'http', status: 404 })
})
