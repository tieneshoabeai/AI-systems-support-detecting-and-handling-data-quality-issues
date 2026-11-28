import { ApiError, normalizeApiError, isRecord } from '../../lib/api-error'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'
import type { LocalDataPort, OfflineCacheHit, OfflineDataSnapshot } from '../../types/offline/offline-read.types'

type ReadRequest = ApiRequestOptions & { path: string }

const cacheablePaths = [
  /^\/workspaces$/,
  /^\/workspaces\/[^/]+(?:\/(?:projects|members|overview))?$/,
  /^\/projects$/,
  /^\/projects\/[^/]+(?:\/(?:members|datasets|overview|summary|analysis(?:\/result)?|ai-quality-metrics))?$/,
  /^\/projects\/[^/]+\/report\/[^/]+\/file$/,
  /^\/datasets\/[^/]+(?:\/schema|\/records(?:\/query)?|\/columns\/[^/]+\/stats|\/charts)?$/,
  /^\/issues(?:\/[^/]+)?$/,
  /^\/admin\/issues(?:\/[^/]+)?$/,
  /^\/notifications(?:\/unread-count|\/[^/]+)?$/,
  /^\/users\/me$/,
  /^\/overview\/workspaces$/,
  /^\/analysis\/jobs\/[^/]+$/,
  /^\/analyses\/[^/]+\/feedback$/,
  /^\/analyses\/[^/]+\/findings\/[^/]+\/feedback$/,
]

const normalizePath = (path: string): string | null => {
  if (!path.startsWith('/') || path.includes('?') || path.includes('#') || path.includes('\\')) return null
  try {
    return path.split('/').map((segment, index) => {
      if (index === 0 || segment === '') return segment
      return encodeURIComponent(decodeURIComponent(segment))
    }).join('/').replace(/\/$/, '') || '/'
  } catch {
    return null
  }
}

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(item => item === undefined ? null : stableValue(item))
  if (value instanceof Date) return value.toISOString()
  if (typeof Blob !== 'undefined' && value instanceof Blob) return { blobType: value.type, blobSize: value.size }
  if (isRecord(value)) {
    return Object.fromEntries(Object.keys(value).sort()
      .filter(key => value[key] !== undefined)
      .map(key => [key, stableValue(value[key])]))
  }
  return value
}

const requestKey = (request: ReadRequest): string | null => {
  const path = normalizePath(request.path)
  if (!path) return null
  const method = request.method ?? 'GET'
  const cacheable = request.auth === 'session' && cacheablePaths.some(pattern => pattern.test(path))
    && (method === 'GET' || (method === 'POST' && /^\/datasets\/[^/]+\/records\/query$/.test(path)))
  if (!cacheable) return null
  return JSON.stringify({
    path,
    method,
    params: stableValue(request.params ?? {}),
    ...(method === 'POST' ? { data: stableValue(request.data) } : {}),
    responseType: request.responseType ?? 'json',
    includeStatus: request.includeStatus === true,
  }) ?? null
}

const payloadBytes = (value: unknown, seen = new WeakSet<object>()): number => {
  if (typeof Blob !== 'undefined' && value instanceof Blob) return value.size
  if (value instanceof ArrayBuffer) return value.byteLength
  if (ArrayBuffer.isView(value)) return value.byteLength
  if (typeof value === 'string') return value.length * 2
  if (Array.isArray(value)) {
    if (seen.has(value)) return 0
    seen.add(value)
    return value.reduce((sum, item) => sum + payloadBytes(item, seen), 0)
  }
  if (isRecord(value)) {
    if (seen.has(value)) return 0
    seen.add(value)
    return Object.entries(value).reduce((sum, [key, item]) => sum + key.length * 2 + payloadBytes(item, seen), 0)
  }
  return value === undefined ? 0 : 16
}

const isCacheMissEligible = (error: ReturnType<typeof normalizeApiError>) =>
  error.kind === 'network' || error.kind === 'timeout'
  || (error.kind === 'http' && (error.status ?? 0) >= 500)
  || (error.kind === 'session' && error.code === 'SESSION_NOT_READY')

const pathFromKey = (key: string): string | null => {
  try {
    const value: unknown = JSON.parse(key)
    return isRecord(value) && typeof value['path'] === 'string' ? value['path'] : null
  } catch {
    return null
  }
}

const pathForCacheKey = (key: string) => pathFromKey(key) ?? 'dữ liệu đã lưu'

const relatedPrefix = (path: string): string | null => {
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'admin' && parts[1] === 'issues') return parts[2] ? `/issues/${parts[2]}` : '/admin/issues'
  if (parts[0] === 'notifications') return parts[1] ? `/notifications/${parts[1]}` : '/notifications'
  if (['workspaces', 'projects', 'issues'].includes(parts[0] ?? '') && !parts[1]) return `/${parts[0]}`
  if (['workspaces', 'projects', 'datasets', 'issues', 'notifications', 'analyses', 'analysis'].includes(parts[0] ?? '') && parts[1]) {
    if (parts[0] === 'analysis' && parts[1] === 'jobs' && parts[2]) return `/analysis/jobs/${parts[2]}`
    if (parts[0] === 'analysis') return `/analysis/${parts[1]}`
    if (parts[0] === 'analyses') return `/analyses/${parts[1]}`
    if (parts[0] === 'projects' || parts[0] === 'workspaces') return `/${parts[0]}/${parts[1]}`
    return `/${parts[0]}/${parts[1]}`
  }
  if (parts[0] === 'issues') return parts[1] ? `/issues/${parts[1]}` : '/issues'
  return null
}

export function createOfflineDataService(options: {
  reads: {
    read(key: string): Promise<{ payload: unknown; savedAt: number } | undefined>
    save(key: string, payload: unknown, bytes: number): Promise<number>
    remove(key: string): Promise<void>
    removeResource(path: string): Promise<void>
    clear(): Promise<void>
    list(): Promise<Array<{ key: string }>>
  }
  now?: () => number
}): LocalDataPort {
  const now = options.now ?? Date.now
  const fallbacks = new Map<string, { cacheKey: string; path: string; savedAt: number; fallbackAt: number }>()
  const cacheMisses = new Map<string, { cacheKey: string; path: string; at: number }>()
  const listeners = new Set<() => void>()
  let snapshot: OfflineDataSnapshot = Object.freeze({ fallbacks: [], cacheMisses: [] })

  const publish = () => {
    snapshot = Object.freeze({
      fallbacks: Object.freeze([...fallbacks.values()].sort((left, right) => right.fallbackAt - left.fallbackAt)),
      cacheMisses: Object.freeze([...cacheMisses.values()].sort((left, right) => right.at - left.at)),
    })
    listeners.forEach(listener => { try { listener() } catch { /* Subscribers cannot interrupt cache operations. */ } })
  }

  const readCached = async <T,>(request: ApiRequestOptions): Promise<OfflineCacheHit<T> | null> => {
    const key = requestKey(request)
    if (!key) return null
    const cached = await options.reads.read(key)
    return cached ? { value: cached.payload as T, savedAt: cached.savedAt } : null
  }

  const removeRelated = async (request: ReadRequest, key: string) => {
    const path = normalizePath(request.path)
    if (key) {
      try { await options.reads.remove(key) } catch { /* Keep the original API response as the visible error. */ }
      fallbacks.delete(key)
      cacheMisses.delete(key)
    }
    if (!path) { publish(); return }
    const prefix = relatedPrefix(path)
    if (!prefix) { publish(); return }
    try {
      const rows = await options.reads.list()
      for (const row of rows) {
        const cachedPath = pathFromKey(row.key)
        if (cachedPath && (cachedPath === prefix || cachedPath.startsWith(`${prefix}/`))) {
          await options.reads.remove(row.key).catch(() => {})
          fallbacks.delete(row.key)
          cacheMisses.delete(row.key)
        }
      }
      await options.reads.removeResource(prefix)
    } catch { /* Invalidating cache never masks the API's 401/403/404 response. */ }
    const invalidatedCollections = path.startsWith('/workspaces') ? ['/workspaces', '/projects']
      : path.startsWith('/projects') || path.startsWith('/datasets/') ? ['/projects']
        : path.startsWith('/issues') ? ['/issues', '/admin/issues'] : []
    for (const [cachedKey, item] of fallbacks) {
      if (invalidatedCollections.includes(item.path)) fallbacks.delete(cachedKey)
    }
    for (const [cachedKey, item] of cacheMisses) {
      if (invalidatedCollections.includes(item.path)) cacheMisses.delete(cachedKey)
    }
    if (path.startsWith('/notifications')) {
      for (const row of await options.reads.list().catch(() => [])) {
        const cachedPath = pathFromKey(row.key)
        if (cachedPath === '/notifications' || cachedPath === '/notifications/unread-count') {
          await options.reads.remove(row.key).catch(() => {})
          fallbacks.delete(row.key)
          cacheMisses.delete(row.key)
        }
      }
    }
    if (path.startsWith('/admin/issues')) {
      for (const row of await options.reads.list().catch(() => [])) {
        const cachedPath = pathFromKey(row.key)
        if (cachedPath === '/admin/issues' || cachedPath?.startsWith('/admin/issues/')) {
          await options.reads.remove(row.key).catch(() => {})
          fallbacks.delete(row.key)
          cacheMisses.delete(row.key)
        }
      }
    }
    publish()
  }

  const wrappedClient = (api: ApiClient): ApiClient => ({
    async request<T>(request: ApiRequestOptions): Promise<T> {
      const key = requestKey(request)
      if (!key) {
        try { return await api.request<T>(request) } catch (cause) {
          const error = normalizeApiError(cause)
          if (error.status === 401) {
            try { await options.reads.clear() } catch { /* Keep the original API response. */ }
            fallbacks.clear()
            cacheMisses.clear()
            publish()
          } else if (error.status === 403 || error.status === 404) {
            await removeRelated(request, '')
          }
          throw error
        }
      }
      try {
        const value = await api.request<T>(request)
        const status = request.includeStatus && isRecord(value) && typeof value['status'] === 'number'
          ? value['status'] : 200
        if (status === 200) {
          await options.reads.save(key, value, payloadBytes(value)).catch(() => 0)
          fallbacks.delete(key)
          cacheMisses.delete(key)
          publish()
        }
        return value
      } catch (cause) {
        const error = normalizeApiError(cause)
        if (error.status === 401) {
          try { await options.reads.clear() } catch { /* Session storage/cache errors do not replace the API error. */ }
          fallbacks.clear()
          cacheMisses.clear()
          publish()
        } else if (error.status === 403 || error.status === 404) {
          await removeRelated(request, key)
        }

        if (!isCacheMissEligible(error)) throw error
        let cached: { payload: unknown; savedAt: number } | undefined
        try { cached = await options.reads.read(key) } catch { cached = undefined }
        if (cached) {
          fallbacks.set(key, { cacheKey: key, path: pathForCacheKey(key), savedAt: cached.savedAt, fallbackAt: now() })
          cacheMisses.delete(key)
          publish()
          return cached.payload as T
        }
        cacheMisses.set(key, { cacheKey: key, path: pathForCacheKey(key), at: now() })
        while (cacheMisses.size > 20) {
          const oldest = [...cacheMisses.entries()].sort((left, right) => left[1].at - right[1].at)[0]
          if (!oldest) break
          cacheMisses.delete(oldest[0])
        }
        publish()
        throw new ApiError({ kind: error.kind, ...(error.status === undefined ? {} : { status: error.status }),
          code: 'OFFLINE_CACHE_MISS', message: 'Chưa có bản lưu offline cho dữ liệu này.' })
      }
    },
  })

  return {
    wrapClient: wrappedClient,
    readCached,
    invalidateResource: async path => {
      if (!normalizePath(path)) return
      await removeRelated({ path, auth: 'session' }, '')
    },
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    resetStatus: () => { fallbacks.clear(); cacheMisses.clear(); publish() },
  }
}
