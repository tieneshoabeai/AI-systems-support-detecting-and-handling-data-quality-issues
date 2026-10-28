export type ApiConfig = {
  readonly baseUrl: string
  readonly timeoutMs: number
}

export type ApiEnvelope<T> = {
  success: true
  data: T
  meta?: Record<string, unknown>
}

export type AppErrorKind =
  | 'config'
  | 'session'
  | 'storage'
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'http'
  | 'invalid-response'

export type AppError = {
  kind: AppErrorKind
  message: string
  status?: number
  code?: string
  fieldErrors?: Record<string, string[]>
}

export type TokenReader = () => string | null

export type RequestOptions = {
  auth: 'public' | 'session'
  signal?: AbortSignal
  timeoutMs?: number
}

export type ApiRequestOptions = RequestOptions & {
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: unknown
  params?: Record<string, string | number | boolean | null | undefined>
}

export type ApiClient = {
  request<T>(options: ApiRequestOptions): Promise<T>
}
