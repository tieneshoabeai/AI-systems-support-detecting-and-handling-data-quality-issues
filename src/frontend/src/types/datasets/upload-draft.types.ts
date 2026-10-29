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
}

export type SaveUploadDraft = { projectId: string; file: File }

// Chỉ caller đã validate ACK backend mới gọi confirmUploaded.
// Đây không phải endpoint hoặc cơ chế chống upload trùng.
export type UploadConfirmation = {
  accountId: string
  projectId: string
  datasetId: string
}

export type DraftCleanupResult = { cleaned: boolean }
