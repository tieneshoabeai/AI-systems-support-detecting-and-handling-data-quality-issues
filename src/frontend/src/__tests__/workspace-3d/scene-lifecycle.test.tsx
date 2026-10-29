import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import type { ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { RootState } from '@react-three/fiber'
import { ResourceScene, SceneController } from '../../graphics/workspace-3d/resource-scene'
import { ResourceCameraController } from '../../graphics/workspace-3d/resource-camera-controller'
import { layoutResources } from '../../math/workspace-3d/resource-layout'
import { extendedPreviewResources, previewResources } from '../../views/workspace-3d/preview-resources'
import { fitPose, overviewDirection, overviewPose } from '../../math/workspace-3d/resource-camera'

const mode = vi.hoisted(() => ({ fail: false }))
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(), useThree: vi.fn(),
  Canvas: ({ fallback }: { fallback: ReactNode }) => {
    if (mode.fail) throw new Error('Test renderer initialization failure')
    return fallback
  },
}))
afterEach(() => { cleanup(); vi.restoreAllMocks(); mode.fail = false })

it('shows DOM recovery instructions for both unsupported WebGL and renderer exceptions', () => {
  const props = { layout: layoutResources(previewResources), selectedId: null, onSelect: vi.fn(), moving: false, tabHidden: false, resetKey: 0 }
  const rendered = render(<ResourceScene {...props} />)
  expect(screen.getByRole('status').textContent).toContain('không hỗ trợ WebGL')
  rendered.unmount()
  mode.fail = true
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(<ResourceScene {...props} />)
  expect(screen.getByRole('status').textContent).toContain('Không thể hiển thị 3D')
  expect(screen.queryByRole('button', { name: 'Đơn hàng' })).toBeNull()
})

it('cleans up real OrbitControls and context listeners across StrictMode remounts', () => {
  const canvas = document.createElement('canvas')
  const add = vi.spyOn(canvas, 'addEventListener')
  const remove = vi.spyOn(canvas, 'removeEventListener')
  const camera = new PerspectiveCamera(40, 1.5, 0.1, 500)
  vi.mocked(useThree).mockReturnValue({ camera, gl: { domElement: canvas }, invalidate: vi.fn(), size: { width: 900, height: 600 } } as unknown as ReturnType<typeof useThree>)
  const lost = vi.fn()
  const rendered = render(<StrictMode><ResourceCameraController layout={layoutResources(previewResources)} resetKey={0} reducedMotion={false} onContextLost={lost} active /></StrictMode>)
  expect(camera.position.length()).toBeGreaterThan(0)
  const event = new Event('webglcontextlost', { cancelable: true })
  fireEvent(canvas, event)
  expect(lost).toHaveBeenCalledTimes(1)
  expect(event.defaultPrevented).toBe(true)
  rendered.unmount()
  for (const type of ['webglcontextlost', 'pointerdown', 'wheel', 'contextmenu']) {
    const added = add.mock.calls.filter(([name]) => name === type)
    const removed = remove.mock.calls.filter(([name]) => name === type)
    expect(added.length).toBeGreaterThan(0)
    // OrbitControls may disconnect an already disconnected listener during disposal.
    for (const [, listener] of added) expect(removed.some(([, removedListener]) => removedListener === listener)).toBe(true)
  }
  fireEvent(canvas, new Event('webglcontextlost'))
  expect(lost).toHaveBeenCalledTimes(1)
})

it('focuses repeatedly by command identity, supports pan/dolly, and resets without recreating controls on resize', () => {
  const canvas = document.createElement('canvas')
  const add = vi.spyOn(canvas, 'addEventListener')
  const camera = new PerspectiveCamera(40, 1.5, 0.1, 500)
  const state = { camera, gl: { domElement: canvas }, invalidate: vi.fn(), size: { width: 900, height: 600 } }
  vi.mocked(useThree).mockReturnValue(state as unknown as ReturnType<typeof useThree>)
  const layout = layoutResources(extendedPreviewResources)
  const props = { layout, resetKey: 0, reducedMotion: true, active: true, onContextLost: vi.fn() }
  const rendered = render(<ResourceCameraController {...props} />)
  const listeners = add.mock.calls.length
  const frame = (delta = 1 / 60) => act(() => vi.mocked(useFrame).mock.calls.at(-1)![0]({} as RootState, delta))
  const node = layout.nodes.at(-1)!
  const expected = fitPose([node], new Vector3(...node.position), overviewDirection(), 40, 1.5)
  rendered.rerender(<ResourceCameraController {...props} command={{ sequence: 1, type: 'focus', resourceId: node.resource.id }} />)
  frame()
  expect(camera.position.distanceTo(expected.position)).toBeLessThan(1e-8)
  const focused = camera.position.clone()
  rendered.rerender(<ResourceCameraController {...props} command={{ sequence: 2, type: 'right' }} />)
  frame()
  expect(camera.position.distanceTo(focused)).toBeGreaterThan(0.5)
  rendered.rerender(<ResourceCameraController {...props} command={{ sequence: 3, type: 'focus', resourceId: node.resource.id }} />)
  frame()
  expect(camera.position.distanceTo(focused)).toBeLessThan(1e-8)
  rendered.rerender(<ResourceCameraController {...props} command={{ sequence: 4, type: 'near' }} />)
  frame()
  expect(camera.position.distanceTo(new Vector3(...node.position))).toBeLessThan(focused.distanceTo(new Vector3(...node.position)))
  const beforeResize = camera.position.clone()
  state.size = { width: 1100, height: 600 }
  rendered.rerender(<ResourceCameraController {...props} command={{ sequence: 4, type: 'near' }} />)
  frame()
  expect(camera.position.distanceTo(beforeResize)).toBeLessThan(1e-8)
  expect(add.mock.calls.length).toBe(listeners)
  rendered.rerender(<ResourceCameraController {...props} resetKey={1} />)
  frame()
  expect(camera.position.distanceTo(focused)).toBeGreaterThan(10)
  const resetPosition = camera.position.clone()
  rendered.rerender(<ResourceCameraController {...props} resetKey={1} command={{ sequence: 5, type: 'focus', resourceId: 'missing' }} />)
  frame()
  expect(camera.position.distanceTo(resetPosition)).toBeLessThan(1e-8)
  const scoped = layoutResources(extendedPreviewResources, 'demo-project-0')
  rendered.rerender(<ResourceCameraController {...props} layout={scoped} resetKey={1} command={{ sequence: 5, type: 'focus', resourceId: 'missing' }} />)
  frame()
  expect(camera.position.distanceTo(overviewPose(scoped, 40, 1100 / 600).position)).toBeLessThan(1e-8)
})

it('animates in demand frames, pauses hidden tabs, completes on return, and lets real controls interrupt', () => {
  const canvas = document.createElement('canvas')
  const camera = new PerspectiveCamera(40, 1.5, 0.1, 500)
  const invalidate = vi.fn()
  vi.mocked(useThree).mockReturnValue({ camera, gl: { domElement: canvas }, invalidate, size: { width: 900, height: 600 } } as unknown as ReturnType<typeof useThree>)
  const layout = layoutResources(previewResources)
  const props = { layout, resetKey: 0, reducedMotion: false, active: true, onContextLost: vi.fn() }
  const rendered = render(<ResourceCameraController {...props} />)
  const start = camera.position.clone()
  const command = { sequence: 1, type: 'focus' as const, resourceId: 'demo-orders' }
  const frame = (delta = 1 / 60) => act(() => vi.mocked(useFrame).mock.calls.at(-1)![0]({} as RootState, delta))
  rendered.rerender(<ResourceCameraController {...props} command={command} />)
  frame()
  expect(camera.position.distanceTo(start)).toBeGreaterThan(0)
  expect(invalidate).toHaveBeenCalled()
  const mid = camera.position.clone()
  rendered.rerender(<ResourceCameraController {...props} command={command} active={false} />)
  frame(100)
  expect(camera.position.distanceTo(mid)).toBeLessThan(1e-8)
  rendered.rerender(<ResourceCameraController {...props} command={command} />)
  frame()
  const end = camera.position.clone()
  frame()
  expect(camera.position.distanceTo(end)).toBeLessThan(1e-8)
  expect(end.distanceTo(mid)).toBeGreaterThan(0)
  rendered.rerender(<ResourceCameraController {...props} command={{ sequence: 2, type: 'reset' }} />)
  frame()
  fireEvent.wheel(canvas, { deltaY: 10 })
  const interrupted = camera.position.clone()
  frame()
  expect(camera.position.distanceTo(interrupted)).toBeLessThan(1e-8)
})

it('allows right-drag and Shift-left-drag to pan with real OrbitControls', () => {
  const canvas = document.createElement('canvas')
  Object.defineProperties(canvas, { clientWidth: { value: 900 }, clientHeight: { value: 600 } })
  canvas.setPointerCapture = vi.fn()
  canvas.releasePointerCapture = vi.fn()
  const camera = new PerspectiveCamera(40, 1.5, 0.1, 500)
  vi.mocked(useThree).mockReturnValue({ camera, gl: { domElement: canvas }, invalidate: vi.fn(), size: { width: 900, height: 600 } } as unknown as ReturnType<typeof useThree>)
  render(<ResourceCameraController layout={layoutResources(previewResources)} resetKey={0} reducedMotion onContextLost={vi.fn()} active />)
  for (const [button, shiftKey] of [[2, false], [0, true]] as const) {
    const before = camera.position.clone()
    const heading = camera.getWorldDirection(new Vector3())
    const pointer = (type: string, x: number) => Object.assign(new MouseEvent(type, { button, shiftKey, clientX: x, clientY: 300, bubbles: true }), { pointerId: 1, pointerType: 'mouse' })
    act(() => {
      canvas.dispatchEvent(pointer('pointerdown', 450))
      document.dispatchEvent(pointer('pointermove', 500))
      document.dispatchEvent(pointer('pointerup', 500))
    })
    expect(camera.position.distanceTo(before)).toBeGreaterThan(0.1)
    expect(camera.getWorldDirection(new Vector3()).distanceTo(heading)).toBeLessThan(1e-8)
  }
})

it('applies the label policy to DOM labels and leader lines, including selection/hover/focus', () => {
  const canvas = document.createElement('canvas')
  const camera = new PerspectiveCamera(40, 1.5, 0.1, 500)
  const state = { camera, gl: { domElement: canvas }, invalidate: vi.fn(), size: { width: 1024, height: 600 } }
  vi.mocked(useThree).mockReturnValue(state as unknown as ReturnType<typeof useThree>)
  const labels = new Map(extendedPreviewResources.map(node => [node.id, document.createElement('button')]))
  const lines = new Map(extendedPreviewResources.map(node => [node.id, document.createElementNS('http://www.w3.org/2000/svg', 'line')]))
  const props = { layout: layoutResources(extendedPreviewResources), resetKey: 0, labels, lines, selectedId: null, active: true, onContextLost: vi.fn() }
  render(<ResourceCameraController layout={props.layout} resetKey={0} reducedMotion onContextLost={props.onContextLost} active />)
  const frame = () => act(() => { vi.mocked(useFrame).mock.calls.at(-1)![0]({} as RootState, 1 / 60) })
  const visible = () => [...labels.values()].filter(label => label.style.visibility === 'visible').length
  const rendered = render(<SceneController {...props} />)
  frame()
  expect(visible()).toBe(5) // one workspace and four projects; all 25 datasets still exist
  expect(labels.get('demo-dataset-0')!.getAttribute('aria-hidden')).toBe('true')
  expect(lines.get('demo-dataset-0')!.style.visibility).toBe('hidden')
  rendered.rerender(<SceneController {...props} selectedId="demo-dataset-0" hoveredId="demo-dataset-1" focusedId="demo-dataset-2" />)
  frame()
  expect(visible()).toBe(8)
  expect(labels.get('demo-dataset-2')!.getAttribute('aria-hidden')).toBe('false')
  rendered.rerender(<SceneController {...props} />)
  frame()
  expect(visible()).toBe(5)

  const scoped = layoutResources(extendedPreviewResources, 'demo-project-0') // 1 project, 7 datasets
  rendered.rerender(<SceneController {...props} layout={scoped} />)
  frame()
  expect(scoped.nodes.filter(node => labels.get(node.resource.id)!.style.visibility === 'visible')).toHaveLength(8)
  state.size = { width: 341, height: 380 }
  camera.aspect = 341 / 380
  rendered.rerender(<SceneController {...props} layout={scoped} />)
  frame()
  expect(scoped.nodes.filter(node => labels.get(node.resource.id)!.style.visibility === 'visible')).toHaveLength(1)
})
