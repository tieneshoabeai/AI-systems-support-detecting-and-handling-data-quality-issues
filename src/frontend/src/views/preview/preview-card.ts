import type { KeyboardEvent, MouseEvent } from 'react'
import type { PreviewMenuOrigin } from '../../types/preview/preview.types'

// Click, double click và Enter trên thẻ cùng mở một trang của đối tượng.
// Nút con (★, ⋯) xử lý hành động riêng; không được kích hoạt mở thẻ cha.

// Phím Menu trên Windows/Linux phát contextmenu với clientX/clientY = -1 → nếu tin vào
// tọa độ đó thì menu mọc ra góc trên-trái màn hình. Khi không có vị trí trỏ thật thì neo
// vào chính phần tử đang focus, menu sẽ mọc ra từ đúng chỗ người dùng đang đứng.
export const originFromEvent = (event: MouseEvent<HTMLElement>): PreviewMenuOrigin =>
  event.clientX <= 0 && event.clientY <= 0
    ? { kind: 'anchor', element: event.currentTarget }
    : { kind: 'pointer', x: event.clientX, y: event.clientY }

export type PreviewCardProps = {
  onClick: () => void
  onDoubleClick: (event: MouseEvent<HTMLElement>) => void
  onContextMenu: (event: MouseEvent<HTMLElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
}

export const previewCardProps = (handlers: {
  detail: () => void
  menu: (origin: PreviewMenuOrigin) => void
}): PreviewCardProps => ({
  onClick: handlers.detail,
  onDoubleClick: event => {
    if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea')) return
    handlers.detail()
  },
  onContextMenu: event => {
    // preventDefault để thay menu của trình duyệt bằng menu của ứng dụng.
    event.preventDefault()
    handlers.menu(originFromEvent(event))
  },
  onKeyDown: event => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handlers.detail() }
  },
})

// Nút con bên trong thẻ (★, ⋯) phải chặn bong bóng, nếu không bấm ★ vừa đổi yêu thích
// vừa làm thẻ kích hoạt "mở chi tiết" — hai hành động cho một cú bấm.
export const stopCardBubble = (action: () => void) =>
  (event: MouseEvent<HTMLElement>): void => { event.stopPropagation(); action() }
