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

export type UploadDraft = {
  id: string
  accountId: string
  projectId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  lastModified: number
  createdAtMs: number
  status: 'pending' | 'uploaded'
  datasetId?: string
  targetProjectId?: string
  targetProjectName?: string
}

export type SaveUploadDraft = { projectId: string; file: File }
// The scope can be a real project ID or a local new-project scope until the server creates it.
export type LocalUploadDraftRef = { id: string; scope: string; targetProjectId?: string; targetProjectName?: string }

// Chỉ caller đã validate ACK backend mới gọi confirmUploaded.
// Đây không phải endpoint hoặc cơ chế chống upload trùng.
export type UploadConfirmation = {
  accountId: string
  projectId: string
  datasetId: string
}

export type DraftCleanupResult = { cleaned: boolean }

export type UploadDraftPort = {
  save(this: void, input: SaveUploadDraft): Promise<UploadDraft>
  list(this: void): Promise<UploadDraft[]>
  readFile(this: void, id: string): Promise<Blob>
  remove(this: void, id: string): Promise<void>
  bindProject(this: void, id: string, projectId: string, projectName: string): Promise<void>
  confirmUploaded(this: void, id: string, confirmation: UploadConfirmation): Promise<DraftCleanupResult>
  cleanupUploaded(this: void): Promise<number>
}
