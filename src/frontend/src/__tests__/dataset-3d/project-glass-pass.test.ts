import { afterEach, expect, it, vi } from 'vitest'
import { bindProjectGlassPass, createProjectGlassPass, projectGlassRect } from '../../graphics/holographic-core/project-glass-pass'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('maps DOM top-left bounds to canvas bottom-left CSS coordinates independently of DPR', () => {
  const canvas = { left: 12, top: 130, width: 1200, height: 600 }
  const panel = { left: 720, top: 142, width: 480, height: 576 }
  expect(projectGlassRect(canvas, panel).toArray()).toEqual([708, 12, 480, 576])
})

it('follows a resized mobile panel and shifted/scrolled canvas without fixed 40% assumptions', () => {
  const canvas = { left: 12, top: -50, width: 366, height: 420 }
  const panel = { left: 24, top: -38, width: 342, height: 396 }
  expect(projectGlassRect(canvas, panel).toArray()).toEqual([12, 12, 342, 396])
})

it('updates the lens after resize and removes the refractive marker when closed', () => {
  const disconnect = vi.fn()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect })
  const canvas = document.createElement('canvas')
  const panel = document.createElement('aside')
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 12, top: 100, width: 1000, height: 500 } as DOMRect)
  const bounds = vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({ left: 600, top: 112, width: 400, height: 476 } as DOMRect)
  const pass = createProjectGlassPass()
  const cleanup = bindProjectGlassPass(pass, canvas, panel, true)
  expect(pass.enabled).toBe(true)
  expect(panel.hasAttribute('data-refractive')).toBe(true)
  expect(pass.uniforms.uRect.value.toArray()).toEqual([588, 12, 400, 476])
  expect(pass.uniforms.uLight.value).toBe(1)
  bounds.mockReturnValue({ left: 24, top: 112, width: 976, height: 476 } as DOMRect)
  window.dispatchEvent(new Event('resize'))
  expect(pass.uniforms.uRect.value.toArray()).toEqual([12, 12, 976, 476])
  cleanup?.()
  expect(pass.enabled).toBe(false)
  expect(panel.hasAttribute('data-refractive')).toBe(false)
  expect(disconnect).toHaveBeenCalledOnce()
  pass.dispose()
})
