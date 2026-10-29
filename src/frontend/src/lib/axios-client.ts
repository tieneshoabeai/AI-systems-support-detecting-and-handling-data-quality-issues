import axios from 'axios'
import type { AxiosAdapter } from 'axios'
import { getApiConfig, parseApiConfig } from '../configs/api.config'
import type {
  ApiClient,
  ApiEnvelope,
  ApiRequestOptions,
  TokenReader,
} from '../types/api/api.types'
import { ApiError, isRecord, normalizeApiError } from './api-error'

type AxiosClientOptions = {
  baseUrl?: string
  readToken?: TokenReader
  adapter?: AxiosAdapter
}

const resolveApiPath = (path: string, baseUrl: string): string => {
  const invalidPath = () => new ApiError({
    kind: 'config',
    message: 'Đường dẫn request phải nằm trong API base URL đã cấu hình.',
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
    || !target.pathname.startsWith(base.pathname)
    || target.hash !== ''
  ) {
    throw invalidPath()
  }

  return target.href
}

const unwrapEnvelope = <T>(value: unknown): T => {
  if (
    !isRecord(value)
    || value.success !== true
    || !Object.hasOwn(value, 'data')
    || (value.meta !== undefined && !isRecord(value.meta))
  ) {
    throw new ApiError({
      kind: 'invalid-response',
      message: 'Phản hồi API không đúng cấu trúc success/data.',
    })
  }

  // Chỉ kiểm tra envelope; DTO cụ thể được mapper của từng service kiểm tra.
  return (value as ApiEnvelope<T>).data
}

export const createAxiosClient = (options: AxiosClientOptions = {}): ApiClient => {
  const config = options.baseUrl === undefined
    ? getApiConfig()
    : parseApiConfig(options.baseUrl)
  const instance = axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeoutMs,
    adapter: options.adapter,
  })

  return {
    async request<T>(request: ApiRequestOptions): Promise<T> {
      try {
        if (request.auth !== 'public' && request.auth !== 'session') {
          throw new ApiError({ kind: 'config', message: 'Request chưa khai báo chế độ xác thực.' })
        }

        const url = resolveApiPath(request.path, config.baseUrl)
        const timeout = request.timeoutMs ?? config.timeoutMs

        if (!Number.isFinite(timeout) || timeout <= 0) {
          throw new ApiError({ kind: 'config', message: 'Timeout request phải là số dương hữu hạn.' })
        }

        if (request.signal?.aborted) {
          throw new ApiError({ kind: 'cancelled', message: 'Yêu cầu đã bị hủy ở phía client.' })
        }

        const headers: Record<string, string> = {}

        if (request.auth === 'session') {
          const token = options.readToken?.()

          if (typeof token !== 'string' || token.trim().length === 0) {
            throw new ApiError({
              kind: 'session',
              message: 'Chưa có token của phiên đăng nhập để gửi yêu cầu.',
            })
          }

          headers.Authorization = `Bearer ${token}`
        }

        const response = await instance.request<unknown>({
          url,
          method: request.method ?? 'GET',
          data: request.data,
          params: request.params,
          signal: request.signal,
          timeout,
          headers,
        })

        return unwrapEnvelope<T>(response.data)
      } catch (error) {
        throw normalizeApiError(error)
      }
    },
  }
}
