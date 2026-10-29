import type { Transaction } from 'dexie'
import { ApiError } from '../../lib/api-error'
import { UPLOAD_DRAFT_LIMITS } from '../../configs/upload-draft.config'
import type {
  DraftAccess, DraftAccessPort, DraftCleanupResult, SaveUploadDraft,
  UploadConfirmation, UploadDraft,
} from '../../types/datasets/upload-draft.types'
import { UploadDraftDatabase } from './upload-draft.database'

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
      if (!projectId.trim() || !file.name.trim() || file.size <= 0 || !Number.isFinite(file.size)) {
        throw storageError('File hoặc project của bản nháp không hợp lệ.', 'DRAFT_INVALID_INPUT')
      }
      if (file.size > UPLOAD_DRAFT_LIMITS.fileBytes) {
        throw storageError('Mỗi file bản nháp tối đa 50 MiB.', 'DRAFT_FILE_LIMIT')
      }
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
        id: createId(), accountId: captured.accountId, projectId,
        fileName: file.name, mimeType: file.type, sizeBytes: file.size,
        lastModified: file.lastModified, createdAtMs: now(), status: 'pending',
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
      return transact(captured, async () => {
        const draft = await owned(id, captured)
        if (draft.status !== 'pending') {
          throw storageError('File đã upload chỉ chờ dọn cục bộ, không gửi lại.', 'DRAFT_ALREADY_UPLOADED')
        }
        const file = await db.files.get(id)
        if (!file) throw storageError('File bản nháp không còn trong bộ nhớ cục bộ.', 'DRAFT_FILE_MISSING')
        return file.blob
      })
    },

    async remove(id: string): Promise<void> {
      const captured = requireAccess()
      await transact(captured, async () => {
        await owned(id, captured)
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
          || (draft.datasetId !== undefined && draft.datasetId !== confirmation.datasetId)) {
          throw storageError('Xác nhận upload không khớp bản nháp.', 'DRAFT_CONFIRMATION_MISMATCH')
        }
        // Commit ACK trước: nếu cleanup lỗi/reload, không upload lại file này.
        await db.drafts.put({ ...draft, status: 'uploaded', datasetId: confirmation.datasetId })
      })
      try {
        await transact(captured, async () => {
          await owned(id, captured)
          await db.files.delete(id)
          await db.drafts.delete(id)
        })
        return { cleaned: true }
      } catch (error) {
        if (error instanceof ApiError && error.kind === 'storage') return { cleaned: false }
        throw error
      }
    },

    async cleanupUploaded(): Promise<number> {
      const captured = requireAccess()
      return transact(captured, async () => {
        const drafts = await db.drafts.where('[accountId+status]').equals([captured.accountId, 'uploaded']).toArray()
        for (const draft of drafts) {
          await db.files.delete(draft.id)
          await db.drafts.delete(draft.id)
        }
        return drafts.length
      })
    },
  }
}
