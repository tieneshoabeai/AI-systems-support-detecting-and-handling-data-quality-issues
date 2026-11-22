import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { MutableRefObject } from 'react'

const query = '(prefers-reduced-motion: reduce)'
// jsdom không cấp matchMedia: thiếu nó thì coi như không reduced, cùng cách guard
// của use-preview-color-scheme và preview-shell.
const reduced = () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches
const hidden = () => document.visibilityState === 'hidden'
const serverReduced = () => true
const subscribeMotion = (notify: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => {}
  const media = window.matchMedia(query)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
const subscribeVisibility = (notify: () => void) => {
  document.addEventListener('visibilitychange', notify)
  return () => document.removeEventListener('visibilitychange', notify)
}

// ---------------------------------------------------------------------------------------------
// Kéo để xoay cảnh: kéo ngang quay quanh trục dọc, kéo dọc ngửa lên/xuống (giới hạn để không
// lật ra sau lưng). Chỉ xoay, không zoom — cảnh nằm trong banner nên con lăn vẫn thuộc về trang.
// Pointer Events dùng chung cho chuột và cảm ứng; CSS `touch-action: pan-y` để vuốt dọc vẫn cuộn
// trang, chỉ kéo ngang mới xoay.
// ---------------------------------------------------------------------------------------------
export type SpinHandle = MutableRefObject<{
  x: number; y: number; tx: number; ty: number; vx: number; vy: number; dragging: boolean; limit: number
}>

export function useDragSpin(element: HTMLElement | null, invalidate?: () => void): SpinHandle {
  const spin = useRef({ x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, dragging: false, limit: .6 })
  useEffect(() => {
    if (!element) return
    let last = { x: 0, y: 0, time: 0 }
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      const state = spin.current
      state.dragging = true
      state.vx = 0
      state.vy = 0
      last = { x: event.clientX, y: event.clientY, time: performance.now() }
      // Con trỏ grabbing do CSS token quyết định, không ghi đè inline để còn đổi theo theme.
      element.dataset['dragging'] = 'true'
      // Pointer id có thể không còn hợp lệ (sự kiện tổng hợp, đã nhả tay trước đó): không để nó làm hỏng lượt kéo.
      try { element.setPointerCapture(event.pointerId) } catch { /* không bắt được con trỏ thì vẫn xoay theo sự kiện */ }
    }
    const onMove = (event: PointerEvent) => {
      const state = spin.current
      if (!state.dragging) return
      const now = performance.now()
      const elapsed = Math.max(now - last.time, 8)
      const dx = event.clientX - last.x
      const dy = event.clientY - last.y
      state.tx += dx * .006
      state.ty = Math.max(-state.limit, Math.min(state.limit, state.ty + dy * .004))
      // Vận tốc quy về frame 16ms để quán tính không phụ thuộc tần số sự kiện của thiết bị.
      state.vx = dx * .006 * (16 / elapsed)
      state.vy = dy * .004 * (16 / elapsed)
      last = { x: event.clientX, y: event.clientY, time: now }
      invalidate?.()
    }
    const onUp = (event: PointerEvent) => {
      spin.current.dragging = false
      delete element.dataset['dragging']
      try { if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId) } catch { /* con trỏ đã được nhả */ }
    }
    element.addEventListener('pointerdown', onDown)
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerup', onUp)
    element.addEventListener('pointercancel', onUp)
    return () => {
      element.removeEventListener('pointerdown', onDown)
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onUp)
      element.removeEventListener('pointercancel', onUp)
    }
  }, [element, invalidate])
  return spin
}

/** Bước làm mượt dùng chung: nhả tay thì chạy tiếp theo quán tính, rồi tiến dần về mục tiêu. */
export function easeSpin(spin: SpinHandle, delta: number) {
  const state = spin.current
  const step = Math.min(delta, .05)
  if (!state.dragging) {
    state.tx += state.vx
    state.ty = Math.max(-state.limit, Math.min(state.limit, state.ty + state.vy))
    const damping = Math.pow(.02, step)
    state.vx *= damping
    state.vy *= damping
    if (Math.abs(state.vx) < .0004) state.vx = 0
    if (Math.abs(state.vy) < .0004) state.vy = 0
  }
  const follow = 1 - Math.pow(.001, step)
  state.x += (state.tx - state.x) * follow
  state.y += (state.ty - state.y) * follow
}

export function useSceneMotion() {
  const reducedMotion = useSyncExternalStore(subscribeMotion, reduced, serverReduced)
  const tabHidden = useSyncExternalStore(subscribeVisibility, hidden, serverReduced)
  return { reducedMotion, tabHidden, moving: !reducedMotion && !tabHidden }
}
