export type DraftAccess = {
  accountId: string
  generation: number
  expiresAtMs: number
}

// App runtime cấp port này; view không truyền accountId tùy ý vào repository.
export type DraftAccessPort = {
  read(): DraftAccess | null
  subscribe(listener: () => void): () => void
}

export type UploadDraftState = 'pending' | 'queued' | 'uploading' | 'acknowledged' | 'uploaded'

export type WizardDraftMember = { id: string; name: string; email: string; role: string }

export type UploadDraft = {
  id: string
  accountId: string
  kind?: 'project-upload' | 'project-wizard'
  projectId: string | null
  workspaceId?: string
  projectName?: string
  projectDescription?: string
  selectedMembers?: WizardDraftMember[]
  fileName: string
  mimeType: string
  sizeBytes: number
  lastModified: number
  createdAtMs: number
  fileHash?: string
  status: UploadDraftState
  queueId?: string
  datasetId?: string
}

export type SaveUploadDraft = {
  projectId?: string
  workspaceId?: string
  projectName?: string
  projectDescription?: string
  selectedMembers?: WizardDraftMember[]
  file: File
}

// Chỉ caller đã validate ACK backend mới gọi confirmUploaded.
// Đây không phải endpoint hoặc cơ chế chống upload trùng.
export type UploadConfirmation = {
  accountId: string
  projectId: string
  datasetId: string
  fileName: string
  sizeBytes: number
  fileHash: string
  queueId?: string
  queueHash?: string
  serverHash?: string
  retainMetadata?: boolean
}

export type DraftCleanupResult = { cleaned: boolean; metadataRetained?: boolean }

export type UploadDraftPort = {
  save(input: SaveUploadDraft): Promise<UploadDraft>
  list(): Promise<UploadDraft[]>
  readFile(id: string): Promise<Blob>
  remove(id: string): Promise<void>
  updateWizardMetadata(id: string, input: Pick<SaveUploadDraft, 'workspaceId' | 'projectName' | 'projectDescription' | 'selectedMembers'>): Promise<UploadDraft>
  attachToProject(id: string, projectId: string): Promise<UploadDraft>
  markQueued(id: string, queueId: string): Promise<UploadDraft>
  markUnqueued(id: string, queueId: string): Promise<UploadDraft>
  markUploadStarted(id: string): Promise<UploadDraft>
  markUploadAcknowledged(id: string): Promise<UploadDraft>
  confirmUploaded(id: string, confirmation: UploadConfirmation): Promise<DraftCleanupResult>
  cleanupUploaded(): Promise<number>
}
