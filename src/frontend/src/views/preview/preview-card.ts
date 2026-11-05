import type { KeyboardEvent, MouseEvent } from 'react'
import type { PreviewMenuOrigin } from '../../types/preview/preview.types'

// Quy tắc chuột dùng chung cho thẻ workspace, thẻ project và dòng bảng trên Home:
//   · 1 click ........ mở màn riêng của đối tượng (workspace → dashboard, project → Overview)
//   · 2 click ........ cùng màn đó, trừ nơi có scene 3D riêng thì `universe` quyết định
//   · chuột phải /
//     phím Menu .... menu ngữ cảnh tại con trỏ
// "Hai click" từng là lối vào duy nhất sang trang 3D của T. Đặc tả UI-UX nói rõ mọi lối "đi vào
// project" phải đáp ở Project Workspace Overview (ảnh Overview_v1), nên thẻ/dòng project không còn
// truyền `universe`: click thứ hai chỉ lặp lại đúng điều hướng click thứ nhất đã thực hiện
// (openSection chỉ ghi hash khi hash đổi) nên vô hại — đổi lại KHÔNG có ~250ms chờ phân biệt chuột
// đơn/kép, vốn là thứ làm giao diện có cảm giác "chậm chạm" (apple-design mục 10).
// Workspace vẫn truyền `universe`: scene của T có màn riêng cho cả universe, không chỉ cho project.
// Lối vào 3D của project không mất đi, nó thành NÚT thật ("Mở Dataset Universe 3D") trong khoang
// giữa trang Overview — bàn phím không có chuột kép thì Tab tới nút đó vẫn tới được.

// Phím Menu trên Windows/Linux phát contextmenu với clientX/clientY = -1 → nếu tin vào
// tọa độ đó thì menu mọc ra góc trên-trái màn hình. Khi không có vị trí trỏ thật thì neo
// vào chính phần tử đang focus, menu sẽ mọc ra từ đúng chỗ người dùng đang đứng.
export const originFromEvent = (event: MouseEvent<HTMLElement>): PreviewMenuOrigin =>
  event.clientX <= 0 && event.clientY <= 0
    ? { kind: 'anchor', element: event.currentTarget }
    : { kind: 'pointer', x: event.clientX, y: event.clientY }

export type PreviewCardProps = {
  onClick: () => void
  onDoubleClick: () => void
  onContextMenu: (event: MouseEvent<HTMLElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
}

export const previewCardProps = (handlers: {
  detail: () => void
  // Bỏ trống = không có màn 3D riêng cho đối tượng này, chuột kép quay lại đúng màn của click đơn.
  universe?: () => void
  menu: (origin: PreviewMenuOrigin) => void
}): PreviewCardProps => ({
  onClick: handlers.detail,
  onDoubleClick: handlers.universe ?? handlers.detail,
  onContextMenu: event => {
    // preventDefault để thay menu của trình duyệt bằng menu của ứng dụng.
    event.preventDefault()
    handlers.menu(originFromEvent(event))
  },
  onKeyDown: event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handlers.detail() }
  },
})

// Nút con bên trong thẻ (★, ⋯) phải chặn bong bóng, nếu không bấm ★ vừa đổi yêu thích
// vừa làm thẻ kích hoạt "mở chi tiết" — hai hành động cho một cú bấm.
export const stopCardBubble = (action: () => void) =>
  (event: MouseEvent<HTMLElement>): void => { event.stopPropagation(); action() }
