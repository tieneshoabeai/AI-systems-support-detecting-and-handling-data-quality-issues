import axios from 'axios'
import type { AxiosAdapter } from 'axios'
import { parseApiConfig } from '../configs/api.config'
import type { ApiClient, ApiEnvelope, ApiRequestOptions, ApiTarget, TokenReader } from '../types'
import type { OfflineWritePort } from '../types/offline/offline-write.types'
import { ApiError, isRecord, normalizeApiError } from './api-error'
import { API_TARGET_SWITCH_CANCEL_CODE, getApiTargetManager } from './api-target-manager'
import type { ApiTargetManager, ApiTargetRequestLease } from './api-target-manager'

type AxiosClientOptions = {
  /** Test transport override. Runtime clients use the shared ApiTargetManager. */
  baseUrl?: string
  readToken?: TokenReader
  adapter?: AxiosAdapter
  apiTargetManager?: ApiTargetManager
  /** Only coordinator-owned profile/revoke calls may bypass the session recovery gate. */
  allowWhenSessionUnverified?: boolean
  /** Internal candidate target used only while verifying a new route. */
  targetOverride?: ApiTarget
  /** Queue-first write path; it never falls back to sending when enqueue is unavailable. */
  deferredWrites?: Pick<OfflineWritePort, 'accepts' | 'enqueue'>
}

const resolveApiPath = (path: string, baseUrl: string, prefix: string): string => {
  const invalidPath = () => new ApiError({
    kind: 'config',
    message: 'Đường dẫn request phải nằm dưới API prefix đã cấu hình.',
  })

  if (
    path.trim() !== path
    || path.length === 0
    || path.startsWith('//')
    || path.includes('\\')
    || /^[a-z][a-z\d+.-]*:/i.test(path)
  ) {
    throw invalidPath()
  }

  const base = new URL(`${baseUrl}/`)
  const prefixRoot = prefix.replace(/\/+$/, '')
  const prefixBoundary = `${prefixRoot}/`
  const relativePath = path.replace(/^\//, '')
  let target: URL

  try {
    target = new URL(relativePath, base)
  } catch {
    throw invalidPath()
  }

  if (
    relativePath.length === 0
    || target.origin !== base.origin
    || (target.pathname !== prefixRoot && !target.pathname.startsWith(prefixBoundary))
    || target.hash !== ''
  ) {
    throw invalidPath()
  }

  return target.href
}

const linkSignals = (external?: AbortSignal, manager?: AbortSignal) => {
  if (!external && !manager) return { signal: undefined, dispose: () => {} }
  if (!external) return { signal: manager, dispose: () => {} }
  if (!manager) return { signal: external, dispose: () => {} }

  const controller = new AbortController()
  const forward = (source: AbortSignal) => {
    if (!controller.signal.aborted) controller.abort(source.reason)
  }
  const onExternalAbort = () => forward(external)
  const onManagerAbort = () => forward(manager)
  if (external.aborted) forward(external)
  else external.addEventListener('abort', onExternalAbort, { once: true })
  if (manager.aborted) forward(manager)
  else manager.addEventListener('abort', onManagerAbort, { once: true })
  return {
    signal: controller.signal,
    dispose: () => {
      external.removeEventListener('abort', onExternalAbort)
      manager.removeEventListener('abort', onManagerAbort)
    },
  }
}

const targetSwitchCancelled = () => new ApiError({
  kind: 'cancelled',
  code: API_TARGET_SWITCH_CANCEL_CODE,
  message: 'Yêu cầu cũ đã bị hủy khi chuyển API URL.',
})

const unwrapEnvelope = <T>(value: unknown): T => {
  if (
    !isRecord(value)
    || value['success'] !== true
    || !Object.hasOwn(value, 'data')
    || (value['meta'] !== undefined && !isRecord(value['meta']))
  ) {
    throw new ApiError({
      kind: 'invalid-response',
      message: 'Phản hồi API không đúng cấu trúc success/data.',
    })
  }

  return (value as ApiEnvelope<T>).data
}

export const createAxiosClient = (options: AxiosClientOptions = {}): ApiClient => {
  const fixedConfig = options.baseUrl === undefined ? null : parseApiConfig(options.baseUrl)
  const manager = options.apiTargetManager
    ?? (fixedConfig === null || options.targetOverride !== undefined ? getApiTargetManager() : null)
  if (fixedConfig === null && options.targetOverride === undefined) manager?.getApiConfig()
  if (options.targetOverride !== undefined) manager?.getApiConfig(options.targetOverride)
  const fixedPrefix = fixedConfig === null ? null : new URL(fixedConfig.baseUrl).pathname.replace(/\/+$/, '')
  const instance = axios.create({ ...(options.adapter === undefined ? {} : { adapter: options.adapter }) })

  return {
    async request<T>(request: ApiRequestOptions): Promise<T> {
      let lease: ApiTargetRequestLease | undefined
      let linked = { signal: request.signal, dispose: () => {} }
      try {
        if (request.auth !== 'public' && request.auth !== 'session') {
          throw new ApiError({ kind: 'config', message: 'Request chưa khai báo chế độ xác thực.' })
        }

        if (request.deferredDraftId !== undefined && request.deferIfOffline !== true) {
          throw new ApiError({ kind: 'config', message: 'Draft upload chỉ được truyền cùng deferIfOffline.' })
        }
        if (request.deferIfOffline === true) {
          if (request.auth !== 'session' || !options.deferredWrites) {
            throw new ApiError({ kind: 'config', code: 'OFFLINE_QUEUE_UNAVAILABLE', message: 'Không thể lưu request chờ đồng bộ; chưa gửi request lên backend.' })
          }
          if (!options.deferredWrites.accepts(request)) {
            throw new ApiError({ kind: 'config', code: 'OFFLINE_WRITE_NOT_ALLOWLISTED', message: 'Request này không thuộc allowlist offline; chưa gửi request lên backend.' })
          }
          if (request.signal?.aborted) throw new ApiError({ kind: 'cancelled', message: 'Đã hủy trước khi lưu request vào queue.' })
          return await options.deferredWrites.enqueue(request) as T
        }

        if (fixedConfig === null && options.targetOverride === undefined) {
          lease = manager?.beginRequest({
            requiresSession: request.auth === 'session',
            ...(options.allowWhenSessionUnverified === undefined
              ? {} : { allowWhenSessionUnverified: options.allowWhenSessionUnverified }),
          })
        }
        const target = options.targetOverride ?? lease?.target
        const config = fixedConfig ?? manager?.getApiConfig(target)
        if (!config) throw new ApiError({ kind: 'config', message: 'API target chưa được khởi tạo.' })
        const prefix = fixedPrefix ?? target?.prefix ?? ''
        linked = linkSignals(request.signal, lease?.signal)
        const method = request.method ?? 'GET'
        const url = request.auth === 'public' && method === 'GET' && (request.path === '/health' || request.path === '/health/ready')
          ? new URL(request.path, new URL(config.baseUrl).origin).href
          : resolveApiPath(request.path, config.baseUrl, prefix)
        const timeout = request.timeoutMs ?? config.timeoutMs

        if (!Number.isFinite(timeout) || timeout <= 0) {
          throw new ApiError({ kind: 'config', message: 'Timeout request phải là số dương hữu hạn.' })
        }

        if (linked.signal?.aborted) {
          if (lease?.wasCancelledForTargetSwitch()) throw targetSwitchCancelled()
          throw new ApiError({ kind: 'cancelled', message: 'Yêu cầu đã bị hủy ở phía client.' })
        }

        const headers: Record<string, string> = {}
        if (request.auth === 'session') {
          const token = options.readToken?.()
          if (typeof token !== 'string' || token.trim().length === 0) {
            throw new ApiError({ kind: 'session', code: 'SESSION_NOT_READY', message: 'Yêu cầu đăng nhập đang chờ phiên được xác nhận lại.' })
          }
          headers['Authorization'] = `Bearer ${token}`
        }

        const response = await instance.request<unknown>({
          url,
          method,
          data: request.data,
          ...(request.params === undefined ? {} : { params: request.params }),
          ...(linked.signal === undefined ? {} : { signal: linked.signal }),
          ...(request.responseType === undefined ? {} : { responseType: request.responseType }),
          timeout,
          baseURL: config.baseUrl,
          headers,
        })

        if (lease?.wasCancelledForTargetSwitch()) throw targetSwitchCancelled()
        if (request.includeStatus) return { status: response.status, data: response.data } as T
        if (response.status === 204) {
          if (request.requireBody) {
            throw new ApiError({ kind: 'invalid-response', status: 204, message: 'API trả về 204 nhưng thao tác này cần dữ liệu phản hồi.' })
          }
          return undefined as T
        }
        if (request.responseType === 'blob') return response.data as T
        return unwrapEnvelope<T>(response.data)
      } catch (error) {
        if (lease?.wasCancelledForTargetSwitch()) throw targetSwitchCancelled()
        const normalized = normalizeApiError(error)
        if (options.targetOverride === undefined) manager?.reportTransportFailure(normalized)
        throw normalized
      } finally {
        linked.dispose()
        lease?.release()
      }
    },
  }
}
