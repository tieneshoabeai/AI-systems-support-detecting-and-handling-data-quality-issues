import type { ApiClient, ApiRequestOptions } from '../api'

export type OfflineRead = {
  accountId: string
  namespace: string
  key: string
  payload: unknown
  savedAt: number
  bytes: number
}

export type OfflineDataFallback = {
  cacheKey: string
  path: string
  savedAt: number
  fallbackAt: number
}

export type OfflineDataCacheMiss = {
  cacheKey: string
  path: string
  at: number
}

export type OfflineDataSnapshot = {
  readonly fallbacks: readonly OfflineDataFallback[]
  readonly cacheMisses: readonly OfflineDataCacheMiss[]
}

export type OfflineCacheHit<T = unknown> = {
  value: T
  savedAt: number
}

export type LocalDataPort = {
  wrapClient(api: ApiClient): ApiClient
  readCached<T>(request: ApiRequestOptions): Promise<OfflineCacheHit<T> | null>
  invalidateResource?(path: string): Promise<void>
  getSnapshot(): OfflineDataSnapshot
  subscribe(listener: () => void): () => void
  resetStatus(): void
}
