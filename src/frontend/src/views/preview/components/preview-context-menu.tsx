import { useRef } from 'react'
import type { MouseEvent } from 'react'
import type { PreviewActionId, PreviewMenuRequest, PreviewMenuItem } from '../../../types/preview/preview.types'
import { PreviewIcon } from './preview-icons'
import { anchorFromOrigin, useRovingFocus, useSurfaceDismiss, useSurfacePosition } from './preview-surface'

// Menu ngữ cảnh: một surface, ba lối vào — chuột phải (đặt tại con trỏ), nút ⋯ và
// dropdown "Thao tác ▾" (neo vào nút vừa bấm). Riêng phím Menu trên bàn phím cũng trình
// duyệt phát sự kiện contextmenu, nên không phải viết thêm handler nào nữa.

type InfoHoverHandlers = {
  onMouseEnter?: (event: MouseEvent<HTMLButtonElement>) => void
  onMouseLeave?: () => void
}

// Wrapper này return null khi không có menu; component surface ở dưới có hooks riêng và
// được mount/unmount theo request — gọi hooks có điều kiện ngay trong một component là sai.
export function PreviewContextMenu({ request, onRun, onClose, onInfoHover, onInfoLeave }: {
  request: PreviewMenuRequest | null
  onRun: (action: PreviewActionId, target: PreviewMenuRequest['target']) => void
  onClose: () => void
  // Đặc tả Home: thẻ tóm tắt project mọc lên khi lia chuột vào ĐÚNG item "Xem thông tin", tắt
  // khi rời item. Menu không sở hữu project cũng không biết gì về thẻ, nên hai callback này là
  // tùy chọn và do preview-session truyền xuống — menu của workspace/dataset không có item 'info'
  // thì không truyền gì thêm.
  onInfoHover?: (projectId: string, element: HTMLElement) => void
  onInfoLeave?: () => void
}) {
  if (!request) return null
  return <ContextMenuSurface request={request} onRun={onRun} onClose={onClose}
    onInfoHover={onInfoHover} onInfoLeave={onInfoLeave} />
}

function ContextMenuSurface({ request, onRun, onClose, onInfoHover, onInfoLeave }: {
  request: PreviewMenuRequest
  onRun: (action: PreviewActionId, target: PreviewMenuRequest['target']) => void
  onClose: () => void
  onInfoHover?: (projectId: string, element: HTMLElement) => void
  onInfoLeave?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const anchor = anchorFromOrigin(request.origin)
  const point = useSurfacePosition(ref, anchor)
  useSurfaceDismiss(true, onClose, ref)
  useRovingFocus(true, ref)

  // Mũi tên chỉ vào trigger chỉ có ý nghĩa khi menu mở từ một nút (chuột phải thì
  // không có gì để chỉ); data-side nói cho CSS biết trigger nằm trên hay dưới menu.
  const hasTrigger = request.origin.kind === 'anchor'
  const disabledItems = request.items.filter(item => item.disabled)
  const hasDisabledItem = disabledItems.length > 0
  // Item tắt trỏ aria-describedby vào một id. Note ngay đáy menu GIÀNH id đó khi nó hiện ra:
  // người bấm chuột phải đang nhìn lý do NGAY DƯỚI item, còn dải note cuối trang thì có thể
  // đã nằm ngoài vùng cuộn — hai phần tử cùng id là HTML sai, nên trang không lặp id này.
  const noteOwner = disabledItems.find(item => item.describedBy !== undefined)
  const noteId = noteOwner?.describedBy

  // Hover chỉ dành cho item 'info' của project. Check `target.kind` là dây chằng thứ hai:
  // thêm một item 'info' vào menu workspace sau này sẽ không vô tình mở thẻ project.
  const infoHandlers = (item: PreviewMenuItem): InfoHoverHandlers => {
    if (item.id !== 'info' || onInfoHover === undefined || request.target.kind !== 'project') return {}
    return {
      onMouseEnter: event => onInfoHover(request.target.id, event.currentTarget),
      onMouseLeave: () => onInfoLeave?.(),
    }
  }

  return <div ref={ref} className="preview-menu" role="menu" aria-label={`Thao tác với ${request.target.name}`}
    data-trigger={hasTrigger ? 'anchor' : 'pointer'} data-side={point.flipped ? 'top' : 'bottom'}
    style={{ left: point.x, top: point.y }}>
    <p className="menu-title">{request.target.name}</p>
    <ul className="menu-list">
      {request.items.flatMap(item => [
        item.separatorBefore ? <li className="menu-separator" role="separator" key={`${item.id}-sep`} /> : null,
        <li role="none" key={item.id}>
          <button type="button" role="menuitem" className={`menu-item${item.tone === 'danger' ? ' is-danger' : ''}`}
            disabled={item.disabled} aria-describedby={item.describedBy}
            {...infoHandlers(item)}
            onClick={() => onRun(item.id, request.target)}>
            <span className="menu-icon" aria-hidden="true"><PreviewIcon name={item.icon} /></span>
            <span className="menu-text">{item.label}</span>
            {item.hint && <span className="menu-hint">{item.hint}</span>}
          </button>
        </li>,
        // Lý do của item tắt nằm NGAY DƯỚI chính item đó, không phải đáy menu. Ghim xuống đáy
        // thì nó rơi vào sau mục cuối — thường là "Xóa …" màu đỏ — và vô tình đọc thành ghi chú
        // của hành động xóa, trong khi nó giải thích cho mục bị tắt ở trên (đo thật trên browser:
        // cách 51px, dính vào mục xóa).
        item.id === noteOwner?.id && request.note
          ? <li role="none" key={`${item.id}-note`}><p className="menu-note" id={noteId}>{request.note}</p></li>
          : null,
      ])}
    </ul>
    {/* Menu có note mà không có item tắt nào mang id (chưa xảy ra với các menu hiện có) thì note
        vẫn nằm ở đáy: bất biến "lý do phải nhìn thấy trong chính surface" giữ nguyên. */}
    {hasDisabledItem && request.note && noteOwner === undefined && <p className="menu-note">{request.note}</p>}
  </div>
}
