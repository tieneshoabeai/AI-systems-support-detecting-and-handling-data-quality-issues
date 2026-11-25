import type { ApiClient } from '../api/api.types'
import type { UploadDraftPort } from '../datasets/upload-draft.types'
import type { OfflineWritePort } from './offline-write.types'

export type OfflineStatus = { offline: boolean; savedAt: number | null; storageError: string | null }
export type OfflineDataPort = {
  getSnapshot(this: void): OfflineStatus
  subscribe(this: void, listener: () => void): () => void
  reconnect(this: void): void
  useSavedData(this: void): void
  listReports(this: void, projectId: string): Promise<{ reportId: string; savedAt: number }[]>
}
export type LocalDataServices = {
  drafts: UploadDraftPort
  writes?: OfflineWritePort
  offline: OfflineDataPort
  wrapApi(api: ApiClient): ApiClient
}
