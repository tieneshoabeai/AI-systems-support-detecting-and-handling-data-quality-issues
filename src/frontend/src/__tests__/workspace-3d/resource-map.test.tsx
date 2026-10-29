import { StrictMode, useState } from 'react'
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ResourceMap } from '../../views/workspace-3d/workspace-3d.view'
import { previewResources } from '../../views/workspace-3d/preview-resources'
import { useSceneMotion } from '../../hooks/workspace-3d/use-scene-motion'
import type { ResourceNode } from '../../types/workspace-3d/resource-map.types'
import type { CameraCommand } from '../../types/workspace-3d/resource-map.types'

// UI tests deliberately do not claim to exercise a GPU.
const sceneProbe = vi.hoisted(() => vi.fn())
vi.mock('../../graphics/workspace-3d/resource-scene', () => ({ ResourceScene: (props: unknown) => {
  sceneProbe(props)
  return <div role="status">WebGL fallback fixture</div>
} }))

let media: EventTarget & { matches: boolean }
beforeEach(() => {
  sceneProbe.mockClear()
  media = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('matchMedia', () => media)
})

it('sends focus on activation, including the same ID again, while keyboard focus only pins a label', () => {
  render(<Harness />)
  const latest = () => sceneProbe.mock.calls.at(-1)![0] as { command?: CameraCommand; focusedId: string | null; onSelect(id: string): void }
  const button = screen.getByRole('button', { name: /Khách hàng Dataset/ })
  fireEvent.focus(button)
  expect(latest().focusedId).toBe('demo-customers')
  expect(latest().command).toBeUndefined()
  fireEvent.click(button)
  const first = latest().command!
  expect(first).toMatchObject({ type: 'focus', resourceId: 'demo-customers' })
  fireEvent.click(button)
  expect(latest().command!.sequence).toBeGreaterThan(first.sequence)
  act(() => latest().onSelect('demo-orders'))
  expect(latest().command).toMatchObject({ type: 'focus', resourceId: 'demo-orders' })
  expect(screen.getByRole('heading', { name: 'Đơn hàng' })).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Di chuyển tới trước' }))
  expect(latest().command!.type).toBe('forward')
  fireEvent.click(screen.getByRole('button', { name: 'Tới khối đã chọn' }))
  expect(latest().command).toMatchObject({ type: 'focus', resourceId: 'demo-orders' })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

function Harness({ resources = previewResources }: { resources?: readonly ResourceNode[] }) {
  const [selectedId, onSelect] = useState<string | null>('demo-orders')
  return <ResourceMap resources={resources} selectedId={selectedId} onSelect={onSelect} />
}

it('keeps selection, breadcrumb and details aligned while exploring and going back', () => {
  render(<Harness />)
  const panel = screen.getByRole('complementary')
  expect(within(panel).getByRole('heading', { name: 'Đơn hàng' })).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: /Bán hàng Project/ }))
  fireEvent.click(screen.getByRole('button', { name: /Khám phá Project/ }))
  expect(screen.getByText('3 tài nguyên trong góc nhìn')).toBeDefined()
  expect(within(screen.getByRole('navigation')).getByRole('button', { name: 'Bán hàng' }).getAttribute('aria-current')).toBe('location')
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Tổng quan' }))
  expect(screen.getByText('6 tài nguyên trong góc nhìn')).toBeDefined()
  expect(within(panel).getByRole('heading', { name: 'Chọn một tài nguyên' })).toBeDefined()
})

it('updates a selected name without losing identity and clears removed details', () => {
  const rendered = render(<Harness />)
  const renamed = previewResources.map(node => node.id === 'demo-orders' ? { ...node, name: 'Doanh thu tháng 10' } : node)
  rendered.rerender(<Harness resources={renamed} />)
  expect(within(screen.getByRole('complementary')).getByRole('heading', { name: 'Doanh thu tháng 10' })).toBeDefined()
  rendered.rerender(<Harness resources={renamed.filter(node => node.id !== 'demo-orders')} />)
  expect(screen.queryByText('Doanh thu tháng 10')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Chọn một tài nguyên' })).toBeDefined()
  rendered.rerender(<Harness resources={renamed} />)
  expect(screen.getByRole('heading', { name: 'Chọn một tài nguyên' })).toBeDefined()
})

it('handles empty/invalid input and keeps accessible selection with a renderer fallback', () => {
  const rendered = render(<Harness resources={[]} />)
  expect(screen.getByRole('heading', { name: 'Chưa có tài nguyên' })).toBeDefined()
  rendered.rerender(<Harness resources={[{ ...previewResources[3], parentId: 'missing' }]} />)
  expect(screen.getByRole('alert').textContent).toContain('parentId')
  rendered.rerender(<Harness />)
  expect(screen.getByRole('status').textContent).toContain('fallback')
  const button = screen.getByRole('button', { name: /Khách hàng Dataset/ })
  button.focus()
  expect(document.activeElement).toBe(button)
  fireEvent.click(button)
  expect(button.getAttribute('aria-pressed')).toBe('true')
})

it('responds live to reduced-motion/visibility and removes both subscriptions in StrictMode', () => {
  const addMedia = vi.spyOn(media, 'addEventListener')
  const removeMedia = vi.spyOn(media, 'removeEventListener')
  const addDocument = vi.spyOn(document, 'addEventListener')
  const removeDocument = vi.spyOn(document, 'removeEventListener')
  const hook = renderHook(useSceneMotion, { wrapper: StrictMode })
  expect(hook.result.current.moving).toBe(true)
  act(() => { media.matches = true; media.dispatchEvent(new Event('change')) })
  expect(hook.result.current.moving).toBe(false)
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  act(() => { media.matches = false; media.dispatchEvent(new Event('change')); document.dispatchEvent(new Event('visibilitychange')) })
  expect(hook.result.current.tabHidden).toBe(true)
  visibility.mockReturnValue('visible')
  act(() => { document.dispatchEvent(new Event('visibilitychange')) })
  expect(hook.result.current.moving).toBe(true)
  hook.unmount()
  expect(removeMedia.mock.calls.length).toBe(addMedia.mock.calls.length)
  expect(removeDocument.mock.calls.filter(([type]) => type === 'visibilitychange').length)
    .toBe(addDocument.mock.calls.filter(([type]) => type === 'visibilitychange').length)
})
