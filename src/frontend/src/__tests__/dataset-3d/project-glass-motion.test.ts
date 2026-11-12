import { expect, it } from 'vitest'
import { createGlassMotion, glassMorphEase, glassMotionRect } from '../../graphics/holographic-core/project-glass-motion'

it('opens in 250ms, reverses from the current shape, and clears ready on exit', () => {
  const state = createGlassMotion()
  state.setOpen(true, false)
  state.update(.05)
  state.update(.05)
  const interrupted = state.progress
  expect(interrupted).toBeGreaterThan(0)
  expect(interrupted).toBeLessThan(1)
  expect(state.ready).toBe(false)
  state.setOpen(false, false)
  expect(state.progress).toBe(interrupted)
  state.update(.05)
  expect(state.progress).toBeLessThan(interrupted)
  for (let i = 0; i < 8; i++) state.update(.05)
  expect(state.progress).toBe(0)
  expect(state.ready).toBe(false)
  state.setOpen(true, false)
  for (let i = 0; i < 5; i++) state.update(.05)
  expect(state.progress).toBe(1)
  expect(state.ready).toBe(true)
})

it('snaps reduced motion/keyboard and releases a press back to rest', () => {
  const state = createGlassMotion()
  state.setOpen(true, true)
  expect(state.ready).toBe(true)
  state.press(true, false)
  for (let i = 0; i < 20; i++) state.update(1 / 60)
  expect(state.pressure).toBeGreaterThan(.9)
  state.press(false, false)
  for (let i = 0; i < 180; i++) state.update(1 / 60)
  expect(Math.abs(state.pressure)).toBeLessThan(.001)
  state.setOpen(false, true)
  expect(state.progress).toBe(0)
  state.setOpen(true, false)
  state.update(.01, true)
  expect(state.progress).toBe(1)
})

it('maps the same box to HTML and shader with a bounded press deformation', () => {
  const panel = { x: 600, y: 12, width: 400, height: 500 }
  const button = { x: 750, y: 550, width: 200, height: 44 }
  expect(glassMotionRect(panel, button, 0, 0).toArray()).toEqual([750, 550, 200, 44])
  expect(glassMotionRect(panel, button, 1, 0).toArray()).toEqual([600, 12, 400, 500])
  const pressed = glassMotionRect(panel, button, 1, 1)
  expect(pressed.z).toBeCloseTo(395.2)
  expect(pressed.w).toBeCloseTo(494)
  expect(pressed.x + pressed.z / 2).toBe(800)
  expect(pressed.y + pressed.w / 2).toBe(262)
  expect(glassMorphEase(0)).toBe(0)
  expect(glassMorphEase(1)).toBe(1)
})
