import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { PreviewSectionId } from '../../../types/preview/preview.types'
import { navItems, sectionLabels } from '../preview-data'
import { usePreviewSession } from '../preview-session-context'
import { PreviewIcon } from './preview-icons'
import { PreviewTopbar } from './preview-topbar'

// Shell chỉ còn phần khung trái + vùng cuộn. Toàn bộ chrome phía trên (Design Board nhóm 01)
// nằm ở preview-topbar.tsx vì nó cần đọc scope thật.
type PreviewShellProps = {
  active: PreviewSectionId
  children: ReactNode
}

// Sidebar của shell mới chỉ có 3 module (Home · Workspaces · Settings — xem navItems).
// Settings giờ đã có màn 2D (nhánh Accounts, Design Board nhóm 04) nên nó nằm trong danh sách
// dựng thật; bấm vào điều hướng sang '#/preview/settings' chứ không còn báo toast nữa.
// 'notifications' có trong danh sách này dù không nằm ở nav: màn Thông báo mở từ chuông
// topbar (Design Board 1.1 → 1.2), không phải một module điều hướng.
const builtSections: readonly PreviewSectionId[] = ['home', 'workspaces', 'projects', 'notifications', 'settings']

const collapsedKey = 'data-quality.preview.sidebar.v1'

// Ngưỡng màn hình hẹp: sidebar buộc thu gọn. Để JS biết mà đồng bộ
// aria-expanded và nút toggle (CSS không đổi được thuộc tính DOM) — xem preview.css.
const narrowQuery = '(max-width: 820px)'

const readNarrow = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(narrowQuery).matches

const readCollapsed = (): boolean => {
  try {
    return window.localStorage.getItem(collapsedKey) === 'compact'
  } catch {
    return false
  }
}

export function Avatar({ initials, size = 'md' }: { initials: string; size?: 'sm' | 'md' }) {
  return <span className={`avatar avatar-${size}`} aria-hidden="true">{initials}</span>
}

// Sidebar nhớ trạng thái thu gọn giữa các lần tải trang.
export function PreviewShell({
  active, children,
}: PreviewShellProps) {
  const session = usePreviewSession()
  const { state } = session
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [narrow, setNarrow] = useState(readNarrow)
  const contentRef = useRef<HTMLDivElement>(null)
  const compact = collapsed || narrow

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const list = window.matchMedia(narrowQuery)
    const onChange = (event: MediaQueryListEvent) => setNarrow(event.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(collapsedKey, collapsed ? 'compact' : 'expanded')
    } catch {
      // Storage bị chặn (private mode) thì sidebar vẫn hoạt động, chỉ mất nhớ trạng thái.
    }
  }, [collapsed])

  // Panel chi tiết sticky cần biết đúng chiều cao còn lại của vùng cuộn. Đo thực tế thay vì
  // đoán hằng số: dải demo/topbar/dải lý do/toast đều có thể đổi chiều cao (thu gọn cửa sổ,
  // toast xuất hiện) và mỗi px đoán sai là một phần panel bị cắt dưới đáy màn hình.
  // Bấm nút thu gọn làm cột lưới đổi chiều rộng TỪNG FRAME → ResizeObserver bắn đúng từng
  // frame đó. Nếu mỗi frame lại getComputedStyle + ghi biến thì mỗi frame là một lần
  // invalidate layout — chính là độ trễ mắt thấy trên cái nút. Ở đây đọc padding theo
  // resize, còn RO chỉ đo chiều cao và im lặng khi chiều cao không đổi.
  useEffect(() => {
    const element = contentRef.current
    if (!element) return
    let padTop = 0
    let lastHeight = -1
    const measure = () => {
      // Trừ padding-top: panel nằm ở y = padding-top lúc chưa dính, chỉ lấy clientHeight thì
      // chữ đầu trang vẫn bị cắt trước khi sticky bắt đầu.
      const height = Math.max(240, Math.round(element.clientHeight - padTop - 8))
      if (height === lastHeight) return
      lastHeight = height
      element.style.setProperty('--pv-viewport-h', `${height}px`)
    }
    const remeasure = () => {
      // Padding đến từ media query nên chỉ đổi khi resize cửa sổ, không đổi khi sidebar co:
      // đọc lại ở đây là đủ, không đọc trong callback của RO.
      padTop = parseFloat(window.getComputedStyle(element).paddingTop) || 0
      measure()
    }
    remeasure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => measure()) : null
    observer?.observe(element)
    window.addEventListener('resize', remeasure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', remeasure)
    }
  }, [])

  const navigate = (id: PreviewSectionId, label: string) => {
    if (builtSections.includes(id)) { session.openSection(id); return }
    // Module chưa thuộc batch 2D: báo rõ qua cùng một vùng toast mà mọi thao tác khác
    // dùng, thay vì một đoạn <p> riêng lẻ rồi tự ẩn sau 2,6 giây.
    session.notify(`${label} chưa khả dụng.`, 'info')
  }

  // Dự án và Thông báo là hai màn thật nhưng không nằm trong nav (nav đúng 3 mục theo ảnh
  // shell), nên vào đó thì sidebar vẫn sáng Home — người dùng báo lại đúng điểm này. Dải
  // ngữ cảnh dưới nav trả lời "đang ở đâu" và cho luôn một lối về Home mà không thêm mục nav.
  const isContextual = !navItems.some(item => item.id === active)

  return <div className={`preview-root${compact ? ' is-compact' : ''}`} data-section={active}>
    <aside className="preview-sidebar" aria-label="Điều hướng chính">
      <div className="sidebar-brand">
        <span className="brand-mark" aria-hidden="true"><PreviewIcon name="datasets" /></span>
        <span className="brand-text"><strong>DataVerse</strong><small>Your Data. Our Universe.</small></span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(item => {
          const selected = item.id === active
          return <button type="button" key={item.id}
            className={`nav-item${selected ? ' is-active' : ''}`}
            data-nav={item.id}
            aria-current={selected ? 'page' : undefined} title={item.label}
            onClick={() => navigate(item.id, item.label)}>
            <span className="nav-icon" aria-hidden="true"><PreviewIcon name={item.id} /></span>
            <span className="nav-label">{item.label}</span>
          </button>
        })}
      </nav>
      {isContextual && <div className="nav-context">
        <span className="nav-context-label">Đang mở</span>
        <strong>{sectionLabels[active] ?? active}</strong>
        <button type="button" className="text-link" onClick={() => navigate('home', 'Home')}>Về Home</button>
      </div>}
    </aside>

    <div className="preview-main">
      {/* Màn hẹp thì sidebar đã buộc thu nên nút toggle ẩn đi — để lại nút
          "thu gọn" khi đang ở 64px sẽ nói dối người dùng (aria-expanded sai). */}
      <PreviewTopbar
        active={active}
        sidebarToggle={!narrow && <button type="button" className="sidebar-toggle"
          aria-label={compact ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          aria-expanded={!compact}
          onClick={() => setCollapsed(value => !value)}>
          <PreviewIcon name={compact ? 'expand' : 'collapse'} />
        </button>}
        state={state} />
      <div className="preview-content" ref={contentRef}>{children}</div>
    </div>
  </div>
}
