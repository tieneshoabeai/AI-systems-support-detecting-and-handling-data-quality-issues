const motions = new WeakMap<HTMLElement, GlassMotion>()
const fadeSeconds = .18

// Fade at the final panel bounds. No geometry morph, pointer tracking or springs.
export function createGlassMotion() {
  let value = 0, start = 0, target = 0, elapsed = 0
  return {
    get progress() { return value },
    get ready() { return target === 1 && value === 1 },
    get settled() { return value === target },
    setOpen(open: boolean, instant: boolean) {
      start = value
      target = open ? 1 : 0
      elapsed = 0
      if (instant) value = target
    },
    update(delta: number, reduced = false) {
      const dt = Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, .05))
      elapsed = Math.min(fadeSeconds, elapsed + dt)
      const t = elapsed / fadeSeconds
      value = reduced || elapsed === fadeSeconds ? target : start + (target - start) * (1 - (1 - t) ** 3)
    },
  }
}
type GlassMotion = ReturnType<typeof createGlassMotion> & {
  renderDriven?: boolean
  paint?: () => void
  requestFrame?: () => void
  pendingGeometry?: () => void
}
export function readGlassMotion(panel: HTMLElement) { return motions.get(panel) }

export function queueProjectGlassGeometry(panel: HTMLElement, apply: () => void): boolean {
  const motion = readGlassMotion(panel)
  if (!motion?.requestFrame) return false
  motion.pendingGeometry = apply
  motion.requestFrame()
  return true
}

export function bindProjectGlassMotion(panel: HTMLElement) {
  const stage = panel.parentElement!
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const state: GlassMotion = createGlassMotion()
  motions.set(panel, state)
  let raf = 0, previous = 0, closed = false, readySent = false, disposed = false
  const content = panel.querySelector<HTMLElement>('.project-module-content')
  const instant = () => media?.matches === true || panel.dataset['instant'] === 'true'
  const paint = () => {
    panel.style.opacity = String(state.progress)
    panel.style.pointerEvents = state.ready ? '' : 'none'
    stage.toggleAttribute('data-glass-transition', state.progress > 0 && !state.ready)
    if (content) {
      content.style.opacity = '1'
      content.style.visibility = state.progress > 0 ? 'visible' : 'hidden'
    }
    if (state.ready && !readySent) { readySent = true; panel.dispatchEvent(new Event('project-glass-ready')) }
    if (state.progress === 0 && panel.dataset['open'] !== 'true' && !closed) {
      closed = true
      panel.dispatchEvent(new Event('project-glass-closed'))
    }
  }
  const tick = (now: number) => {
    if (disposed) return
    raf = 0
    state.update(previous ? (now - previous) / 1000 : 1 / 60, instant())
    previous = now
    if (!state.renderDriven) paint()
    if (!disposed && !state.settled) raf = requestAnimationFrame(tick)
    else previous = 0
  }
  const wake = () => { if (!disposed && !raf) raf = requestAnimationFrame(tick) }
  state.paint = paint
  const retarget = () => {
    closed = false
    readySent = false
    state.setOpen(panel.dataset['open'] === 'true', instant())
    if (!state.renderDriven) paint()
    wake()
  }
  const attributes = new MutationObserver(retarget)
  attributes.observe(panel, { attributes: true, attributeFilter: ['data-open', 'data-module', 'data-instant'] })
  media?.addEventListener('change', retarget)
  retarget()
  return () => {
    disposed = true
    cancelAnimationFrame(raf)
    attributes.disconnect()
    media?.removeEventListener('change', retarget)
    stage.removeAttribute('data-glass-transition')
    panel.style.removeProperty('transform')
    panel.style.removeProperty('transform-origin')
    motions.delete(panel)
  }
}
