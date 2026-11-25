import { Button } from '../ui/primitives/button'
import type { UploadDraft } from '../../types/datasets/upload-draft.types'

export function UploadDraftNotice({ draft, selected, saving, notice, onRestore, onRemove }: {
  draft: UploadDraft | null; selected: boolean; saving: boolean; notice: string
  onRestore: () => void; onRemove: () => void
}) {
  return <>
    {draft && !selected && <div className="action-note">
      <p>Có file nháp: <strong>{draft.fileName}</strong> · {new Date(draft.createdAtMs).toLocaleString('vi-VN')}</p>
      {draft.targetProjectName && <p>Đã tạo project “{draft.targetProjectName}”; khôi phục để tiếp tục, không tạo bản trùng.</p>}
      <Button variant="secondary" disabled={saving} onClick={onRestore}>Khôi phục file nháp</Button>{' '}
      <Button variant="plain" disabled={saving} onClick={onRemove}>Bỏ bản nháp</Button>
    </div>}
    {(saving || notice) && <p role="status" className="action-note">{saving ? 'Đang lưu file nháp…' : notice}</p>}
  </>
}
