import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'
import type { DraftAccess, DraftAccessPort } from '../../types/datasets/upload-draft.types'
import type { OfflineStatus } from '../../types/offline/offline.types'
import { ApiError, isRecord, normalizeApiError } from '../../lib/api-error'
import type { createOfflineReadRepository } from '../../repositories/offline/offline-read.repository'
import type { OfflineWritePort } from '../../types/offline/offline-write.types'
import { QueuedWriteError } from './queued-write-error'

const readable = (request: ApiRequestOptions) => {
  const method = request.method ?? 'GET'
  if (request.auth !== 'session') return false
  if (method === 'POST') return /^\/datasets\/[^/]+\/records\/query$/.test(request.path)
  if (method !== 'GET') return false
  return /^\/(workspaces|projects|datasets)(\/|$)/.test(request.path)
    || /^\/issues(\/|$)/.test(request.path) || /^\/analyses\/[^/]+\/(findings\/[^/]+\/)?feedback$/.test(request.path)
    || /^\/notifications(\/|$)/.test(request.path) || request.path === '/users/me' || request.path === '/overview/workspaces'
}
const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
  : isRecord(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
const keyFor = (request: ApiRequestOptions) => JSON.stringify(stable({
  path: request.path, method: request.method ?? 'GET', params: request.params,
  data: request.data, responseType: request.responseType, includeStatus: request.includeStatus,
}))
const payloadBytes = (value: unknown) => value instanceof Blob ? value.size
  : isRecord(value) && value['data'] instanceof Blob ? value['data'].size
    : new TextEncoder().encode(JSON.stringify(value)).byteLength
const noSavedCopy = () => new ApiError({ kind: 'network', code: 'OFFLINE_NOT_SAVED', message: 'Dữ liệu này chưa được lưu trên thiết bị. Hãy kết nối mạng để tải trước.' })

export function createOfflineDataService(options: {
  cache: ReturnType<typeof createOfflineReadRepository>; access: DraftAccessPort
  writes?: () => OfflineWritePort | undefined
  checkConnection?: (signal: AbortSignal) => Promise<boolean>
  recoveryIntervalMs?: number
}) {
  const { cache, access } = options
  const browserOnline = () => typeof navigator === 'undefined' || navigator.onLine
  let snapshot: OfflineStatus = { offline: !browserOnline(), savedAt: null, storageError: null, ...(!browserOnline() ? { reason: 'network' as const } : {}) }
  const listeners = new Set<() => void>()
  let disposed = false
  let successfulResponses = 0
  let probe: Promise<boolean> | undefined
  let probeController: AbortController | undefined
  const publish = (next: OfflineStatus) => {
    if (disposed || (next.offline === snapshot.offline && next.savedAt === snapshot.savedAt && next.storageError === snapshot.storageError
      && next.reason === snapshot.reason && next.fallback === snapshot.fallback)) return
    snapshot = next; listeners.forEach(listener => listener())
  }
  const activateSavedData = (reason: 'network' | 'backend') => {
    if (!snapshot.offline || snapshot.reason !== reason) publish({ ...snapshot, offline: true, reason, savedAt: null })
  }
  const confirmConnection = () => {
    if (!browserOnline() || disposed) return
    publish({ offline: false, savedAt: null, storageError: snapshot.storageError })
  }
  const storageFailure = () => publish({ ...snapshot, storageError: 'Chưa lưu được dữ liệu ngoại tuyến. Kiểm tra dung lượng và quyền lưu trữ của trình duyệt.' })
  const check = (captured: DraftAccess | null, signal?: AbortSignal) => {
    if (signal?.aborted) throw new ApiError({ kind: 'cancelled', message: 'Yêu cầu đã bị hủy.' })
    const scope = access.read()
    if (disposed || !captured || !scope || captured.accountId !== scope.accountId || captured.generation !== scope.generation) {
      throw new ApiError({ kind: 'session', message: 'Phiên dữ liệu đã thay đổi.' })
    }
  }
  const probeConnection = (): Promise<boolean> => {
    if (!options.checkConnection || !browserOnline() || disposed || !access.read()) return Promise.resolve(false)
    if (probe) return probe
    const captured = access.read()
    const controller = new AbortController()
    probeController = controller
    probe = Promise.resolve().then(async () => {
      const connected = await options.checkConnection!(controller.signal)
      check(captured, controller.signal)
      return connected && browserOnline()
    }).catch(() => false).finally(() => {
      if (probeController === controller) probeController = undefined
      probe = undefined
    })
    return probe
  }
  const recover = async () => {
    if (!snapshot.offline || !options.checkConnection || !browserOnline()) return
    if (await probeConnection()) confirmConnection()
  }
  const reconnect = () => {
    // A browser online event or a button click is not evidence that BE recovered.
    if (browserOnline() && snapshot.offline && snapshot.reason === 'network') publish({ ...snapshot, reason: 'backend' })
    if (options.checkConnection) void recover()
    else confirmConnection()
  }
  const useSavedData = () => {
    const reason = browserOnline() ? 'backend' : 'network'
    const entering = !snapshot.offline || snapshot.reason !== reason
    activateSavedData(reason)
    if (entering) void recover()
  }
  const networkLost = () => { probeController?.abort(); activateSavedData('network') }
  const timer = options.checkConnection ? setInterval(() => { void recover() }, options.recoveryIntervalMs ?? 10000) : undefined
  let lastAccount = access.read()?.accountId
  let lastGeneration = access.read()?.generation
  const unsubscribeAccess = access.subscribe(() => {
    const scope = access.read()
    const account = scope?.accountId
    if (lastAccount !== account || lastGeneration !== scope?.generation) probeController?.abort()
    if (lastAccount && account !== lastAccount) void cache.clearAccount(lastAccount).catch(storageFailure)
    if (account !== lastAccount) {
      publish({ offline: !browserOnline(), savedAt: null, storageError: snapshot.storageError, ...(!browserOnline() ? { reason: 'network' as const } : {}) })
    }
    lastAccount = account
    lastGeneration = scope?.generation
    void recover()
  })
  if (typeof window !== 'undefined') {
    window.addEventListener('offline', networkLost)
    window.addEventListener('online', reconnect)
  }
  const wrapApi = (api: ApiClient): ApiClient => ({
    async request<T>(request: ApiRequestOptions): Promise<T> {
      const captured = access.read()
      const successesAtStart = successfulResponses
      check(captured, request.signal)
      const canCache = readable(request)
      const writes = options.writes?.()
      const defer = writes?.accepts(request) === true
      const method = request.method ?? 'GET'
      const key = keyFor(request)
      // Persist opted-in writes before any network I/O. A server outage while the
      // browser is still online must keep an unsent upload eligible for automatic retry.
      if (defer && writes) throw new QueuedWriteError(await writes.enqueue(request))
      const cached = async (fallback?: OfflineStatus['fallback'], missingError?: Error): Promise<T> => {
        check(captured, request.signal)
        const entry = await cache.read(key).catch(error => {
          if (error instanceof ApiError && error.kind === 'session') throw error
          storageFailure(); return undefined
        })
        check(captured, request.signal)
        if (!entry) throw missingError ?? noSavedCopy()
        publish({ ...snapshot, savedAt: snapshot.savedAt === null ? entry.savedAt : Math.min(snapshot.savedAt, entry.savedAt), ...(fallback ? { fallback } : {}) })
        return entry.payload as T
      }
      if (snapshot.offline) {
        if (canCache) return cached()
        if (method !== 'GET') throw new ApiError({ kind: 'network', code: 'OFFLINE_READ_ONLY', message: 'Đang xem dữ liệu đã lưu. Kết nối lại để thay đổi dữ liệu hoặc chạy phân tích.' })
        throw noSavedCopy()
      }
      let value: T
      try { value = await api.request<T>(request) }
      catch (error) {
        check(captured, request.signal)
        const failure = normalizeApiError(error)
        if (canCache && failure.kind === 'http' && (failure.status ?? 0) >= 500) {
          // An endpoint returning HTTP 5xx is reachable. Use only its saved copy;
          // never disable analysis or unrelated APIs across the application.
          return cached({ path: request.path, ...(failure.status ? { status: failure.status } : {}) }, failure)
        }
        if (canCache && (failure.kind === 'network' || failure.kind === 'timeout')) {
          const reachable = successesAtStart !== successfulResponses || await probeConnection()
          check(captured, request.signal)
          // A late timeout must not override a newer successful API response.
          if (!reachable && successesAtStart === successfulResponses) activateSavedData(browserOnline() ? 'backend' : 'network')
          return cached({ path: request.path })
        }
        if (canCache && [401, 403, 404].includes(failure.status ?? 0)) {
          await (failure.status === 404 ? cache.remove(key) : cache.clear()).catch(storageFailure)
        }
        throw error
      }
      check(captured, request.signal)
      successfulResponses++
      if (snapshot.offline && browserOnline()) confirmConnection()
      else if (snapshot.fallback?.path === request.path) {
        const next = { ...snapshot }
        delete next.fallback
        publish(next)
      }
      try {
        if (canCache) {
          // HTTP 202 is a job status, never a saved PDF.
          if (request.includeStatus && (!isRecord(value) || value['status'] !== 200)) return value
          if (request.includeStatus && /\/report\/[^/]+\/file$/.test(request.path)
            && (!isRecord(value) || !(value['data'] instanceof Blob) || await value['data'].slice(0, 5).text() !== '%PDF-')) return value
          let payload: unknown = value
          if (request.path === '/users/me' && isRecord(value)) {
            const fields = ['id', 'email', 'firstName', 'lastName', 'role', 'status', 'notificationsEnabled', 'phone', 'bio']
            payload = Object.fromEntries(fields.filter(field => Object.hasOwn(value, field)).map(field => [field, value[field]]))
          }
          await cache.save(key, payload, payloadBytes(payload))
        } else if (method === 'DELETE') await cache.removeResource(request.path)
        else if (method === 'POST' && /^\/projects\/[^/]+\/analysis$/.test(request.path) && isRecord(value) && typeof value['analysisRunId'] === 'string') {
          const resultKey = keyFor({ path: `${request.path}/result`, method: 'GET', auth: 'session' })
          await cache.save(resultKey, value, payloadBytes(value))
        }
      } catch (error) {
        if (error instanceof ApiError && error.kind === 'session') throw error
        storageFailure() // A full disk must not turn an acknowledged server write into a failed write.
      }
      check(captured, request.signal)
      return value
    },
  })
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    reconnect, confirmConnection, useSavedData, wrapApi,
    listReports: async (projectId: string) => {
      const prefix = `/projects/${encodeURIComponent(projectId)}/report/`
      const rows = await cache.list()
      return rows.flatMap(row => {
        const key: unknown = JSON.parse(row.key)
        const path = isRecord(key) && typeof key['path'] === 'string' ? key['path'] : ''
        if (!path.startsWith(prefix) || !path.endsWith('/file') || !isRecord(row.payload) || row.payload['status'] !== 200 || !(row.payload['data'] instanceof Blob)) return []
        return [{ reportId: decodeURIComponent(path.slice(prefix.length, -'/file'.length)), savedAt: row.savedAt }]
      }).sort((a, b) => b.savedAt - a.savedAt)
    },
    dispose: () => {
      disposed = true; probeController?.abort(); if (timer !== undefined) clearInterval(timer)
      unsubscribeAccess(); listeners.clear()
      if (typeof window !== 'undefined') {
        window.removeEventListener('offline', networkLost); window.removeEventListener('online', reconnect)
      }
    },
  }
}
