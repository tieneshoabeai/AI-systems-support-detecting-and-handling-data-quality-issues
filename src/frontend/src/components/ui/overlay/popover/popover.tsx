import { useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSurfaceDismiss, useSurfacePosition } from '../../../../hooks/ui/use-surface'
import styles from './popover.module.css'

// Popover chung cho topbar: thông báo, tài khoản, và panel lựa chọn của combobox.
// Khác menu ngữ cảnh ở chỗ nội dung là tự do (form, danh sách dài) chứ không phải
// một danh lệnh, và nó neo chặt vào nút đã mở ra nó.

export function Popover({ open, label, trigger, align, size, portalHost, onClose, children }: {
  open: boolean
  label: string
  trigger: HTMLElement | null
  align?: 'start' | 'end'
  // 'md' (mặc định) cho danh sách lệnh/combobox; 'lg' cho popover có nhiều cột chữ trên một
  // hàng — tài khoản — nơi 360px buộc nhãn và giá trị dồn vào nhau (xem .is-lg trong CSS).
  // 'inbox' cho trung tâm thông báo: ô này tự chứa danh sách + tab + tìm kiếm + phân trang
  // nên cần rộng hơn và có vùng cuộn riêng (xem .is-inbox trong CSS).
  size?: 'md' | 'lg' | 'inbox'
  portalHost?: HTMLElement | null
  onClose: () => void
  children: ReactNode
}) {
  // Return null sớm ở đây an toàn vì component này không gọi hook; phần có hook
  // là PopoverSurface bên dưới, nó được mount mới mỗi lần mở (position đo lại từ đầu).
  if (!open || !trigger) return null
  const surface = <PopoverSurface label={label} trigger={trigger} align={align} size={size} onClose={onClose}>{children}</PopoverSurface>
  return portalHost ? createPortal(surface, portalHost) : surface
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
  const point = useSurfacePosition(ref, trigger, align)
  useSurfaceDismiss(true, onClose, ref, triggerRef)

  useEffect(() => {
    const surface = ref.current
    if (!surface || surface.contains(document.activeElement)) return
    const initial = surface.querySelector<HTMLElement>('button[aria-pressed="true"]:not(:disabled)')
      ?? surface.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')
    const focusTarget = initial ?? surface
    focusTarget.focus({ preventScroll: true })
  }, [trigger])

  return <div ref={ref} className={`${styles['root']} preview-popover${align === 'end' ? ' is-end' : ''}${size === 'lg' ? ' is-lg' : ''}${size === 'inbox' ? ' is-inbox' : ''}`} role="dialog"
    aria-label={label} tabIndex={-1} data-side={point.flipped ? 'top' : 'bottom'}
    style={{ left: point.x, top: point.y, maxHeight: point.maxHeight }}>
    {children}
  </div>
}
