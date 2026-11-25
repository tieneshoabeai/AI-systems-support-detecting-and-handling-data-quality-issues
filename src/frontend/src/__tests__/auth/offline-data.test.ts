/// <reference types="node" />
import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OfflineReadDatabase } from '../../repositories/offline/offline-read.database'
import { createOfflineReadRepository } from '../../repositories/offline/offline-read.repository'
import { createOfflineDataService } from '../../services/offline/offline-data.service'
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
const setup = () => {
  const db = new OfflineReadDatabase(`offline-test-${crypto.randomUUID()}`)
  databases.push(db)
  let current: DraftAccess | null = { accountId: 'a', generation: 1, expiresAtMs: 2000 }
  let time = 1000
  const listeners = new Set<() => void>()
  const access = { read: () => current, subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } } }
  const change = (next: DraftAccess | null) => { current = next; listeners.forEach(fn => fn()) }
  const cache = createOfflineReadRepository({ db, access, namespace: 'qa', now: () => time })
  const service = createOfflineDataService({ cache, access })
  services.push(service)
  const request = vi.fn<(input: ApiRequestOptions) => Promise<unknown>>().mockResolvedValue({ items: [{ id: 'p', name: 'Saved project' }] })
  const api = service.wrapApi({ request } as ApiClient)
  return { db, cache, access, change, service, request, api, setTime: (value: number) => { time = value } }
}
const projects: ApiRequestOptions = { path: '/projects', auth: 'session' }

describe('durable offline reads', () => {
  it('reads a saved response after reopening IndexedDB and makes no offline request', async () => {
    const s = setup()
    const value = await s.api.request(projects)
    s.db.close(); await s.db.open()
    s.service.useSavedData()
    expect(await s.api.request(projects)).toEqual(value)
    expect(s.request).toHaveBeenCalledOnce()
    expect(s.service.getSnapshot()).toMatchObject({ offline: true, savedAt: 1000 })
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
