import { jsonObject } from '../support/json'
import { requireDefined } from '../../utils/required-value'
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createAxiosClient } from '../../lib/axios-client'
import { createAuthService } from '../../services/auth/auth.service'
import { createUsersService } from '../../services/users/users.service'
import { shoppingAuthAdapter } from '../../mocks/shopping-trends/auth-adapter'
import auth from '../../mocks/shopping-trends/auth.json'
import { analysis, detection, loadShoppingRows, metadata } from '../../mocks/shopping-trends/data'
import { useShoppingDetection } from '../../hooks/preview/use-shopping-detection'
import { ProjectWorkspaceView } from '../../views/preview/project-workspace-2d.view'
import { PreviewSessionProvider } from '../../views/preview/preview-session'
import { previewMockStore } from '../../services/preview/preview-mock.service'
import { ShoppingTable } from '../../views/preview/components/shopping-demo-content'
vi.mock('../../mocks/shopping-trends/demo-mode', () => ({ isShoppingDemo: () => true }))
vi.mock('../../views/dataset-3d/dataset-3d.view', () => ({ Dataset3DView: () => <div>Scene</div> }))
vi.mock('../../graphics/holographic-core/project-glass-motion', () => ({ bindProjectGlassMotion: () => () => {} }))
beforeEach(() => { sessionStorage.clear(); previewMockStore.reset() })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

it('logs in offline, rotates both tokens twice and rejects old tokens and logout', async () => {
  const api = createAxiosClient({ baseUrl: 'https://demo.invalid/api/v1', adapter: shoppingAuthAdapter })
  const service = createAuthService(api)
  await expect(service.login({ email: auth.email, password: 'wrong' })).rejects.toMatchObject({ status: 401 })
  const login = await service.login({ email: auth.email, password: auth.password })
  const renewed = await service.refresh({ refresh_token: login.session.refreshToken })
  expect(renewed.refreshToken).not.toBe(login.session.refreshToken)
  await expect(service.refresh({ refresh_token: login.session.refreshToken })).rejects.toMatchObject({ status: 401 })
  const twice = await service.refresh({ refresh_token: renewed.refreshToken })
  const bound = createAxiosClient({ baseUrl: 'https://demo.invalid/api/v1', adapter: shoppingAuthAdapter, readToken: () => twice.accessToken })
  expect(await createUsersService(bound).getMe()).toMatchObject({ id: auth.user.id, firstName: 'Demo' })
  await createAuthService(bound).logout()
  await expect(createUsersService(bound).getMe()).rejects.toMatchObject({ status: 401 })
})
it('matches records, metadata and all finding evidence', async () => {
  const rows = await loadShoppingRows()
  expect(rows).toHaveLength(3900)
  expect(rows.every(row => row.length === 18)).toBe(true)
  expect(metadata.bytes).toBe(413968)
  expect(analysis.missingCells).toBe(80)
  expect(rows.flat().filter(v => v.trim() === '')).toHaveLength(80)
  expect(detection.items).toHaveLength(detection.findingCount)
  for (const f of detection.items) {
    expect(requireDefined(rows[f.row - 1], 'shopping-demo.test.tsx:45')[metadata.columns.indexOf(f.column)]).toBe(f.value)
    expect(f.csvLine).toBe(f.row + 1)
  }
})
it('completes at 4000ms, cancels at 3999ms, validates reviews and restores completed state', async () => {
  vi.useFakeTimers()
  const hook = renderHook(() => useShoppingDetection(true))
  act(() => hook.result.current.start())
  await act(() => vi.advanceTimersByTime(3999))
  expect(hook.result.current.state.status).toBe('running')
  act(() => hook.result.current.cancel())
  await act(() => vi.advanceTimersByTime(1))
  expect(hook.result.current.state.status).toBe('idle')
  act(() => hook.result.current.start())
  await act(() => vi.advanceTimersByTime(4000))
  expect(hook.result.current.needsReview).toBe(true)
  hook.unmount()
  const restored = renderHook(() => useShoppingDetection(true))
  expect(restored.result.current.needsReview).toBe(true)
  await expect(restored.result.current.save({ rating: 5, comment: ' ' })).rejects.toThrow()
  await act(() => restored.result.current.save({ rating: 5, comment: 'Đã xem' }))
  expect(restored.result.current.needsReview).toBe(false)
})
it.each(['close', 'escape', 'outside', 'module'])('blocks %s after results until review is saved', async action => {
  vi.useFakeTimers()
  render(<MemoryRouter><PreviewSessionProvider routeIds={{ projectId: 'shopping-trends' }}><ProjectWorkspaceView projectId="shopping-trends" scene={<div>Scene</div>} /></PreviewSessionProvider></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Detection' }))
  await act(() => vi.advanceTimersByTime(4000))
  expect(screen.getByRole('button', { name: 'Đánh giá' })).toBeDefined()
  if (action === 'close') fireEvent.click(screen.getByRole('button', { name: 'Đóng bảng module' }))
  if (action === 'escape') fireEvent.keyDown(window, { key: 'Escape' })
  if (action === 'outside') fireEvent.pointerDown(document.body)
  if (action === 'module') fireEvent.click(screen.getByRole('button', { name: 'Data View' }))
  const dialog = screen.getByRole('dialog', { name: 'Đánh giá trước khi lưu kết quả' })
  fireEvent.submit(dialog)
  expect(within(dialog).getByRole('alert')).toBeDefined()
  fireEvent.click(within(dialog).getByRole('radio', { name: '5 sao' }))
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Kết quả có bằng chứng rõ.' } })
  await act(async () => { fireEvent.submit(dialog)
    return Promise.resolve()
  })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(jsonObject(sessionStorage.getItem('shopping-demo.detection.v1')!)['status']).toBe('reviewed')
})
it('shows ten original records and links to the full table', async () => {
  render(<MemoryRouter><ShoppingTable /></MemoryRouter>)
  expect(await screen.findByRole('link', { name: /Xem đầy đủ/ })).toHaveProperty('href', expect.stringContaining('/records'))
  expect(screen.getAllByRole('row')).toHaveLength(11)
})
it('does not acknowledge a project mutation when browser storage fails', async () => {
  const previous = previewMockStore.getState()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  await expect(previewMockStore.rename('project', 'shopping-trends', 'Changed')).rejects.toThrow('Không lưu được')
  expect(previewMockStore.getState()).toBe(previous)
})
it('paginates 50 rows and searches across all records', async () => {
  render(<MemoryRouter><ShoppingTable full /></MemoryRouter>)
  await screen.findByText('Trang 1 / 78')
  expect(screen.getAllByRole('row')).toHaveLength(51)
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(screen.getByText('Trang 2 / 78')).toBeDefined()
  fireEvent.change(screen.getByLabelText('Tìm trong dữ liệu'), { target: { value: 'no-matching-shopping-value' } })
  expect(screen.getByText('Không có dòng phù hợp.')).toBeDefined()
})
