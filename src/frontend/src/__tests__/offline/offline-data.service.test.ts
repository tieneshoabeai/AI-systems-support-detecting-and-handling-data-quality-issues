import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../lib/api-error'
import { createOfflineDataService } from '../../services/offline/offline-data.service'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'

afterEach(() => vi.restoreAllMocks())

const requestKey = (path: string) => JSON.stringify({ path, method: 'GET', params: {}, responseType: 'json', includeStatus: false })
const harness = () => {
  const values = new Map<string, { payload: unknown; savedAt: number }>()
  const reads = {
    read: vi.fn(async (key: string) => values.get(key)),
    save: vi.fn(async (key: string, payload: unknown, _bytes: number) => {
      values.set(key, { payload, savedAt: 1234 })
      return 1234
    }),
    remove: vi.fn(async (key: string) => { values.delete(key) }),
    removeResource: vi.fn(async (path: string) => {
      for (const key of values.keys()) {
        const cachedPath = JSON.parse(key) as { path?: string }
        if (cachedPath.path === path || cachedPath.path?.startsWith(`${path}/`)) values.delete(key)
      }
    }),
    clear: vi.fn(async () => { values.clear() }),
    list: vi.fn(async () => [...values.keys()].map(key => ({ key }))),
  }
  const localData = createOfflineDataService({ reads, now: () => 5678 })
  return { localData, reads, values }
}

it('serves a successful cached workspace response during network outage and reports both timestamps', async () => {
  const { localData, reads } = harness()
  let offline = false
  const client: ApiClient = { request: async <T,>(_request: ApiRequestOptions) => {
    if (offline) throw new ApiError({ kind: 'network', message: 'offline' })
    return { items: [{ id: 'w1' }] } as T
  } }
  const wrapped = localData.wrapClient(client)
  await expect(wrapped.request({ path: '/workspaces', auth: 'session' })).resolves.toEqual({ items: [{ id: 'w1' }] })
  expect(reads.save).toHaveBeenCalledOnce()
  offline = true
  await expect(wrapped.request({ path: '/workspaces', auth: 'session' })).resolves.toEqual({ items: [{ id: 'w1' }] })
  expect(localData.getSnapshot().fallbacks).toEqual([expect.objectContaining({
    cacheKey: requestKey('/workspaces'), path: '/workspaces', savedAt: 1234, fallbackAt: 5678,
  })])
})

it('reports a cache miss for uncached allowlisted data and never caches non-allowlisted routes', async () => {
  const { localData, reads } = harness()
  const client: ApiClient = { request: async () => { throw new ApiError({ kind: 'network', message: 'offline' }) } }
  const wrapped = localData.wrapClient(client)
  await expect(wrapped.request({ path: '/datasets/d1/schema', auth: 'session' })).rejects.toMatchObject({ code: 'OFFLINE_CACHE_MISS' })
  await expect(wrapped.request({ path: '/admin/users', auth: 'session' })).rejects.toMatchObject({ kind: 'network' })
  expect(localData.getSnapshot().cacheMisses).toEqual([expect.objectContaining({ path: '/datasets/d1/schema' })])
  expect(reads.save).not.toHaveBeenCalled()
})

it('removes resource cache after a 404 so a later outage cannot show deleted data', async () => {
  const { localData, reads } = harness()
  const detail = { project: { id: 'p1', name: 'Cached project' } }
  let missing = false
  let delivered404 = false
  const client: ApiClient = { request: async <T,>(request: ApiRequestOptions) => {
    if (request.path === '/projects/p1' && missing && !delivered404) {
      delivered404 = true
      throw new ApiError({ kind: 'http', status: 404, message: 'missing' })
    }
    if (missing) throw new ApiError({ kind: 'network', message: 'offline' })
    return detail as T
  } }
  const wrapped = localData.wrapClient(client)
  await wrapped.request({ path: '/projects/p1', auth: 'session' })
  expect(reads.save).toHaveBeenCalledOnce()
  missing = true
  await expect(wrapped.request({ path: '/projects/p1', auth: 'session' })).rejects.toMatchObject({ status: 404 })
  await expect(wrapped.request({ path: '/projects/p1', auth: 'session' })).rejects.toMatchObject({ code: 'OFFLINE_CACHE_MISS' })
  expect(localData.getSnapshot().fallbacks).toEqual([])
})
