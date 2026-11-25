import { afterEach, expect, it, vi } from 'vitest'
import { bindProjectGlassMotion, createGlassMotion, readGlassMotion } from '../../graphics/holographic-core/project-glass-motion'

afterEach(() => { vi.useRealTimers(); document.body.replaceChildren() })

it('fades in 180ms and reverses from the current opacity', () => {
  const state = createGlassMotion()
  state.setOpen(true, false)
  state.update(.05)
  const interrupted = state.progress
  expect(interrupted).toBeGreaterThan(0)
  expect(interrupted).toBeLessThan(1)
  state.setOpen(false, false)
  expect(state.progress).toBe(interrupted)
  state.update(.05)
  expect(state.progress).toBeLessThan(interrupted)
  for (let i = 0; i < 4; i++) state.update(.05)
  expect(state.progress).toBe(0)
  expect(state.ready).toBe(false)
  state.setOpen(true, false)
  for (let i = 0; i < 4; i++) state.update(.05)
  expect(state.progress).toBe(1)
  expect(state.ready).toBe(true)
  expect(state.settled).toBe(true)
})

it('snaps for keyboard and reduced motion', () => {
  const state = createGlassMotion()
  state.setOpen(true, true)
  expect(state.ready).toBe(true)
  state.setOpen(false, true)
  expect(state.progress).toBe(0)
  state.setOpen(true, false)
  state.update(.01, true)
  expect(state.progress).toBe(1)
})

it('keeps the panel geometry fixed, dispatches lifecycle events and disposes its state', async () => {
  vi.useFakeTimers()
  const stage = document.createElement('section')
  const panel = document.createElement('aside')
  const content = document.createElement('div')
  content.className = 'project-module-content'
  panel.dataset['open'] = 'true'
  panel.append(content)
  stage.append(panel)
  document.body.append(stage)
  const ready = vi.fn(), closed = vi.fn()
  panel.addEventListener('project-glass-ready', ready)
  panel.addEventListener('project-glass-closed', closed)
  const dispose = bindProjectGlassMotion(panel)
  await vi.advanceTimersByTimeAsync(300)
  expect(ready).toHaveBeenCalledOnce()
  expect(panel.style.opacity).toBe('1')
  expect(panel.style.transform).toBe('')
  panel.dispatchEvent(new MouseEvent('pointermove', { clientX: 100, clientY: 100 }))
  panel.dispatchEvent(new MouseEvent('pointerdown'))
  await vi.advanceTimersByTimeAsync(100)
  expect(panel.style.transform).toBe('')
  panel.dataset['open'] = 'false'
  await vi.advanceTimersByTimeAsync(300)
  expect(closed).toHaveBeenCalledOnce()
  expect(panel.style.opacity).toBe('0')
  dispose()
  expect(readGlassMotion(panel)).toBeUndefined()
  expect(vi.getTimerCount()).toBe(0)
})
