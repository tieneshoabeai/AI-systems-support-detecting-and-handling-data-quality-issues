import type { ApiClient } from '../api/api.types'
import type { UploadDraftPort } from '../datasets/upload-draft.types'
import type { OfflineWritePort } from './offline-write.types'

export type OfflineStatus = {
  offline: boolean; savedAt: number | null; storageError: string | null
  reason?: 'network' | 'backend'
  fallback?: { path: string; status?: number }
}
export type OfflineDataPort = {
  getSnapshot(this: void): OfflineStatus
  subscribe(this: void, listener: () => void): () => void
  reconnect(this: void): void
  useSavedData(this: void): void
  listReports(this: void, projectId: string): Promise<{ reportId: string; savedAt: number }[]>
}
export type OfflineMigrationStatus = {
  state: 'idle' | 'migrating' | 'complete' | 'attention' | 'error'
  conflicts: number
  unlistedNamespaces: number
  message: string | null
}
export type OfflineMigrationPort = {
  getSnapshot(this: void): OfflineMigrationStatus
  subscribe(this: void, listener: () => void): () => void
}
export type LocalDataServices = {
  drafts: UploadDraftPort
  writes?: OfflineWritePort
  offline: OfflineDataPort
  migration: OfflineMigrationPort
  wrapApi(api: ApiClient): ApiClient
}
