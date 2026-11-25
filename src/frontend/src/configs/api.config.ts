import { ApiError } from '../lib/api-error'
import type { ApiConfig } from '../types'

export const DEFAULT_API_TIMEOUT_MS = 30_000

const environmentIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/

export const getApiEnvironmentId = (baseUrl?: string): string => {
  const configured = import.meta.env.VITE_API_ENVIRONMENT_ID?.trim()
  if (configured && !environmentIdPattern.test(configured)) {
    throw new ApiError({ kind: 'config', message: 'VITE_API_ENVIRONMENT_ID chỉ được chứa chữ, số, dấu chấm, gạch dưới và gạch ngang (tối đa 64 ký tự).' })
  }
  // Backward-compatible default. Use the startup script and a stable ID to retain
  // the same local data when a temporary tunnel hostname changes.
  return configured ? `environment:${configured}` : baseUrl ?? getApiConfig().baseUrl
}

const apiBaseFromSwaggerUrl = (value: string): string => {
  let url: URL
  try { url = new URL(value.trim()) } catch { throw new ApiError({ kind: 'config', message: 'Link Swagger không hợp lệ.' }) }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash
    || !/^\/api\/v[0-9]+\/(?:docs|docs-json)\/?$/.test(url.pathname)) {
    throw new ApiError({ kind: 'config', message: 'Link Swagger cần có dạng https://host/api/v1/docs.' })
  }
  return `${url.origin}${url.pathname.replace(/\/(?:docs|docs-json)\/?$/, '')}`
}

export const getOfflineMigrationSources = (current = getApiConfig().baseUrl): string[] => {
  const explicit = (import.meta.env.VITE_API_MIGRATE_FROM ?? '').split(',').map(value => value.trim()).filter(Boolean)
  const normalized = explicit.map(value => value.includes('/docs') ? apiBaseFromSwaggerUrl(value) : parseApiConfig(value).baseUrl)
  return [...new Set([current, ...normalized])].filter(value => value !== getApiEnvironmentId(current))
}

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
  const config = composeApiConfig(import.meta.env.VITE_API_BASE_URL, import.meta.env.VITE_API_PREFIX)
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && new URL(config.baseUrl).protocol !== 'https:') {
    throw new ApiError({ kind: 'config', message: 'Frontend HTTPS cần API HTTPS để tránh bị trình duyệt chặn mixed content.' })
  }
  return config
}
