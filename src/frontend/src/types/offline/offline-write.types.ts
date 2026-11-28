import type { ApiRequestOptions } from '../api/api.types'

export type OfflineWriteCommand =
  | { kind: 'patch'; resource: 'workspaces' | 'projects'; resourceId: string; fields: { name?: string; description?: string }; expectedVersion: number }
  | { kind: 'delete'; resource: 'workspaces' | 'projects' | 'datasets'; resourceId: string }
  | { kind: 'upload'; resource: 'projects'; resourceId: string; file: Blob; fileName: string; mimeType: string; hash: string; draftId: string }

export type OfflineWriteState = 'queued' | 'sending' | 'uncertain' | 'blocked' | 'confirmed'

export type OfflineWrite = {
  sequence?: number
  id: string
  accountId: string
  namespace: string
  command: OfflineWriteCommand
  state: OfflineWriteState
  label: string
  createdAt: number
  bytes: number
  attempts: number
  error?: string
  response?: unknown
}

export type OfflineWriteSummary = Pick<OfflineWrite, 'id' | 'state' | 'label' | 'error' | 'attempts' | 'createdAt'> & {
  fileName?: string
}

export type OfflineWriteStatus = {
  entries: readonly OfflineWriteSummary[]
  syncing: boolean
  revision: number
  error: string | null
}

export type OfflineWritePort = {
  getSnapshot(this: void): OfflineWriteStatus
  subscribe(this: void, listener: () => void): () => void
  accepts(this: void, request: ApiRequestOptions): boolean
  enqueue(this: void, request: ApiRequestOptions, uncertain?: boolean): Promise<OfflineWriteReceipt>
  sync(this: void): Promise<void>
  cancel(this: void, id: string, expectedState?: 'queued' | 'confirmed'): Promise<void>
  recheck(this: void, id: string): Promise<void>
}

export type OfflineWriteReceipt = {
  kind: 'offline-write-receipt'
  queueId: string
  state: OfflineWriteState
  createdAt: number
}
