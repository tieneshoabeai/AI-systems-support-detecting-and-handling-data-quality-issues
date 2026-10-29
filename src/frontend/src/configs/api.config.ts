import { ApiError } from '../lib/api-error'
import type { ApiConfig } from '../types/api/api.types'

export const DEFAULT_API_TIMEOUT_MS = 30_000

export const parseApiConfig = (value: unknown): ApiConfig => {
  const invalidConfig = () => new ApiError({
    kind: 'config',
    message: 'VITE_API_BASE_URL chưa được cấu hình thành URL API HTTP/HTTPS hợp lệ.',
  })

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalidConfig()
  }

  let url: URL

  try {
    url = new URL(value.trim())
  } catch {
    throw invalidConfig()
  }

  if (
    !['http:', 'https:'].includes(url.protocol)
    || url.username !== ''
    || url.password !== ''
    || url.search !== ''
    || url.hash !== ''
  ) {
    throw invalidConfig()
  }

  let segments: string[]

  try {
    segments = url.pathname.split('/').map(decodeURIComponent)
  } catch {
    throw invalidConfig()
  }

  if (segments.some(segment => segment === 'docs' || segment === 'docs-json')) {
    throw invalidConfig()
  }

  return {
    baseUrl: url.href.replace(/\/+$/, ''),
    timeoutMs: DEFAULT_API_TIMEOUT_MS,
  }
}

// Env tách địa chỉ server và prefix; client chỉ nhận URL API đã ghép.
export const composeApiConfig = (baseValue: unknown, prefixValue: unknown): ApiConfig => {
  const config = parseApiConfig(baseValue)
  const server = new URL(config.baseUrl)

  if (server.pathname !== '/') {
    throw new ApiError({
      kind: 'config',
      message: 'VITE_API_BASE_URL chỉ chứa địa chỉ server; khai báo đường dẫn ở VITE_API_PREFIX.',
    })
  }

  if (typeof prefixValue !== 'string') {
    throw new ApiError({ kind: 'config', message: 'VITE_API_PREFIX chưa được cấu hình hợp lệ.' })
  }

  const prefix = prefixValue.trim().replace(/^\//, '').replace(/\/$/, '')
  // Chỉ nhận các đoạn đường dẫn đơn giản; chặn URL khác, traversal và query/hash.
  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(prefix)) {
    throw new ApiError({ kind: 'config', message: 'VITE_API_PREFIX phải là đường dẫn API hợp lệ.' })
  }

  return parseApiConfig(`${server.origin}/${prefix}`)
}

// Đọc khi caller tạo client; import file này không chặn UI khởi động.
export const getApiConfig = (): ApiConfig => {
  return composeApiConfig(import.meta.env.VITE_API_BASE_URL, import.meta.env.VITE_API_PREFIX)
}
