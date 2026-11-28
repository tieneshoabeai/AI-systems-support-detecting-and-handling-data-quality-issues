import type { Transaction } from 'dexie'
import { ApiError } from '../../lib/api-error'
import { UPLOAD_DRAFT_LIMITS } from '../../configs/upload-draft.config'
import type { DraftAccess, DraftAccessPort, DraftCleanupResult, SaveUploadDraft, UploadConfirmation, UploadDraft } from '../../types'
import { UploadDraftDatabase } from './upload-draft.database'
import { sha256Blob } from '../../utils/sha256'

type Options = {
  db: UploadDraftDatabase
  access: DraftAccessPort
  now?: () => number
  createId?: () => string
  estimate?: () => Promise<{ quota?: number; usage?: number }>
}

const storageError = (message: string, code: string) => new ApiError({ kind: 'storage', message, code })
const sessionError = () => new ApiError({ kind: 'session', message: 'Cần phiên hợp lệ để truy cập bản nháp.' })

export const createUploadDraftRepository = (options: Options) => {
  const { db, access } = options
  const now = options.now ?? Date.now
  const createId = options.createId ?? (() => crypto.randomUUID())
  const estimate = options.estimate ?? (() => navigator.storage?.estimate?.() ?? Promise.resolve({}))

  const requireAccess = (): DraftAccess => {
    const current = access.read()
    const time = now()
    if (!current || !current.accountId.trim() || !Number.isFinite(current.expiresAtMs)
      || !Number.isFinite(time) || time >= current.expiresAtMs) throw sessionError()
    return { ...current }
  }
  const assertCurrent = (captured: DraftAccess) => {
    const current = requireAccess()
    if (current.accountId !== captured.accountId || current.generation !== captured.generation) throw sessionError()
  }

  const transact = async <T>(captured: DraftAccess, work: (tx: Transaction) => Promise<T>): Promise<T> => {
    assertCurrent(captured)
    let unsubscribe: (() => void) | undefined
    try {
      const result = await db.transaction('rw', db.drafts, db.files, async tx => {
        unsubscribe = access.subscribe(() => {
          try { assertCurrent(captured) } catch { tx.abort() }
        })
        assertCurrent(captured)
        const value = await work(tx)
        assertCurrent(captured)
        return value
      })
      assertCurrent(captured)
      return result
    } catch (error) {
      // Logout/account switch ưu tiên session error; không lộ raw DB error.
      assertCurrent(captured)
      if (error instanceof ApiError) throw error
      throw storageError('Không thể hoàn tất thao tác bản nháp trong IndexedDB.', 'DRAFT_TRANSACTION_FAILED')
    } finally { unsubscribe?.() }
  }

  const owned = async (id: string, captured: DraftAccess) => {
    const draft = await db.drafts.get(id)
    if (!draft || draft.accountId !== captured.accountId) {
      throw storageError('Không tìm thấy bản nháp trong tài khoản hiện tại.', 'DRAFT_NOT_FOUND')
    }
    return draft
  }

  return {
    async save(input: SaveUploadDraft): Promise<UploadDraft> {
      const captured = requireAccess()
      const { file, projectId } = input
      const workspaceId = input.workspaceId?.trim()
      const projectName = input.projectName?.trim()
      const kind = projectId ? 'project-upload' : 'project-wizard'
      if ((!projectId?.trim() && (!workspaceId || !projectName)) || !file.name.trim() || file.size <= 0 || !Number.isFinite(file.size)) {
        throw storageError('File hoặc project của bản nháp không hợp lệ.', 'DRAFT_INVALID_INPUT')
      }
      if (file.size > UPLOAD_DRAFT_LIMITS.fileBytes) {
        throw storageError('Mỗi file bản nháp tối đa 50 MiB.', 'DRAFT_FILE_LIMIT')
      }
      const fileHash = await sha256Blob(file)
      // estimate chỉ là preflight; transaction vẫn phải xử lý quota/abort thật.
      let capacity: { quota?: number; usage?: number } = {}
      try { capacity = await estimate() } catch { /* API không có/sai: để IndexedDB quyết định khi ghi. */ }
      assertCurrent(captured)
      if (typeof capacity.quota === 'number' && typeof capacity.usage === 'number'
        && Number.isFinite(capacity.quota) && Number.isFinite(capacity.usage)
        && capacity.quota - capacity.usage < file.size) {
        throw storageError('Trình duyệt không còn đủ dung lượng ước tính để lưu file.', 'DRAFT_DEVICE_QUOTA')
      }
      const draft: UploadDraft = {
        id: createId(), accountId: captured.accountId, kind, projectId: projectId?.trim() ?? null,
        ...(workspaceId ? { workspaceId } : {}), ...(projectName ? { projectName } : {}),
        ...(input.projectDescription === undefined ? {} : { projectDescription: input.projectDescription }),
        ...(input.selectedMembers === undefined ? {} : { selectedMembers: input.selectedMembers.map(member => ({ ...member })) }),
        fileName: file.name, mimeType: file.type, sizeBytes: file.size,
        lastModified: file.lastModified, createdAtMs: now(), fileHash, status: 'pending',
      }
      await transact(captured, async () => {
        const existing = await db.drafts.toArray()
        const total = existing.reduce((sum, item) => sum + item.sizeBytes, 0)
        const account = existing.filter(item => item.accountId === captured.accountId)
          .reduce((sum, item) => sum + item.sizeBytes, 0)
        if (account + file.size > UPLOAD_DRAFT_LIMITS.accountBytes) {
          throw storageError('Tổng bản nháp của tài khoản tối đa 200 MiB.', 'DRAFT_ACCOUNT_LIMIT')
        }
        if (total + file.size > UPLOAD_DRAFT_LIMITS.totalBytes) {
          throw storageError('Tổng bản nháp của ứng dụng tối đa 500 MiB.', 'DRAFT_TOTAL_LIMIT')
        }
        await db.drafts.add(draft)
        await db.files.add({ id: draft.id, blob: file })
      })
      return draft // Chỉ resolve sau transaction commit.
    },

    async list(): Promise<UploadDraft[]> {
      const captured = requireAccess()
      return transact(captured, () => db.drafts.where('accountId').equals(captured.accountId).toArray())
    },

    async readFile(id: string): Promise<Blob> {
      const captured = requireAccess()
      const { draft, blob } = await transact(captured, async () => {
        const draft = await owned(id, captured)
        if (draft.status === 'uploaded') {
          throw storageError('File đã upload chỉ chờ dọn cục bộ, không gửi lại.', 'DRAFT_ALREADY_UPLOADED')
        }
        const file = await db.files.get(id)
        if (!file) throw storageError('File bản nháp không còn trong bộ nhớ cục bộ.', 'DRAFT_FILE_MISSING')
        return { draft, blob: file.blob }
      })
      if (!draft.fileHash) {
        const fileHash = await sha256Blob(blob)
        await transact(captured, async () => {
          const current = await owned(id, captured)
          if (current.status === 'uploaded') throw storageError('File đã được upload trong lúc khôi phục.', 'DRAFT_ALREADY_UPLOADED')
          if (!current.fileHash) await db.drafts.put({ ...current, fileHash })
        })
      }
      return blob
    },

    async updateWizardMetadata(id: string, input: Pick<SaveUploadDraft, 'workspaceId' | 'projectName' | 'projectDescription' | 'selectedMembers'>): Promise<UploadDraft> {
      const captured = requireAccess()
      return transact(captured, async () => {
        const draft = await owned(id, captured)
        if (draft.kind !== 'project-wizard') {
          throw storageError('Metadata này chỉ dành cho bản nháp wizard.', 'DRAFT_WIZARD_STATE')
        }
        if (draft.projectId !== null
          && ((input.workspaceId !== undefined && input.workspaceId.trim() !== draft.workspaceId)
            || (input.projectName !== undefined && input.projectName.trim() !== draft.projectName)
            || (input.projectDescription !== undefined && input.projectDescription !== draft.projectDescription))) {
          throw storageError('Workspace, tên và mô tả đã khóa sau khi draft liên kết với project server.', 'DRAFT_WIZARD_LINKED')
        }
        const next: UploadDraft = {
          ...draft,
          ...(input.workspaceId === undefined ? {} : { workspaceId: input.workspaceId.trim() }),
          ...(input.projectName === undefined ? {} : { projectName: input.projectName.trim() }),
          ...(input.projectDescription === undefined ? {} : { projectDescription: input.projectDescription }),
          ...(input.selectedMembers === undefined ? {} : { selectedMembers: input.selectedMembers.map(member => ({ ...member })) }),
        }
        await db.drafts.put(next)
        return next
      })
    },

    async attachToProject(id: string, projectId: string): Promise<UploadDraft> {
      const captured = requireAccess()
      if (!projectId.trim()) throw storageError('Project server không hợp lệ.', 'DRAFT_PROJECT_INVALID')
      return transact(captured, async () => {
        const draft = await owned(id, captured)
        if (draft.projectId !== null && draft.projectId !== projectId) {
          throw storageError('Bản nháp đã được gắn với một project server khác.', 'DRAFT_PROJECT_MISMATCH')
        }
        const next = { ...draft, projectId }
        await db.drafts.put(next)
        return next
      })
    },

    async markQueued(id: string, queueId: string): Promise<UploadDraft> {
      const captured = requireAccess()
      if (!queueId.trim()) throw storageError('Queue ID không hợp lệ.', 'DRAFT_QUEUE_INVALID')
      return transact(captured, async () => {
        const draft = await owned(id, captured)
        if (!draft.fileHash || draft.status === 'uploaded' || draft.kind === 'project-wizard' || !draft.projectId) {
          throw storageError('Queue chỉ nhận file CSV gắn với project đã tồn tại.', 'DRAFT_QUEUE_STATE')
        }
        if (draft.queueId && draft.queueId !== queueId) throw storageError('Bản nháp đã gắn với queue khác.', 'DRAFT_QUEUE_MISMATCH')
        const next = { ...draft, queueId, status: 'queued' as const }
        await db.drafts.put(next)
        return next
      })
    },

    async markUnqueued(id: string, queueId: string): Promise<UploadDraft> {
      const captured = requireAccess()
      return transact(captured, async () => {
        const draft = await owned(id, captured)
        if (draft.queueId !== queueId || draft.status !== 'queued') {
          throw storageError('Bản nháp không còn ở trạng thái queue để hủy an toàn.', 'DRAFT_UNQUEUE_STATE')
        }
        const next: UploadDraft = { ...draft, status: 'pending' }
        delete next.queueId
        await db.drafts.put(next)
        return next
      })
    },

    async markUploadStarted(id: string): Promise<UploadDraft> {
      const captured = requireAccess()
      return transact(captured, async () => {
        const draft = await owned(id, captured)
        if (!draft.fileHash || draft.status === 'uploaded') throw storageError('Bản nháp chưa đủ điều kiện để gửi.', 'DRAFT_UPLOAD_STATE')
        const next = { ...draft, status: 'uploading' as const }
        await db.drafts.put(next)
        return next
      })
    },

    async markUploadAcknowledged(id: string): Promise<UploadDraft> {
      const captured = requireAccess()
      return transact(captured, async () => {
        const draft = await owned(id, captured)
        if (!draft.fileHash || draft.status === 'uploaded') throw storageError('Bản nháp không chờ ACK upload.', 'DRAFT_ACK_STATE')
        const next = { ...draft, status: 'acknowledged' as const }
        await db.drafts.put(next)
        return next
      })
    },

    async remove(id: string): Promise<void> {
      const captured = requireAccess()
      await transact(captured, async () => {
        const draft = await owned(id, captured)
        if (draft.status === 'queued' || draft.status === 'uploading' || draft.status === 'acknowledged') {
          throw storageError('Bản nháp đang gắn với request chưa được xác nhận; không thể xóa an toàn.', 'DRAFT_PENDING_LOCKED')
        }
        await db.files.delete(id)
        await db.drafts.delete(id)
      })
    },

    async confirmUploaded(id: string, confirmation: UploadConfirmation): Promise<DraftCleanupResult> {
      const captured = requireAccess()
      await transact(captured, async () => {
        const draft = await owned(id, captured)
        if (confirmation.accountId !== captured.accountId || confirmation.projectId !== draft.projectId
          || !confirmation.datasetId.trim()
          || !draft.fileHash || confirmation.fileHash !== draft.fileHash
          || confirmation.fileName !== draft.fileName || confirmation.sizeBytes !== draft.sizeBytes
          || (draft.queueId !== undefined && (confirmation.queueId !== draft.queueId || confirmation.queueHash !== draft.fileHash))
          || (confirmation.serverHash !== undefined && confirmation.serverHash.toLowerCase() !== draft.fileHash.toLowerCase())
          || (draft.datasetId !== undefined && draft.datasetId !== confirmation.datasetId)) {
          throw storageError('Xác nhận upload không khớp bản nháp.', 'DRAFT_CONFIRMATION_MISMATCH')
        }
        // Commit ACK before cleanup: a reload must never make this upload eligible again.
        // Keep the Blob until the cleanup transaction so a failed metadata delete rolls back
        // both deletions atomically.
        await db.drafts.put({ ...draft, status: 'uploaded', datasetId: confirmation.datasetId })
      })
      try {
        await transact(captured, async () => {
          const draft = await owned(id, captured)
          if (draft.status !== 'uploaded' || draft.datasetId !== confirmation.datasetId) {
            throw storageError('ACK upload chưa được lưu trước khi dọn bản nháp.', 'DRAFT_ACK_NOT_COMMITTED')
          }
          await db.files.delete(id)
          if (!confirmation.retainMetadata) await db.drafts.delete(id)
        })
        return confirmation.retainMetadata ? { cleaned: true, metadataRetained: true } : { cleaned: true }
      } catch (error) {
        if (error instanceof ApiError && error.kind === 'storage') return { cleaned: false }
        // Storage errors are normalized by transact to DRAFT_TRANSACTION_FAILED.
        if (error instanceof ApiError && error.code === 'DRAFT_TRANSACTION_FAILED') return { cleaned: false }
        throw error
      }
    },

    async cleanupUploaded(): Promise<number> {
      const captured = requireAccess()
      return transact(captured, async () => {
        const drafts = (await db.drafts.where('[accountId+status]').equals([captured.accountId, 'uploaded']).toArray())
          .filter(draft => draft.kind !== 'project-wizard')
        for (const draft of drafts) {
          await db.files.delete(draft.id)
          await db.drafts.delete(draft.id)
        }
        return drafts.length
      })
    },
  }
}
