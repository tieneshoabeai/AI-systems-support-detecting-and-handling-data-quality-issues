import { Button } from '../../../components/ui/primitives/button'
import { Input } from '../../../components/ui/primitives/input'
import { useManagementStore } from '../../../hooks/preview/use-preview-store'
import { Dialog } from '../../../components/ui/overlay/dialog'
import { useState } from 'react'
import type { PreviewDialogRequest, PreviewResourceKind } from '../../../types'
import { PreviewIcon } from './preview-icons'

const kindLabels: Record<PreviewResourceKind, string> = {
  workspace: 'Workspace',
  project: 'Dự án',
  dataset: 'Tập dữ liệu',
}

type RenameRequest = Extract<PreviewDialogRequest, { mode: 'rename' }>
type RemoveRequest = Extract<PreviewDialogRequest, { mode: 'remove' }>

// Bấm vào nền tối = hủy. Sự kiện đặt trên scrim và tự kiểm tra target, nên panel không
// phải stopPropagation (cách dễ sót: thêm nút mới vào panel là quên mất).

export function PreviewRenameDialog({ request, onSubmit, onCancel }: {
  request: RenameRequest | null
  onSubmit: (name: string) => void | Promise<void>
  onCancel: () => void
}) {
  // null → không render; form có state riêng nên phải tách component con (hooks không
  // được gọi sau một nhánh return).
  if (!request) return null
  return <RenameForm request={request} onSubmit={onSubmit} onCancel={onCancel} />
}

function RenameForm({ request, onSubmit, onCancel }: {
  request: RenameRequest
  onSubmit: (name: string) => void | Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(request.currentName)
  const [error, setError] = useState<string | null>(null)

  const [busy, setBusy] = useState(false)
  const submit = async (): Promise<void> => {
    if (busy) return
    const trimmed = name.trim()
    // Chặn ngay ở form thay vì để service trả lỗi: người nhập biết chỗ sai tức thì,
    // và message của service còn dành cho những lỗi không đoán trước.
    if (!trimmed) { setError('Tên không được để trống.'); return }
    if (trimmed === request.currentName) { setError('Tên mới trùng tên hiện tại.'); return }
    setBusy(true)
    try { await onSubmit(trimmed) } finally { setBusy(false) }
  }

  return <Dialog open onClose={onCancel} busy={busy} as="form" className="" role="dialog" aria-labelledby="rename-title"
    onSubmit={event => { event.preventDefault(); void submit() }}>
    <header className="dialog-head dialog-action-head">
      <span className="dialog-head-icon" aria-hidden="true"><PreviewIcon name="pencil" /></span>
      <div className="dialog-head-text">
        <h2 id="rename-title">Đổi tên “{request.currentName}”</h2>
        <p>{kindLabels[request.target.kind]}</p>
      </div>
    </header>
    <label className="dialog-field">
      <span>Tên mới</span>
      <Input value={name} onChange={event => { setName(event.target.value); setError(null) }}
        aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'rename-error' : undefined}
        maxLength={80} autoComplete="off" />
    </label>
    {error && <p className="dialog-error" id="rename-error" role="alert">{error}</p>}
    <footer className="dialog-actions">
      <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>Hủy</Button>
      <Button type="submit" loading={busy}><PreviewIcon name="check" /> Lưu tên</Button>
    </footer>
  </Dialog>
}

export function PreviewRemoveDialog({ request, onConfirm, onCancel }: {
  request: RemoveRequest | null
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}) {
  if (!request) return null
  return <RemoveForm request={request} onConfirm={onConfirm} onCancel={onCancel} />
}

function RemoveForm({ request, onConfirm, onCancel }: {
  request: RemoveRequest
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}) {
  const live = useManagementStore().getState().source === 'api'
  const [busy, setBusy] = useState(false)
  const confirm = async () => { if (busy) return; setBusy(true); try { await onConfirm() } finally { setBusy(false) } }
  return <Dialog open onClose={onCancel} busy={busy} className="" role="alertdialog" aria-labelledby="remove-title" aria-describedby="remove-detail">
    <header className="dialog-head dialog-action-head">
      <span className="dialog-head-icon" aria-hidden="true"><PreviewIcon name="trash" /></span>
      <div className="dialog-head-text">
        <h2 id="remove-title">Gỡ “{request.target.name}” khỏi {live ? 'danh sách' : 'danh sách mẫu'}?</h2>
      </div>
    </header>
    <p id="remove-detail" className="dialog-detail">{request.detail}</p>
    <footer className="dialog-actions">
      <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>Giữ lại</Button>
      <Button type="button" variant="danger" loading={busy} onClick={() => { void confirm() }}><PreviewIcon name="trash" /> Gỡ khỏi danh sách</Button>
    </footer>
  </Dialog>
}
