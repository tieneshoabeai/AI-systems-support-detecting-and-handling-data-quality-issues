import { useEffect, useRef } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { queueProjectGlassGeometry } from '../../../../graphics/holographic-core/project-glass-motion'
import styles from '../project-workspace.module.css'

const widthProperty = '--project-module-width'
const heightProperty = '--project-module-height'
const rightProperty = '--project-module-right'
const topProperty = '--project-module-top'
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function measure(panel: HTMLElement, stage: HTMLElement) {
  const rect = panel.getBoundingClientRect()
  const bounds = stage.getBoundingClientRect()
  const { width, height } = rect
  return {
    width,
    height,
    right: bounds.right - rect.right,
    top: rect.top - bounds.top,
    maxWidth: Math.max(width, rect.right - bounds.left),
    maxHeight: Math.max(height, bounds.bottom - rect.top),
  }
}

type Geometry = Partial<Pick<ReturnType<typeof measure>, 'width' | 'height' | 'right' | 'top'>>
type Drag = ReturnType<typeof measure> & { pointer: number; x: number; y: number }
type Grip = 'edge' | 'corner' | 'move'

function usePanelGrip(panel: HTMLElement | null, kind: Grip) {
  const drag = useRef<Drag | null>(null)
  const frame = useRef<number | null>(null)
  const pending = useRef<Geometry | null>(null)
  const moved = useRef(false)
  const stage = panel?.parentElement
  const moving = kind === 'move'
  const dragAttribute = moving ? 'data-moving' : 'data-resizing'

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    pending.current = null
    drag.current = null
    panel?.removeAttribute(dragAttribute)
  }, [dragAttribute, panel])

  if (!panel || !stage) return null
  const write = ({ width, height, right, top }: Geometry) => {
    if (width !== undefined) stage.style.setProperty(widthProperty, `${width}px`)
    if (height !== undefined) stage.style.setProperty(heightProperty, `${height}px`)
    if (right !== undefined) stage.style.setProperty(rightProperty, `${right}px`)
    if (top !== undefined) stage.style.setProperty(topProperty, `${top}px`)
  }
  const commit = (apply: () => void) => {
    if (!queueProjectGlassGeometry(panel, apply)) apply()
  }
  const flushDrag = () => {
    const geometry = pending.current
    pending.current = null
    if (geometry) write(geometry)
  }
  const reset = () => {
    if (moving) {
      stage.style.removeProperty(rightProperty)
      stage.style.removeProperty(topProperty)
    }
    stage.style.removeProperty(widthProperty)
    stage.style.removeProperty(heightProperty)
  }
  const toggle = () => {
    if (moving || stage.style.getPropertyValue(widthProperty) || stage.style.getPropertyValue(heightProperty)) reset()
    else write({ width: measure(panel, stage).maxWidth })
  }
  const adjust = (current: ReturnType<typeof measure>, dx: number, dy: number): Geometry => {
    if (moving) return { right: current.right - dx, top: current.top + dy }
    return {
      width: clamp(current.width - dx, 310, current.maxWidth),
      ...(dy ? { height: clamp(current.height + dy, 160, current.maxHeight) } : {}),
      // Keep the visible anchor when an earlier move was clamped by the stage.
      ...(stage.style.getPropertyValue(rightProperty) ? { right: current.right } : {}),
      ...(stage.style.getPropertyValue(topProperty) ? { top: current.top } : {}),
    }
  }
  const start = (event: PointerEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.button !== 0 || !event.isPrimary) return
    if (moving) {
      // Only explicitly marked chrome and empty areas move the panel.
      const target = event.target
      if (event.pointerType !== 'mouse' || !(target instanceof Element)
        || (!target.hasAttribute('data-panel-drag-area') && !target.closest('[data-panel-drag-title]'))
        || target.closest('button, a, input, select, textarea, label, summary, [contenteditable]')) return
      if (target instanceof HTMLElement && target.classList.contains('project-module-body')) {
        const bounds = target.getBoundingClientRect()
        if (event.clientX >= bounds.left + target.clientLeft + target.clientWidth
          || event.clientY >= bounds.top + target.clientTop + target.clientHeight) return
      }
      event.preventDefault()
    }
    moved.current = false
    drag.current = { ...measure(panel, stage), pointer: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current
    if (!current || current.pointer !== event.pointerId) return
    const dx = event.clientX - current.x
    const dy = kind === 'edge' ? 0 : event.clientY - current.y
    if (!moved.current) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 3) return
      moved.current = true
      panel.setAttribute(dragAttribute, '')
    }
    // Reapply the starting height when the corner returns to its initial y coordinate.
    pending.current = adjust(current, dx, dy)
    if (kind === 'corner' && !dy) pending.current.height = current.height
    if (queueProjectGlassGeometry(panel, flushDrag)) return
    if (frame.current !== null) return
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      if (pending.current) commit(flushDrag)
    })
  }
  const finish = (event: PointerEvent<HTMLElement>) => {
    if (drag.current?.pointer !== event.pointerId) return
    if (event.type === 'pointerup') move(event)
    drag.current = null
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    if (pending.current) commit(flushDrag)
    panel.removeAttribute(dragAttribute)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Home') { event.preventDefault(); commit(reset); return }
    const step = event.shiftKey ? 48 : 24
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
    const dy = kind === 'edge' ? 0 : event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0
    if (!dx && !dy) return
    event.preventDefault()
    commit(() => write(adjust(measure(panel, stage), dx, dy)))
  }

  return {
    pointerProps: { onPointerDown: start, onPointerMove: move, onPointerUp: finish, onPointerCancel: finish, onLostPointerCapture: finish },
    onKeyDown,
    click: (detail: number) => { if (detail === 0 || !moved.current) commit(toggle) },
    reset: () => commit(reset),
  }
}

function ResizeGrip({ panel, kind }: { panel: HTMLElement; kind: 'edge' | 'corner' }) {
  const grip = usePanelGrip(panel, kind)
  if (!grip) return null
  const label = kind === 'corner' ? 'Đổi chiều rộng và chiều cao cửa sổ' : 'Đổi chiều rộng cửa sổ'
  return <button type="button" className={`${styles['resizeGrip']} ${styles[kind === 'corner' ? 'resizeCorner' : 'resizeEdge']}`}
    aria-label={label} title={`${label}. Kéo hoặc dùng phím mũi tên. Bấm để mở rộng hoặc đặt lại.`}
    {...grip.pointerProps} onKeyDown={grip.onKeyDown} onClick={event => grip.click(event.detail)} />
}

export function ProjectPanelResize({ panel }: { panel: HTMLElement | null }) {
  return panel && <><ResizeGrip panel={panel} kind="edge" /><ResizeGrip panel={panel} kind="corner" /></>
}

export function useProjectPanelMove(panel: HTMLElement | null) {
  return usePanelGrip(panel, 'move')
}
