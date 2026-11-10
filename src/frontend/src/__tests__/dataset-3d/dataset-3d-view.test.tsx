import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { HolographicPartInfo } from '../../types/dataset-3d/holographic-part.types'
import { Dataset3DView } from '../../views/dataset-3d/dataset-3d.view'

const canvasProbe = vi.hoisted(() => vi.fn())
vi.mock('../../components/graphics/holographic-core/holographic-core.scene', () => ({ HolographicCoreCanvas: (props: { reducedMotion: boolean; detached: boolean; selectedId: string | null; onSelectPart(part: HolographicPartInfo | null): void }) => {
  canvasProbe(props)
  return <div role="img" aria-label="Holographic core fixture" />
} }))

const FIXTURE: HolographicPartInfo = {
  id: 'tower-02',
  name: 'Tower 02',
  role: 'projected-part',
  material: 'blue-face',
  level: 'component',
  dimensions: { width: 0.48, height: 1.95, depth: 0.48, units: 'relative' },
}

let media: EventTarget & { matches: boolean }

beforeEach(() => {
  canvasProbe.mockClear()
  media = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('matchMedia', () => media)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('renders the conceptual module map without claiming live data', () => {
  render(<MemoryRouter><Dataset3DView /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'Dataset 3D' })).toBeDefined()
  expect(screen.getByRole('img', { name: 'Holographic core fixture' })).toBeDefined()
  expect(screen.getByRole('complementary', { name: 'Bản đồ module' })).toBeDefined()
  const toggle = screen.getByRole('button', { name: 'Mở bản đồ module' })
  const content = document.getElementById(toggle.getAttribute('aria-controls')!)!
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(content.hidden).toBe(true)
  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  expect(content.hidden).toBe(false)
  expect(screen.getByText('Nhân dữ liệu')).toBeDefined()
  expect(screen.getByText('Tổng quan')).toBeDefined()
  expect(screen.getByText('Data View').closest('li')?.dataset.tone).toBe('blue')
  expect(screen.getByText('Data Analysis').closest('li')?.dataset.tone).toBe('cyan')
  expect(screen.getByText('Detection')).toBeDefined()
  expect(screen.getByText(/Nhân trung tâm là một bộ dữ liệu/)).toBeDefined()
  expect(screen.getByText(/chưa nối dữ liệu thật/)).toBeDefined()
  expect(canvasProbe).toHaveBeenLastCalledWith(expect.objectContaining({ reducedMotion: false, detached: false, selectedId: null, cubeFocus: null }))
})

it('keeps the module map state independent of detach and selected-part changes', () => {
  render(<MemoryRouter><Dataset3DView /></MemoryRouter>)
  const toggle = screen.getByRole('button', { name: 'Mở bản đồ module' })
  fireEvent.click(toggle)
  fireEvent.click(screen.getByRole('button', { name: 'Tách mô hình' }))
  act(() => { canvasProbe.mock.lastCall?.[0].onSelectPart(FIXTURE) })
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(screen.getByRole('heading', { name: 'Tower 02' })).toBeDefined()
  expect(canvasProbe).toHaveBeenLastCalledWith(expect.objectContaining({ detached: true, selectedId: 'tower-02' }))
  fireEvent.click(screen.getByRole('button', { name: 'Lắp lại mô hình' }))
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
})

it('passes the live reduced-motion preference to the canvas', () => {
  render(<MemoryRouter><Dataset3DView /></MemoryRouter>)
  act(() => { media.matches = true; media.dispatchEvent(new Event('change')) })
  expect(canvasProbe).toHaveBeenLastCalledWith(expect.objectContaining({ reducedMotion: true, detached: false, selectedId: null }))
  expect(screen.getByText(/đã tắt theo cài đặt thiết bị/)).toBeDefined()
})

it('focuses cubes from the legend and the scene, then clears focus on Escape or detach', () => {
  render(<MemoryRouter><Dataset3DView /></MemoryRouter>)
  const toggle = screen.getByRole('button', { name: 'Mở bản đồ module' })
  fireEvent.click(toggle)
  fireEvent.click(screen.getByRole('button', { name: 'Focus Data View' }))
  expect(canvasProbe.mock.lastCall?.[0].cubeFocus).toEqual({ theme: 'blue' })
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Về góc tổng quan' }))
  act(() => { canvasProbe.mock.lastCall?.[0].onFocusCube('orange') })
  expect(canvasProbe.mock.lastCall?.[0].cubeFocus).toEqual({ theme: 'orange' })
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(canvasProbe.mock.lastCall?.[0].cubeFocus).toBeNull()
  expect(document.activeElement).toBe(toggle)

  act(() => { canvasProbe.mock.lastCall?.[0].onFocusCube('cyan') })
  fireEvent.click(screen.getByRole('button', { name: 'Tách mô hình' }))
  expect(canvasProbe.mock.lastCall?.[0].cubeFocus).toBeNull()
  fireEvent.click(toggle)
  expect((screen.getByRole('button', { name: 'Focus Data Analysis' }) as HTMLButtonElement).disabled).toBe(true)
})

it('explodes the model and reports the original English metadata of a picked part', () => {
  render(<MemoryRouter><Dataset3DView /></MemoryRouter>)
  const detach = screen.getByRole('button', { name: 'Tách mô hình' })
  expect(detach.getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(detach)

  const reattach = screen.getByRole('button', { name: 'Lắp lại mô hình' })
  expect(reattach.getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByText(/Chạm vào một bộ phận trên mô hình/)).toBeDefined()
  expect(canvasProbe).toHaveBeenLastCalledWith(expect.objectContaining({ detached: true, selectedId: null }))

  act(() => { canvasProbe.mock.lastCall?.[0].onSelectPart(FIXTURE) })
  expect(screen.getByRole('heading', { name: 'Tower 02' })).toBeDefined()
  expect(screen.getByText('tower-02')).toBeDefined()
  expect(screen.getByText('projected-part')).toBeDefined()
  expect(screen.getByText('blue-face')).toBeDefined()
  expect(screen.getByText('component')).toBeDefined()
  expect(screen.getByText('0.48 × 1.95 × 0.48 · relative')).toBeDefined()
  expect(canvasProbe).toHaveBeenLastCalledWith(expect.objectContaining({ detached: true, selectedId: 'tower-02' }))

  fireEvent.click(screen.getByRole('button', { name: 'Đóng bảng thông tin' }))
  expect(screen.getByText(/Chạm vào một bộ phận trên mô hình/)).toBeDefined()
  expect(canvasProbe).toHaveBeenLastCalledWith(expect.objectContaining({ selectedId: null }))

  fireEvent.click(screen.getByRole('button', { name: 'Lắp lại mô hình' }))
  expect(screen.queryByText('THÔNG TIN BỘ PHẬN')).toBeNull()
  expect(canvasProbe).toHaveBeenLastCalledWith(expect.objectContaining({ reducedMotion: false, detached: false, selectedId: null }))
})
