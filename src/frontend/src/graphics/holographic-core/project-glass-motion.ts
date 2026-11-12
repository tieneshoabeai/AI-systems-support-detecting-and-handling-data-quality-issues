import { Vector2, Vector4 } from 'three'

type Box = { x: number; y: number; width: number; height: number }
const motions = new WeakMap<HTMLElement, GlassMotion>()
const clamp = (value: number) => Math.max(0, Math.min(1, value))

// 250ms on-screen morph, strong ease-in-out from the shared motion guidance.
export function glassMorphEase(value: number) {
  const t = clamp(value)
  const bezier = (p: number, a: number, b: number) => 3 * (1 - p) ** 2 * p * a + 3 * (1 - p) * p * p * b + p ** 3
  let low = 0, high = 1
  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2
    if (bezier(mid, .77, .175) < t) low = mid
    else high = mid
  }
  return t === 0 || t === 1 ? t : bezier((low + high) / 2, 0, 1)
}

export function createGlassMotion() {
  let value = 0, start = 0, target = 0, elapsed = 0
  let press = 0, pressVelocity = 0, pressing = false
  const pointer = new Vector2(.18, .85)
  const pointerTarget = pointer.clone()
  let ready = false
  return {
    get progress() { return value },
    get pressure() { return press },
    get pointer() { return pointer },
    get ready() { return ready },
    get settled() { return value === target && Math.abs(pressVelocity) < .001 && Math.abs(press - (pressing ? 1 : 0)) < .001 && pointer.distanceToSquared(pointerTarget) < .000001 },
    setOpen(open: boolean, instant: boolean) {
      start = value
      target = open ? 1 : 0
      elapsed = 0
      ready = false
      pressing = false
      if (instant) { value = target; ready = open; press = 0; pressVelocity = 0 }
    },
    setPointer(x: number, y: number, instant = false) {
      pointerTarget.set(clamp(x), clamp(y))
      if (instant) pointer.copy(pointerTarget)
    },
    press(active: boolean, instant: boolean) {
      pressing = active
      if (instant) { press = active ? 1 : 0; pressVelocity = 0 }
    },
    update(delta: number, reduced = false) {
      const dt = Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, .05))
      elapsed = Math.min(.25, elapsed + dt)
      value = start + (target - start) * glassMorphEase(elapsed / .25)
      if (elapsed === .25) value = target
      // mass=1, stiffness=100, damping=10; substeps keep touch releases stable.
      const steps = Math.max(1, Math.ceil(dt / (1 / 120)))
      for (let i = 0; i < steps; i++) {
        const step = dt / steps
        pressVelocity += (100 * ((pressing ? 1 : 0) - press) - 10 * pressVelocity) * step
        press += pressVelocity * step
      }
      if (reduced) { value = target; press = pressing ? 1 : 0; pressVelocity = 0 }
      pointer.lerp(pointerTarget, reduced ? 1 : 1 - Math.exp(-16 * dt))
      ready = target === 1 && value === 1
    },
  }
}

type GlassMotion = ReturnType<typeof createGlassMotion> & {
  renderDriven?: boolean
  paint?: () => void
  reduced?: boolean
  origin?: Box
  panel?: Box
  canvas?: DOMRect
}

export function readGlassMotion(panel: HTMLElement) { return motions.get(panel) }

export function glassMotionRect(panel: Box, origin: Box, progress: number, pressure: number) {
  const scale = 1 - pressure * .012
  const width = (origin.width + (panel.width - origin.width) * progress) * scale
  const height = (origin.height + (panel.height - origin.height) * progress) * scale
  const x = origin.x + origin.width / 2 + (panel.x + panel.width / 2 - origin.x - origin.width / 2) * progress
  const y = origin.y + origin.height / 2 + (panel.y + panel.height / 2 - origin.y - origin.height / 2) * progress
  return new Vector4(x - width / 2, y - height / 2, width, height)
}

// DOM lifecycle owns motion; WebGL reads the same values before drawing. No React
// state updates per frame, no pointer capture/preventDefault on content controls.
export function bindProjectGlassMotion(panel: HTMLElement) {
  const stage = panel.parentElement!
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const state: GlassMotion = createGlassMotion()
  motions.set(panel, state)
  let raf = 0, previous = 0, closed = false, readySent = false, disposed = false, pointerId: number | null = null
  const content = panel.querySelector<HTMLElement>('.project-module-content')
  const reduced = () => media?.matches === true || panel.dataset.instant === 'true'
  const measure = () => {
    const viewport = stage.getBoundingClientRect()
    const nav = stage.querySelector<HTMLElement>('.pj-modules')
    if (nav) stage.style.setProperty('--project-nav-height', `${nav.offsetHeight}px`)
    state.canvas = viewport
    state.panel = { x: panel.offsetLeft, y: panel.offsetTop, width: panel.offsetWidth, height: panel.offsetHeight }
    const source = stage.querySelector<HTMLElement>(`.pj-module[data-module="${panel.dataset.module}"]`)
    const box = source?.getBoundingClientRect()
    state.origin = box ? { x: box.left - viewport.left, y: box.top - viewport.top, width: box.width, height: box.height }
      : { ...state.panel, width: 48, height: 44 }
  }
  const paint = () => {
    if (!state.panel || !state.origin) return
    state.reduced = reduced()
    const rect = glassMotionRect(state.panel, state.origin, state.progress, state.reduced ? 0 : state.pressure)
    const sx = rect.z / Math.max(1, state.panel.width), sy = rect.w / Math.max(1, state.panel.height)
    panel.style.transformOrigin = '0 0'
    panel.style.transform = `translate(${rect.x - state.panel.x}px, ${rect.y - state.panel.y}px) scale(${sx}, ${sy})`
    panel.style.opacity = String(Math.min(1, state.progress * 8))
    panel.style.pointerEvents = state.ready ? '' : 'none'
    stage.toggleAttribute('data-glass-transition', state.progress > 0 && !state.ready)
    if (content) {
      content.style.opacity = state.ready ? '1' : '0'
      content.style.visibility = state.ready ? 'visible' : 'hidden'
    }
    if (state.ready && !readySent) { readySent = true; panel.dispatchEvent(new Event('project-glass-ready')) }
    if (state.progress === 0 && panel.dataset.open !== 'true' && !closed) {
      closed = true
      panel.dispatchEvent(new Event('project-glass-closed'))
    }
  }
  const tick = (now: number) => {
    if (disposed) return
    raf = 0
    state.update(previous ? (now - previous) / 1000 : 1 / 60, reduced())
    previous = now
    if (!state.renderDriven) paint()
    if (!disposed && !state.settled) raf = requestAnimationFrame(tick)
    else previous = 0
  }
  const wake = () => { if (!disposed && !raf) raf = requestAnimationFrame(tick) }
  state.paint = paint
  const retarget = () => {
    measure()
    closed = false
    readySent = false
    state.setOpen(panel.dataset.open === 'true', reduced())
    if (!state.renderDriven) paint()
    wake()
  }
  const pointer = (event: PointerEvent) => {
    if (!state.panel || !state.canvas) return
    if (event.type === 'pointermove' && event.pointerType !== 'mouse' && pointerId !== event.pointerId) return
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
    if (event.type === 'pointermove' && event.pointerType === 'mouse' && !fine) return
    const x = (event.clientX - state.canvas.left - state.panel.x) / Math.max(1, state.panel.width)
    const y = 1 - (event.clientY - state.canvas.top - state.panel.y) / Math.max(1, state.panel.height)
    state.setPointer(x, y, reduced())
    if (event.type === 'pointerdown' && event.isPrimary && event.button === 0) {
      pointerId = event.pointerId
      state.press(true, reduced())
    }
    wake()
  }
  const release = () => { pointerId = null; state.press(false, reduced()); wake() }
  const leave = () => { state.setPointer(.18, .85, reduced()); release() }
  const onMedia = () => retarget()
  const resized = () => { measure(); if (!state.renderDriven) paint(); wake() }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resized) : null
  observer?.observe(stage)
  observer?.observe(panel)
  const nav = stage.querySelector('.pj-modules')
  if (nav) observer?.observe(nav)
  const attributes = new MutationObserver(retarget)
  attributes.observe(panel, { attributes: true, attributeFilter: ['data-open', 'data-module', 'data-instant'] })
  panel.addEventListener('pointermove', pointer)
  panel.addEventListener('pointerdown', pointer)
  panel.addEventListener('pointerleave', leave)
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)
  window.addEventListener('blur', leave)
  window.addEventListener('resize', resized)
  window.addEventListener('scroll', resized, true)
  media?.addEventListener('change', onMedia)
  retarget()
  return () => {
    disposed = true
    cancelAnimationFrame(raf)
    observer?.disconnect(); attributes.disconnect()
    panel.removeEventListener('pointermove', pointer)
    panel.removeEventListener('pointerdown', pointer)
    panel.removeEventListener('pointerleave', leave)
    window.removeEventListener('pointerup', release)
    window.removeEventListener('pointercancel', release)
    window.removeEventListener('blur', leave)
    window.removeEventListener('resize', resized)
    window.removeEventListener('scroll', resized, true)
    media?.removeEventListener('change', onMedia)
    stage.removeAttribute('data-glass-transition')
    motions.delete(panel)
  }
}
