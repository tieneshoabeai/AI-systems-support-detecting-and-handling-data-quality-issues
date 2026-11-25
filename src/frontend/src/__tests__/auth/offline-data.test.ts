/// <reference types="node" />
import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OfflineReadDatabase } from '../../repositories/offline/offline-read.database'
import { createOfflineReadRepository } from '../../repositories/offline/offline-read.repository'
import { createOfflineDataService } from '../../services/offline/offline-data.service'
import { createManagementStore } from '../../services/management/management.store'
import { ApiError } from '../../lib/api-error'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'
import type { DraftAccess } from '../../types/datasets/upload-draft.types'

const databases: OfflineReadDatabase[] = []
const services: ReturnType<typeof createOfflineDataService>[] = []
beforeEach(() => { vi.stubGlobal('Blob', NodeBlob) })
afterEach(async () => {
  services.splice(0).forEach(service => service.dispose())
  for (const db of databases.splice(0)) await db.delete()
  vi.unstubAllGlobals()
})
const failure = (kind: 'network' | 'http', status?: number) => new ApiError({ kind, message: 'Test outage', ...(status ? { status } : {}) })
const setup = (options: Pick<Parameters<typeof createOfflineDataService>[0], 'checkConnection' | 'recoveryIntervalMs'> = {}) => {
  const db = new OfflineReadDatabase(`offline-test-${crypto.randomUUID()}`)
  databases.push(db)
  let current: DraftAccess | null = { accountId: 'a', generation: 1, expiresAtMs: 2000 }
  let time = 1000
  const listeners = new Set<() => void>()
  const access = { read: () => current && current.expiresAtMs > time ? current : null, subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } } }
  const change = (next: DraftAccess | null) => { current = next; listeners.forEach(fn => fn()) }
  const cache = createOfflineReadRepository({ db, access, namespace: 'qa', now: () => time })
  const service = createOfflineDataService({ cache, access, ...options })
  services.push(service)
  const request = vi.fn<(input: ApiRequestOptions) => Promise<unknown>>().mockResolvedValue({ items: [{ id: 'p', name: 'Saved project' }] })
  const api = service.wrapApi({ request } as ApiClient)
  return { db, cache, access, change, service, request, api, setTime: (value: number) => { time = value } }
}
const projects: ApiRequestOptions = { path: '/projects', auth: 'session' }

describe('durable offline reads', () => {
  it.each([500, 502, 503])('keeps other APIs and analysis usable after an individual HTTP %s', async status => {
    const s = setup()
    await s.api.request(projects)
    s.request.mockRejectedValueOnce(failure('http', status))
    expect(await s.api.request(projects)).toMatchObject({ items: [{ id: 'p' }] })
    expect(s.service.getSnapshot()).toMatchObject({ offline: false, fallback: { path: '/projects', status } })
    s.request.mockResolvedValueOnce({ analysisRunId: 'real-response' })
    expect(await s.api.request({ path: '/projects/p/analysis', method: 'POST', auth: 'session' })).toEqual({ analysisRunId: 'real-response' })
    await s.api.request(projects)
    expect(s.service.getSnapshot().fallback).toBeUndefined()
  })

  it('preserves the actual HTTP error for an uncached failing endpoint without going offline', async () => {
    const s = setup()
    s.request.mockRejectedValueOnce(failure('http', 500))
    await expect(s.api.request(projects)).rejects.toMatchObject({ status: 500 })
    expect(s.service.getSnapshot().offline).toBe(false)
  })

  it.each([401, 403, 404])('never substitutes saved data for HTTP %s or treats it as a connection failure', async status => {
    const checkConnection = vi.fn().mockResolvedValue(true)
    const s = setup({ checkConnection })
    await s.api.request(projects)
    await s.api.request({ path: '/workspaces', auth: 'session' })
    s.request.mockRejectedValueOnce(failure('http', status))
    await expect(s.api.request(projects)).rejects.toMatchObject({ status })
    expect(s.service.getSnapshot().offline).toBe(false)
    expect(s.service.getSnapshot().fallback).toBeUndefined()
    expect(checkConnection).not.toHaveBeenCalled()
    expect(await s.cache.list()).toHaveLength(status === 404 ? 1 : 0)
  })

  it.each(['network', 'timeout'] as const)('verifies backend reachability before treating a %s failure as global offline', async kind => {
    const checkConnection = vi.fn().mockResolvedValue(true)
    const s = setup({ checkConnection })
    await s.api.request(projects)
    s.request.mockRejectedValueOnce(new ApiError({ kind, message: 'one endpoint failed' }))
    expect(await s.api.request(projects)).toBeDefined()
    expect(checkConnection).toHaveBeenCalledOnce()
    expect(s.service.getSnapshot().offline).toBe(false)
  })

  it('recovers automatically with no queued writes and no online event', async () => {
    const checkConnection = vi.fn().mockResolvedValue(false)
    const s = setup({ checkConnection, recoveryIntervalMs: 10 })
    await s.api.request(projects)
    s.request.mockRejectedValueOnce(failure('network'))
    await s.api.request(projects)
    expect(s.service.getSnapshot()).toMatchObject({ offline: true, reason: 'backend' })
    checkConnection.mockResolvedValue(true)
    await vi.waitFor(() => { expect(s.service.getSnapshot().offline).toBe(false) })
    s.request.mockResolvedValueOnce({ items: [{ id: 'p', name: 'Fresh API' }] })
    expect(await s.api.request(projects)).toMatchObject({ items: [{ name: 'Fresh API' }] })
  })

  it('does not trust the browser online event until the backend actually recovers', async () => {
    let online = false
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
    const checkConnection = vi.fn().mockResolvedValue(false)
    const s = setup({ checkConnection, recoveryIntervalMs: 10 })
    window.dispatchEvent(new Event('offline'))
    expect(s.service.getSnapshot()).toMatchObject({ offline: true, reason: 'network' })
    expect(checkConnection).not.toHaveBeenCalled()
    online = true; window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => { expect(checkConnection).toHaveBeenCalled() })
    expect(s.service.getSnapshot().offline).toBe(true)
    checkConnection.mockResolvedValue(true)
    await vi.waitFor(() => { expect(s.service.getSnapshot().offline).toBe(false) })
  })

  it('does not let a late failed request override a newer API 200 response', async () => {
    const s = setup({ checkConnection: vi.fn().mockResolvedValue(false) })
    await s.api.request(projects)
    let reject!: (error: unknown) => void
    s.request.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
    const pending = s.api.request(projects)
    await s.api.request({ path: '/workspaces', auth: 'session' })
    reject(new ApiError({ kind: 'timeout', message: 'late timeout' }))
    await pending
    expect(s.service.getSnapshot().offline).toBe(false)
  })

  it('rejects stale recovery and cached responses when the account changes during the probe', async () => {
    let resolve!: (value: boolean) => void
    const checkConnection = vi.fn(() => new Promise<boolean>(done => { resolve = done }))
    const s = setup({ checkConnection })
    await s.api.request(projects)
    s.request.mockRejectedValueOnce(failure('network'))
    const pending = s.api.request(projects)
    const assertion = expect(pending).rejects.toMatchObject({ kind: 'session' })
    await vi.waitFor(() => { expect(resolve).toBeTypeOf('function') })
    s.change({ accountId: 'b', generation: 2, expiresAtMs: 2000 }); resolve(true)
    await assertion
    expect(s.service.getSnapshot().offline).toBe(false)
    expect(await s.cache.list()).toEqual([])
  })

  it('ignores late recovery after logout and never resumes a revoked local session', async () => {
    let resolve!: (value: boolean) => void
    const s = setup({ checkConnection: () => new Promise<boolean>(done => { resolve = done }) })
    s.service.useSavedData()
    await vi.waitFor(() => { expect(resolve).toBeTypeOf('function') })
    s.change(null); resolve(true)
    await Promise.resolve(); await Promise.resolve()
    expect(s.service.getSnapshot().offline).toBe(false)
    await expect(s.api.request(projects)).rejects.toMatchObject({ kind: 'session' })
  })

  it('cannot clear physical offline using a late successful API response', async () => {
    let online = true
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
    const s = setup()
    let resolve!: (value: unknown) => void
    s.request.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const pending = s.api.request(projects)
    online = false; window.dispatchEvent(new Event('offline'))
    resolve({ items: [] }); await pending
    expect(s.service.getSnapshot()).toMatchObject({ offline: true, reason: 'network' })
  })

  it('stops background recovery and ignores its result after disposal', async () => {
    let resolve!: (value: boolean) => void
    const checkConnection = vi.fn(() => new Promise<boolean>(done => { resolve = done }))
    const s = setup({ checkConnection, recoveryIntervalMs: 10 })
    const listener = vi.fn(); s.service.subscribe(listener)
    s.service.useSavedData()
    await vi.waitFor(() => { expect(resolve).toBeTypeOf('function') })
    s.service.dispose(); const previous = listener.mock.calls.length; resolve(true)
    await Promise.resolve(); await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(previous)
    expect(checkConnection).toHaveBeenCalledOnce()
  })

  it('joins concurrent connectivity probes instead of racing them', async () => {
    let resolve!: (value: boolean) => void
    const checkConnection = vi.fn(() => new Promise<boolean>(done => { resolve = done }))
    const s = setup({ checkConnection })
    await s.api.request(projects)
    s.request.mockRejectedValue(failure('network'))
    const requests = [s.api.request(projects), s.api.request(projects)]
    await vi.waitFor(() => { expect(checkConnection).toHaveBeenCalledOnce() })
    resolve(false); await Promise.all(requests)
    expect(checkConnection).toHaveBeenCalledOnce()
    expect(s.service.getSnapshot().offline).toBe(true)
  })

  it('does not restart failed recovery just because the offline provider renders again', async () => {
    const checkConnection = vi.fn().mockResolvedValue(false)
    const s = setup({ checkConnection, recoveryIntervalMs: 60000 })
    s.service.useSavedData()
    await new Promise(resolve => setTimeout(resolve, 0))
    s.service.useSavedData()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(checkConnection).toHaveBeenCalledOnce()
    expect(s.service.getSnapshot().offline).toBe(true)
  })

  it('does not recover when the session expires during a connectivity probe', async () => {
    let resolve!: (value: boolean) => void
    const checkConnection = vi.fn(() => new Promise<boolean>(done => { resolve = done }))
    const s = setup({ checkConnection })
    s.service.useSavedData()
    await vi.waitFor(() => { expect(resolve).toBeTypeOf('function') })
    s.setTime(2000); resolve(true)
    await Promise.resolve(); await Promise.resolve()
    s.service.reconnect()
    await expect(s.api.request(projects)).rejects.toMatchObject({ kind: 'session' })
    expect(s.service.getSnapshot().offline).toBe(true)
    expect(checkConnection).toHaveBeenCalledOnce()
  })

  it('reads a saved response after reopening IndexedDB and makes no offline request', async () => {
    const s = setup()
    const value = await s.api.request(projects)
    s.db.close(); await s.db.open()
    s.service.useSavedData()
    expect(await s.api.request(projects)).toEqual(value)
    expect(s.request).toHaveBeenCalledOnce()
    expect(s.service.getSnapshot()).toMatchObject({ offline: true, savedAt: 1000 })
  })

  it('loads cached workspaces and projects from IndexedDB when the backend stops responding', async () => {
    const s = setup()
    const workspace = {
      id: 'w1', name: 'Workspace đã lưu', description: '', ownerId: 'a', members: [], storageUsedBytes: 0,
      createdAt: '2026-11-01', updatedAt: '2026-11-01', lastAccessedAt: null, version: 1,
    }
    const project = {
      id: 'p1', workspaceId: 'w1', workspaceName: workspace.name, name: 'Project đã lưu', description: '',
      createdBy: 'a', members: [], status: 'not_started', hasDataset: false,
      createdAt: '2026-11-01', updatedAt: '2026-11-01', version: 1,
    }
    s.request.mockImplementation(request => {
      if (request.path === '/workspaces') return Promise.resolve({ items: [workspace], meta: { hasMore: false, nextCursor: null } })
      if (request.path === '/projects') return Promise.resolve({ items: [project], meta: { hasMore: false, nextCursor: null } })
      if (request.path === '/workspaces/w1/members' || request.path === '/projects/p1/members') {
        return Promise.resolve({ members: [{ userId: 'a', role: 'owner', name: 'Test User' }] })
      }
      return Promise.reject(new Error(`Unexpected request: ${request.path}`))
    })
    const account = { id: 'a', name: 'Test User', role: 'analyst', initials: 'TU' }
    const onlineStore = createManagementStore(s.api, account)
    await onlineStore.loadCore()
    expect(onlineStore.store.getState().workspaces.map(row => row.name)).toEqual([workspace.name])
    expect(onlineStore.store.getState().projects.map(row => row.name)).toEqual([project.name])
    const networkCalls = s.request.mock.calls.length
    onlineStore.dispose()

    s.request.mockRejectedValueOnce(failure('network'))
    const offlineStore = createManagementStore(s.api, account, { readOnly: () => s.service.getSnapshot().offline })
    await offlineStore.loadCore()

    expect(offlineStore.store.getState().workspaces.map(row => row.name)).toEqual([workspace.name])
    expect(offlineStore.store.getState().projects.map(row => row.name)).toEqual([project.name])
    expect(s.service.getSnapshot()).toMatchObject({ offline: true, reason: 'backend' })
    expect(s.request).toHaveBeenCalledTimes(networkCalls + 1)
    offlineStore.dispose()
  })

  it('falls back on an outage, never on forbidden or missing resources', async () => {
    const s = setup()
    await s.api.request(projects)
    s.request.mockRejectedValueOnce(failure('network'))
    expect(await s.api.request(projects)).toMatchObject({ items: [{ id: 'p' }] })
    s.service.reconnect()
    s.request.mockRejectedValueOnce(failure('http', 403))
    await expect(s.api.request(projects)).rejects.toMatchObject({ status: 403 })
    expect(await s.cache.list()).toEqual([])
    s.request.mockRejectedValueOnce(failure('http', 404))
    await expect(s.api.request(projects)).rejects.toMatchObject({ status: 404 })
    expect(s.service.getSnapshot().offline).toBe(false)
  })

  it('uses exact pagination/filter/query keys, including read-only POST queries', async () => {
    const s = setup()
    const query: ApiRequestOptions = { path: '/datasets/d/records/query', method: 'POST', auth: 'session', data: { limit: 10, filters: [{ column: 'a', value: 1 }] } }
    await s.api.request(query)
    s.service.useSavedData()
    expect(await s.api.request({ ...query, data: { filters: [{ value: 1, column: 'a' }], limit: 10 } })).toBeDefined()
    await expect(s.api.request({ ...query, data: { limit: 20 } })).rejects.toMatchObject({ code: 'OFFLINE_NOT_SAVED' })
    expect(s.request).toHaveBeenCalledOnce()
  })

  it('blocks mutations without replaying them on reconnect', async () => {
    const s = setup()
    s.service.useSavedData()
    await expect(s.api.request({ path: '/projects/p/analysis', method: 'POST', auth: 'session', data: {} })).rejects.toMatchObject({ code: 'OFFLINE_READ_ONLY' })
    s.service.reconnect()
    expect(s.request).not.toHaveBeenCalled()
  })

  it('does not persist auth credentials or administration/session endpoints', async () => {
    const s = setup()
    s.request.mockResolvedValue({ id: 'a', email: 'a@example.test', accessToken: 'private', refreshToken: 'private', session: { token: 'private' } })
    await s.api.request({ path: '/users/me', auth: 'session' })
    await s.api.request({ path: '/auth/refresh', auth: 'public', method: 'POST', data: { refresh_token: 'private' } })
    await s.api.request({ path: '/users/me/sessions', auth: 'session' })
    const rows = await s.cache.list()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.payload).toEqual({ id: 'a', email: 'a@example.test' })
    expect(JSON.stringify(rows)).not.toContain('private')
  })

  it('rejects stale in-flight responses after an account switch and clears the old cache', async () => {
    const s = setup()
    await s.api.request(projects)
    let finish!: (value: unknown) => void
    s.request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const pending = s.api.request(projects)
    s.change({ accountId: 'b', generation: 2, expiresAtMs: 2000 })
    finish({ items: [{ id: 'secret-a' }] })
    await expect(pending).rejects.toMatchObject({ kind: 'session' })
    expect(await s.cache.list()).toEqual([])
    await vi.waitFor(async () => { expect(await s.db.reads.where('accountId').equals('a').count()).toBe(0) })
  })

  it('denies expired sessions and namespaces data by API environment', async () => {
    const s = setup()
    await s.api.request(projects)
    const other = createOfflineReadRepository({ db: s.db, access: s.access, namespace: 'production', now: () => 1000 })
    expect(await other.list()).toEqual([])
    s.setTime(2000)
    await expect(s.cache.list()).rejects.toMatchObject({ kind: 'session' })
  })

  it('keeps server success when browser storage is full and exposes a storage warning', async () => {
    const s = setup()
    vi.spyOn(s.cache, 'save').mockRejectedValue(new DOMException('full', 'QuotaExceededError'))
    expect(await s.api.request(projects)).toMatchObject({ items: [{ id: 'p' }] })
    expect(s.service.getSnapshot().storageError).toContain('dung lượng')
  })

  it('evicts the oldest entries within the account quota, preserving other namespaces', async () => {
    const s = setup()
    await s.cache.save('oldest', {}, 50 * 1024 * 1024)
    s.setTime(1100)
    await s.cache.save('second', {}, 50 * 1024 * 1024)
    s.setTime(1200)
    await s.cache.save('third', {}, 1)
    expect(await s.cache.read('oldest')).toBeUndefined()
    expect(await s.cache.read('second')).toBeDefined()
    await expect(s.cache.save('too-large', {}, 50 * 1024 * 1024 + 1)).rejects.toMatchObject({ kind: 'storage' })
  })

  it('saves only completed valid PDFs and lists/downloads them offline', async () => {
    const s = setup()
    const report: ApiRequestOptions = { path: '/projects/p/report/r/file', auth: 'session', responseType: 'blob', includeStatus: true }
    s.request.mockResolvedValueOnce({ status: 202, data: new Blob(['{"status":"pending"}']) })
    await s.api.request(report)
    expect(await s.service.listReports('p')).toEqual([])
    s.request.mockResolvedValueOnce({ status: 200, data: new Blob(['bad pdf']) })
    await s.api.request(report)
    expect(await s.service.listReports('p')).toEqual([])
    s.request.mockResolvedValueOnce({ status: 200, data: new Blob(['%PDF-1.7\nreport'], { type: 'application/pdf' }) })
    await s.api.request(report)
    expect(await s.service.listReports('p')).toEqual([{ reportId: 'r', savedAt: 1000 }])
    s.service.useSavedData()
    const value = await s.api.request<{ status: number; data: Blob }>(report)
    expect(await value.data.text()).toContain('%PDF-')
    expect(s.request).toHaveBeenCalledTimes(3)
  })

  it('preserves unrelated viewed data after upload and invalidates a deleted dataset/result', async () => {
    const s = setup()
    s.request.mockResolvedValueOnce({ project: { id: 'p', hasDataset: true } })
    await s.api.request({ path: '/projects/p', auth: 'session' })
    s.request.mockResolvedValueOnce({ dataset: { id: 'd' } })
    await s.api.request({ path: '/projects/p/datasets', auth: 'session' })
    await s.api.request({ path: '/datasets/d/records', auth: 'session' })
    await s.api.request({ path: '/projects/p/analysis/result', auth: 'session' })
    await s.api.request({ path: '/projects/other/datasets/upload', method: 'POST', auth: 'session' })
    expect(await s.cache.list()).toHaveLength(4)
    await s.api.request({ path: '/datasets/d', method: 'DELETE', auth: 'session' })
    s.service.useSavedData()
    expect(await s.api.request({ path: '/projects/p/datasets', auth: 'session' })).toEqual({ dataset: null })
    expect(await s.api.request({ path: '/projects/p', auth: 'session' })).toEqual({ project: { id: 'p', hasDataset: false } })
    await expect(s.api.request({ path: '/datasets/d/records', auth: 'session' })).rejects.toMatchObject({ code: 'OFFLINE_NOT_SAVED' })
    await expect(s.api.request({ path: '/projects/p/analysis/result', auth: 'session' })).rejects.toMatchObject({ code: 'OFFLINE_NOT_SAVED' })
  })

  it('persists the immediate analysis response for offline result viewing', async () => {
    const s = setup()
    s.request.mockResolvedValueOnce({ analysisRunId: 'run', charts: [] })
    await s.api.request({ path: '/projects/p/analysis', method: 'POST', auth: 'session', data: {} })
    s.service.useSavedData()
    expect(await s.api.request({ path: '/projects/p/analysis/result', auth: 'session' })).toEqual({ analysisRunId: 'run', charts: [] })
  })
})
