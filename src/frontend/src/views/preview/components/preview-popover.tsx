import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { anchorFromElement, useSurfaceDismiss, useSurfacePosition } from './preview-surface'

// Popover chung cho topbar: thông báo, tài khoản, và panel lựa chọn của combobox.
// Khác menu ngữ cảnh ở chỗ nội dung là tự do (form, danh sách dài) chứ không phải
// một danh lệnh, và nó neo chặt vào nút đã mở ra nó.

export function PreviewPopover({ open, label, trigger, align, size, onClose, children }: {
  open: boolean
  label: string
  trigger: HTMLElement | null
  align?: 'start' | 'end'
  // 'md' (mặc định) cho danh sách lệnh/combobox; 'lg' cho popover có nhiều cột chữ trên một
  // hàng — tài khoản — nơi 360px buộc nhãn và giá trị dồn vào nhau (xem .is-lg trong CSS).
  // 'inbox' cho trung tâm thông báo: ô này tự chứa danh sách + tab + tìm kiếm + phân trang
  // nên cần rộng hơn và có vùng cuộn riêng (xem .is-inbox trong CSS).
  size?: 'md' | 'lg' | 'inbox'
  onClose: () => void
  children: ReactNode
}) {
  // Return null sớm ở đây an toàn vì component này không gọi hook; phần có hook
  // là PopoverSurface bên dưới, nó được mount mới mỗi lần mở (position đo lại từ đầu).
  if (!open || !trigger) return null
  return <PopoverSurface label={label} trigger={trigger} align={align} size={size} onClose={onClose}>{children}</PopoverSurface>
}

function PopoverSurface({ label, trigger, align, size, onClose, children }: {
  label: string
  trigger: HTMLElement
  align: 'start' | 'end' | undefined
  size: 'md' | 'lg' | 'inbox' | undefined
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Trigger không nằm trong surface, nên phải nói cho useSurfaceDismiss biết để KHÔNG
  // coi cú bấm vào trigger là "bấm ra ngoài" — nếu không, bấm nút đang mở sẽ đóng rồi
  // mở lại ngay (nháy một khung) thay vì đóng hẳn.
  const triggerRef = useMemo(() => ({ current: trigger }), [trigger])
  const point = useSurfacePosition(ref, anchorFromElement(trigger), align)
  useSurfaceDismiss(true, onClose, ref, triggerRef)

  return <div ref={ref} className={`preview-popover${align === 'end' ? ' is-end' : ''}${size === 'lg' ? ' is-lg' : ''}${size === 'inbox' ? ' is-inbox' : ''}`} role="dialog"
    aria-label={label} data-side={point.flipped ? 'top' : 'bottom'} style={{ left: point.x, top: point.y }}>
    {children}
  </div>
}
