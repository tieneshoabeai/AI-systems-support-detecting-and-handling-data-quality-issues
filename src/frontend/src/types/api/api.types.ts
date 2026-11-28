export type ApiConfig = {
  readonly baseUrl: string
  readonly timeoutMs: number
}

export type ApiTarget = {
  readonly baseUrl: string
  readonly prefix: string
  readonly environmentId: string
  readonly revision: number
}

export type ApiTargetInput = Pick<ApiTarget, 'baseUrl' | 'prefix' | 'environmentId'>

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
  retryAfterMs?: number
}

export type TokenReader = () => string | null

export type RequestOptions = {
  auth: 'public' | 'session'
  signal?: AbortSignal
  timeoutMs?: number
  /** Persist an allowlisted write before any network attempt and return its queue receipt. */
  deferIfOffline?: boolean
  /** Local upload draft to retain until the queued server ACK is reconciled. */
  deferredDraftId?: string
}

export type ApiRequestOptions = RequestOptions & (
  | { responseType?: 'blob'; includeStatus?: false; requireBody?: boolean }
  | { responseType: 'blob'; includeStatus: true; requireBody?: never }
) & {
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: unknown
  params?: Record<string, string | number | boolean | null | undefined>
}

export type ApiResponseWithStatus<T> = { status: number; data: T }

export type ApiClient = {
  request<T>(options: ApiRequestOptions): Promise<T>
}
