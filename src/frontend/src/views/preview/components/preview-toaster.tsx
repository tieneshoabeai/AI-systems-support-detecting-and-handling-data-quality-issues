import type { PreviewToast } from '../../../types/preview/preview.types'
import { PreviewIcon } from './preview-icons'

// Vùng thông báo kết quả thao tác. Khu vực này là live region role="status" duy nhất
// của frame: nó luôn tồn tại (kể cả khi rỗng) nên máy đọc màn hình announcement nội dung
// mới mà không cần tạo/xóa region giữa chừng.
//
// Mọi message đều nói rõ phạm vi thật ("dữ liệu mẫu trong bộ nhớ tab") vì shared-ui
// cấm giả lập ACK của server — người đọc không được phép tưởng đã ghi xuống backend.

export function PreviewToaster({ toasts, onDismiss }: {
  toasts: PreviewToast[]
  onDismiss: (id: string) => void
}) {
  return <div className={`preview-toaster${toasts.length ? ' is-on' : ''}`} role="status" aria-live="polite"
    aria-label="Kết quả thao tác trên dữ liệu mẫu">
    {toasts.map(toast => <div className={`toast toast-${toast.tone}`} key={toast.id}>
      <span className="toast-icon" aria-hidden="true"><PreviewIcon name={toast.tone === 'danger' ? 'help' : 'check'} /></span>
      <p className="toast-text">{toast.text}</p>
      {toast.onUndo && <button type="button" className="toast-action" aria-label={toast.undoLabel ?? 'Hoàn tác'}
        onClick={() => { if (toast.onUndo?.() !== false) onDismiss(toast.id) }}>
        <PreviewIcon name="undo" /> {toast.undoLabel ?? 'Hoàn tác'}
      </button>}
      <button type="button" className="icon-button toast-close" aria-label="Đóng thông báo" onClick={() => onDismiss(toast.id)}>
        <PreviewIcon name="close" />
      </button>
    </div>)}
  </div>
}
