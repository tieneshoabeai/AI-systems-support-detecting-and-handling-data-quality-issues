import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { UploadDraft } from '../../types/datasets/upload-draft.types'

export class UploadDraftDatabase extends Dexie {
  drafts!: Table<UploadDraft, string>
  files!: Table<{ id: string; blob: Blob }, string>

  constructor(name = 'data-quality.upload-drafts.v1') {
    super(name)
    // Metadata tách Blob để list/tính quota không tải mọi file vào memory.
    this.version(1).stores({
      drafts: 'id, accountId, [accountId+projectId], [accountId+status]',
      files: 'id',
    })
  }
}
