import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { PreviewDialogRequest, PreviewResourceKind } from '../../../types/preview/preview.types'
import { PreviewIcon } from './preview-icons'
import { useDialogFocus } from './preview-surface'

// Hai dialog của thao tác mock: Đổi tên (form) và Xóa (xác nhận).
// Apple-design mục 12: task cần tập trung thì đi kèm scrim và đẩy nền ra xa — nên dialog
// đặc hơn popover (blur mạnh hơn, bóng sâu hơn), còn popover/menu thì trong suốt nhẹ.

const kindLabels: Record<PreviewResourceKind, string> = {
  workspace: 'Không gian làm việc',
  project: 'Dự án',
  dataset: 'Tập dữ liệu',
}

type RenameRequest = Extract<PreviewDialogRequest, { mode: 'rename' }>
type RemoveRequest = Extract<PreviewDialogRequest, { mode: 'remove' }>

// Bấm vào nền tối = hủy. Sự kiện đặt trên scrim và tự kiểm tra target, nên panel không
// phải stopPropagation (cách dễ sót: thêm nút mới vào panel là quên mất).
const scrimHandlers = (onCancel: () => void) => ({
  onMouseDown: (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onCancel()
  },
})

export function PreviewRenameDialog({ request, onSubmit, onCancel }: {
  request: RenameRequest | null
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  // null → không render; form có state riêng nên phải tách component con (hooks không
  // được gọi sau một nhánh return).
  if (!request) return null
  return <RenameForm request={request} onSubmit={onSubmit} onCancel={onCancel} />
}

function RenameForm({ request, onSubmit, onCancel }: {
  request: RenameRequest
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLFormElement>(null)
  const [name, setName] = useState(request.currentName)
  const [error, setError] = useState<string | null>(null)
  useDialogFocus(ref, onCancel)

  const submit = (): void => {
    const trimmed = name.trim()
    // Chặn ngay ở form thay vì để service trả lỗi: người nhập biết chỗ sai tức thì,
    // và message của service còn dành cho những lỗi không đoán trước.
    if (!trimmed) { setError('Tên không được để trống.'); return }
    if (trimmed === request.currentName) { setError('Tên mới trùng tên hiện tại.'); return }
    onSubmit(trimmed)
  }

  return <div className="preview-dialog-scrim" {...scrimHandlers(onCancel)}>
    <form ref={ref} className="preview-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-title"
      onSubmit={event => { event.preventDefault(); submit() }}>
      <span className="dialog-kind">{kindLabels[request.target.kind]}</span>
      <h2 id="rename-title">Đổi tên “{request.currentName}”</h2>
      <label className="dialog-field">
        <span>Tên mới</span>
        <input value={name} onChange={event => { setName(event.target.value); setError(null) }}
          aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'rename-error' : undefined}
          maxLength={80} autoComplete="off" />
      </label>
      {error && <p className="dialog-error" id="rename-error" role="alert">{error}</p>}
      <p className="dialog-note">Đổi tên chỉ áp dụng trên dữ liệu mẫu trong bộ nhớ tab và luôn có Hoàn tác.</p>
      <footer className="dialog-actions">
        <button type="button" className="button-secondary" onClick={onCancel}>Hủy</button>
        <button type="submit" className="button-primary"><PreviewIcon name="check" /> Lưu tên</button>
      </footer>
    </form>
  </div>
}

export function PreviewRemoveDialog({ request, onConfirm, onCancel }: {
  request: RemoveRequest | null
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!request) return null
  return <RemoveForm request={request} onConfirm={onConfirm} onCancel={onCancel} />
}

function RemoveForm({ request, onConfirm, onCancel }: {
  request: RemoveRequest
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useDialogFocus(ref, onCancel)
  return <div className="preview-dialog-scrim" {...scrimHandlers(onCancel)}>
    <div ref={ref} className="preview-dialog" role="alertdialog" aria-labelledby="remove-title" aria-describedby="remove-detail">
      <span className="dialog-kind">{kindLabels[request.target.kind]}</span>
      <h2 id="remove-title">Gỡ “{request.target.name}” khỏi danh sách mẫu?</h2>
      <p id="remove-detail" className="dialog-detail">{request.detail}</p>
      <footer className="dialog-actions">
        <button type="button" className="button-secondary" onClick={onCancel}>Giữ lại</button>
        <button type="button" className="button-danger" onClick={onConfirm}><PreviewIcon name="trash" /> Gỡ khỏi danh sách</button>
      </footer>
    </div>
  </div>
}
