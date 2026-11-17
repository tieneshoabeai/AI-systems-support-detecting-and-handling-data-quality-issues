import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ShoppingRecordsView } from '../../views/processing/records/shopping-records.view'
import { PreviewSessionProvider } from '../../views/preview/preview-session'
import { previewMockStore } from '../../services/preview/preview-mock.service'

const demo = vi.hoisted(() => ({ enabled: vi.fn(() => true) }))
vi.mock('../../mocks/shopping-trends/demo-mode', () => ({ isShoppingDemo: demo.enabled }))

beforeEach(() => {
  sessionStorage.clear()
  demo.enabled.mockReturnValue(true)
  previewMockStore.reset()
})
afterEach(() => {
  cleanup()
  sessionStorage.clear()
  previewMockStore.reset()
})

function mount(projectId: string) {
  return render(<MemoryRouter initialEntries={[`/processing/projects/${projectId}/records`]}>
    <PreviewSessionProvider routeIds={{}}>
      <Routes>
        <Route path="/processing/projects/:projectId/records" element={<ShoppingRecordsView />} />
        <Route path="/processing/projects/:projectId" element={<h1>Project destination</h1>} />
      </Routes>
    </PreviewSessionProvider>
  </MemoryRouter>)
}

it('opens the full table for the demo project and follows its back link', async () => {
  mount('shopping-trends')
  expect(screen.getByRole('heading', { name: 'Shopping Trends — toàn bộ dữ liệu' })).toBeDefined()
  expect(await screen.findByText('Trang 1 / 78')).toBeDefined()
  fireEvent.click(screen.getByRole('link', { name: '← Về Project' }))
  expect(await screen.findByRole('heading', { name: 'Project destination' })).toBeDefined()
})

it.each(['prj-sales', 'missing'])('does not render shopping records for project %s', projectId => {
  mount(projectId)
  expect(screen.getByRole('heading', { name: 'Không tìm thấy dữ liệu project' })).toBeDefined()
  expect(screen.queryByRole('table')).toBeNull()
})

it('rejects the records route when demo mode is off', () => {
  demo.enabled.mockReturnValue(false)
  mount('shopping-trends')
  expect(screen.getByRole('heading', { name: 'Không tìm thấy dữ liệu project' })).toBeDefined()
  expect(screen.queryByRole('link', { name: '← Về Project' })).toBeNull()
})

it('rejects the records route after its project is removed from the store', async () => {
  expect(previewMockStore.getState().projects.some(project => project.id === 'shopping-trends')).toBe(true)
  await previewMockStore.remove('project', 'shopping-trends')
  expect(previewMockStore.getState().projects.some(project => project.id === 'shopping-trends')).toBe(false)
  mount('shopping-trends')
  expect(screen.getByRole('heading', { name: 'Không tìm thấy dữ liệu project' })).toBeDefined()
  expect(screen.queryByRole('table')).toBeNull()
})
