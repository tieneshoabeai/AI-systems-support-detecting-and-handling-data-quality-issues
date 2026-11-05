import { useEffect, useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { PreviewMenuOrigin, PreviewSurfaceSide } from '../../../types/preview/preview.types'
import { previewNavigateEvent } from '../../../services/preview/preview-route'

// Hạ tầng dùng chung cho ba surface nổi của frame 2D: menu ngữ cảnh, popover, combobox.
// Tách một file vì "đóng khi bấm ra ngoài / Esc / cuộn" và "không tràn màn hình" là thứ
// dễ sai nhất; viết một lần để ba surface không thành ba bộ quy tắc lệch nhau.
//
// useLayoutEffect ở đây là có chủ đích: surface chỉ tồn tại trên browser (route preview
// dev-only), và cần kẹp vị trí TRƯỚC khi trình duyệt vẽ khung hình đầu tiên.

export type PreviewPoint = { x: number; y: number }

// flipped = surface phải lật lên trên trigger vì thiếu chỗ bên dưới. View cần biết để
// quay mũi tên chỉ vào trigger đúng chiều (apple-design mục 7: neo surface vào nơi mở ra nó).
export type SurfacePoint = PreviewPoint & { flipped: boolean }

const margin = 8
const gap = 6

// Mô tả nơi surface nên mọc ra, toàn số nguyên để dependency của effect ổn định
// (một object tạo mới mỗi render sẽ khiến layout effect chạy vòng lặp không dừng).
// right/top/bottom = 0 khi không có trigger (chuột phải) → surface không được lật lên.
export type SurfaceAnchor = { x: number; y: number; top: number; bottom: number; right: number }

// Chuột phải → đặt ngay tại con trỏ, không có "trigger" để lật lên.
// Nút ⋯ / "Thao tác ▾" → neo dưới nút, và được phép lật lên trên nếu thiếu chỗ.
export const anchorFromOrigin = (origin: PreviewMenuOrigin): SurfaceAnchor =>
  origin.kind === 'pointer'
    ? { x: origin.x, y: origin.y, top: 0, bottom: 0, right: 0 }
    : anchorFromElement(origin.element)

export const anchorFromElement = (element: HTMLElement): SurfaceAnchor => {
  const rect = element.getBoundingClientRect()
  return { x: rect.left, y: rect.bottom + gap, top: rect.top, bottom: rect.bottom, right: rect.right }
}

// Đo bằng offsetWidth/offsetHeight (kích thước layout) chứ KHÔNG dùng
// getBoundingClientRect: rect có nhân transform, mà layout effect này chạy đúng lúc surface
// vừa mount — tức frame đầu của pv-materialize (scale .97) → đo hẹp hơn 3% thực tế. Sai số
// nhỏ nhưng sai cả ba nhánh: 'end' bị lệch mép phải (popover tài khoản 380px lệch ~11px và
// tràn ra ngoài viewport, đo thật trên browser), và canFlip/clamp tính thiếu chỗ.
const sizeOf = (element: HTMLElement | null): { w: number; h: number } =>
  (element === null ? { w: 0, h: 0 } : { w: element.offsetWidth, h: element.offsetHeight })

const clampPoint = (point: PreviewPoint, size: { w: number; h: number }): PreviewPoint => ({
  x: Math.min(Math.max(margin, point.x), Math.max(margin, window.innerWidth - size.w - margin)),
  y: Math.min(Math.max(margin, point.y), Math.max(margin, window.innerHeight - size.h - margin)),
})

export const useSurfacePosition = (
  ref: RefObject<HTMLElement | null>,
  anchor: SurfaceAnchor,
  align: 'start' | 'end' = 'start',
  side: PreviewSurfaceSide = 'bottom',
): SurfacePoint => {
  const { x, y, top, bottom, right } = anchor
  const [point, setPoint] = useState<SurfacePoint>({ x, y, flipped: false })
  useLayoutEffect(() => {
    const size = sizeOf(ref.current)
    if (side === 'right') {
      // Flyout submenu: thân surface nằm NGANG item, thẳng mép trên item. Menu chỉ ~218-260px
      // nên một thẻ 320px mọc xuống dưới item sẽ phủ hết các item còn lại (và surface này
      // pointer-events: none, nghĩa là nó không chặn chuột nhưng nó CHE chữ — người bấm không
      // còn thấy mình đang bấm gì). Hết chỗ bên phải — menu thường đã bị clamp sát mép màn
      // hình — thì lật sang bên trái item; cuối cùng clampPoint giữ nó trong viewport.
      const toRight = right + gap
      const left = toRight + size.w <= window.innerWidth - margin ? toRight : Math.max(margin, x - size.w - gap)
      setPoint({ ...clampPoint({ x: left, y: top }, size), flipped: false })
      return
    }
    // align 'end' = mép phải của surface thẳng hàng mép phải trigger (chuông, tài khoản
    // nằm ở góc phải topbar — mở xuống mà canh trái thì popover tràn ra ngoài màn hình).
    const left = align === 'end' && right > 0 ? right - size.w : x
    const canFlip = bottom > 0 && top - size.h - gap > margin
    const flipped = canFlip && y + size.h > window.innerHeight - margin
    const clamped = clampPoint({ x: left, y: flipped ? top - size.h - gap : y }, size)
    setPoint({ ...clamped, flipped })
  }, [align, bottom, ref, right, side, top, x, y])
  return point
}

// Đóng surface khi: bấm ra ngoài, bấm chuột phải chỗ khác, Esc, đổi trang (ghi hash), hoặc nội
// dung cuộn / cửa sổ đổi cỡ (surface fixed sẽ trôi khỏi trigger nên thà đóng còn hơn treo lạc chỗ).
export const useSurfaceDismiss = (
  open: boolean,
  onClose: () => void,
  surfaceRef: RefObject<HTMLElement | null>,
  triggerRef?: RefObject<HTMLElement | null>,
): void => {
  useEffect(() => {
    if (!open) return
    const isInside = (target: EventTarget | null): boolean =>
      (surfaceRef.current?.contains(target as Node) ?? false) || (triggerRef?.current?.contains(target as Node) ?? false)
    const onPointerDown = (event: PointerEvent): void => { if (!isInside(event.target)) onClose() }
    const onContextMenu = (event: MouseEvent): void => { if (!isInside(event.target)) onClose() }
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    const onReflow = (): void => onClose()
    // "Mở Project" trong popover thông báo là một chuyến ĐI, không phải một thao tác ở lại:
    // trang mới render xong mà popover còn treo trên nó thì người dùng thấy hai lớp nội dung
    // chồng nhau và không biết mình đang ở đâu. Hai tín hiệu, vì một cái không đủ:
    //   · previewNavigateEvent — mọi lần openSection, kể cả khi hash đứng nguyên (đã ở đích);
    //   · hashchange — chuyến đi không đi qua openSection: nút Back của trình duyệt, người dùng
    //     tự sửa URL, F5. Surface không nghe được React state nên phải nghe từ window.
    const onNavigate = (): void => onClose()
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('contextmenu', onContextMenu, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener(previewNavigateEvent, onNavigate)
    window.addEventListener('hashchange', onNavigate)
    // scroll không bubble nhưng capture từ window vẫn nhận được — đây là cách chuẩn
    // để biết một panel bất kỳ trong trang vừa cuộn.
    window.addEventListener('scroll', onReflow, true)
    window.addEventListener('resize', onReflow)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('contextmenu', onContextMenu, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(previewNavigateEvent, onNavigate)
      window.removeEventListener('hashchange', onNavigate)
      window.removeEventListener('scroll', onReflow, true)
      window.removeEventListener('resize', onReflow)
    }
  }, [onClose, open, surfaceRef, triggerRef])
}

// Roving focus: ArrowUp/ArrowDown/Home/End nhảy giữa các item CÒN bật. Item tắt bị loại
// khỏi danh sách vì cho focus vào đó là bỏ người dùng bàn phím vào chỗ chết.
export const useRovingFocus = (open: boolean, containerRef: RefObject<HTMLElement | null>): void => {
  useEffect(() => {
    if (!open) return
    const container = containerRef.current
    if (!container) return
    const items = (): HTMLButtonElement[] =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled]), [role="option"]:not([disabled])'))
    items()[0]?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      const list = items()
      const index = list.indexOf(document.activeElement as HTMLButtonElement)
      if (list.length === 0 || index === -1) return
      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (step === 0 && event.key !== 'Home' && event.key !== 'End') return
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : (index + step + list.length) % list.length
      list[next]?.focus()
    }
    container.addEventListener('keydown', onKeyDown)
    return () => container.removeEventListener('keydown', onKeyDown)
  }, [containerRef, open])
}

// Dialog có scrim: Tab quẩn trong dialog, Esc hủy, đóng thì trả focus về đúng nút đã mở.
export const useDialogFocus = (ref: RefObject<HTMLElement | null>, onClose: () => void): void => {
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusables = (): HTMLElement[] => Array.from(element.querySelectorAll<HTMLElement>(
      'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ))
    focusables()[0]?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (event.shiftKey && active === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus() }
      else if (!element.contains(active)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // isConnected chặn trường hợp nút trigger đã bị gỡ khỏi DOM (danh sách đổi vì xóa bản ghi).
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [onClose, ref])
}
