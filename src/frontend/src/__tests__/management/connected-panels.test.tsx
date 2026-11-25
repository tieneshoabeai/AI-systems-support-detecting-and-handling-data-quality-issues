import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { ManagementStoreContext } from '../../hooks/management/use-management-store'
import { previewMockStore } from '../support/management-mock-store'
import type { ManagementStore } from '../../services/management/management.types'
import { createAdminService } from '../../services/management/admin.service'
import { createDatasetService } from '../../services/processing/dataset.service'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'
import { AdminApiPanel } from '../../views/management/members/admin-api-panel'
import { LiveDatasetPanel } from '../../views/processing/project/sections/live-dataset-panel'
import { AuthenticatedWorkbenchEntry } from '../support/authenticated-workbench-entry'

beforeAll(async () => {
  await Promise.all([import('../../views/application/application-frame'), import('../../app/pages/private/management-page')])
})

afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/')
})

it('loads admin data only after opening Quản trị from Management Home', async () => {
  const request = vi.fn< (options: ApiRequestOptions) => Promise<{ items: [] }> >(() => Promise.resolve({ items: [] }))
  const store: ManagementStore = { ...previewMockStore, adminService: createAdminService({ request } as ApiClient) }
  window.history.replaceState({}, '', '/management')
  const entry = <ManagementStoreContext.Provider value={store}><AuthenticatedWorkbenchEntry /></ManagementStoreContext.Provider>
  const mounted = render(entry)

  const administration = await screen.findByRole('button', { name: 'Quản trị' }, { timeout: 5000 })
  expect(screen.queryByRole('tab', { name: 'Tài khoản' })).toBeNull()
  expect(request).not.toHaveBeenCalled()

  fireEvent.click(administration)
  expect(await screen.findByText('Chưa có tài khoản để hiển thị.')).toBeDefined()
  expect(window.location.pathname).toBe('/management/members')
  expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: '/admin/users' }))
  expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: '/admin/issues' }))
  expect(screen.getByRole('tab', { name: 'Tài khoản', selected: true })).toBeDefined()
  expect(screen.getByRole('tab', { name: 'Báo cáo vấn đề' })).toBeDefined()

  mounted.unmount()
  render(entry)
  expect(await screen.findByText('Chưa có tài khoản để hiển thị.')).toBeDefined()
})

it('denies direct access to the members route without admin access', async () => {
  window.history.replaceState({}, '', '/management/members')
  render(<AuthenticatedWorkbenchEntry />)

  expect(await screen.findByRole('heading', { name: 'Bạn không có quyền truy cập trang quản trị' })).toBeDefined()
  expect(screen.queryByRole('tab', { name: 'Tài khoản' })).toBeNull()
})

it('shows server records and submits the chosen numeric filter', async () => {
  const request = vi.fn((options: ApiRequestOptions) => Promise.resolve().then(() => {
    if (options.path.endsWith('/schema')) return { columns: [{ key: 'c0', name: 'Age', dataType: 'number' }] }
    if (options.path.endsWith('/records/query') || options.path.endsWith('/records')) return {
      items: [{ rowIndex: 1, props: { c0: 21 } }], meta: { hasMore: false, nextCursor: null },
    }
    throw new Error('Unexpected dataset request')
  }))
  const store: ManagementStore = { ...previewMockStore, datasetService: createDatasetService({ request } as ApiClient) }
  const project = { ...previewMockStore.getState().projects[0]!, dataset: {
    id: 'd1', fileName: 'ages.csv', format: 'CSV' as const, rows: 1, columns: 1, sizeMb: 0.01,
    importedAt: '2026-11-18', status: 'processed' as const,
  } }
  render(<ManagementStoreContext.Provider value={store}><LiveDatasetPanel project={project} /></ManagementStoreContext.Provider>)
  expect(await screen.findByRole('cell', { name: '21' })).toBeDefined()
  expect(screen.queryByLabelText('Tên hiển thị mới')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Đổi tên cột' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Khôi phục tên cột gốc' })).toBeNull()
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Trang tiếp' }).disabled).toBe(true)

  fireEvent.change(screen.getByLabelText('Điều kiện lọc'), { target: { value: 'greaterThan' } })
  fireEvent.change(screen.getByLabelText('Giá trị lọc'), { target: { value: '20' } })
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

  await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
    path: '/datasets/d1/records/query', method: 'POST', auth: 'session',
    data: { limit: 50, filters: [{ column: 'c0', operator: 'greaterThan', value: 20 }] },
  })))
})

it('shows a dataset error and recovers when the user retries', async () => {
  let failed = true
  const request = vi.fn((options: ApiRequestOptions) => Promise.resolve().then(() => {
    if (failed) throw new Error('Dataset unavailable')
    if (options.path.endsWith('/schema')) return { columns: [{ key: 'c0', name: 'Age', dataType: 'number' }] }
    return { items: [], meta: { hasMore: false, nextCursor: null } }
  }))
  const store: ManagementStore = { ...previewMockStore, datasetService: createDatasetService({ request } as ApiClient) }
  const project = { ...previewMockStore.getState().projects[0]!, dataset: {
    id: 'd1', fileName: 'ages.csv', format: 'CSV' as const, rows: 0, columns: 1, sizeMb: 0,
    importedAt: '2026-11-18', status: 'processed' as const,
  } }
  render(<ManagementStoreContext.Provider value={store}><LiveDatasetPanel project={project} /></ManagementStoreContext.Provider>)
  expect((await screen.findByRole('alert')).textContent).toBe('Dataset unavailable')
  failed = false
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }))
  expect(await screen.findByText('Không có bản ghi phù hợp.')).toBeDefined()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('keeps the previous admin issue status when the server rejects a status update', async () => {
  const issue = {
    id: 'issue1', userId: 'u1', issueType: 'data_error', title: 'Missing CSV', description: 'CSV detail',
    status: 'new', version: 2, createdAt: '2026-11-18', updatedAt: '2026-11-18',
  }
  const request = vi.fn((options: ApiRequestOptions) => Promise.resolve().then(() => {
    if (options.method === 'PATCH') throw new Error('Version conflict')
    if (options.path === '/admin/users') return { items: [] }
    if (options.path === '/admin/issues') return { items: [issue] }
    if (options.path === '/admin/issues/issue1') return issue
    throw new Error('Unexpected admin request')
  }))
  const store: ManagementStore = { ...previewMockStore, adminService: createAdminService({ request } as ApiClient) }
  render(<ManagementStoreContext.Provider value={store}><AdminApiPanel /></ManagementStoreContext.Provider>)
  await screen.findByText('Chưa có tài khoản để hiển thị.')
  fireEvent.click(screen.getByRole('tab', { name: 'Báo cáo vấn đề' }))
  fireEvent.click(screen.getByRole('button', { name: /Missing CSV/ }))
  await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Lưu trạng thái' }).disabled).toBe(true))
  fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'resolved' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu trạng thái' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Version conflict')
  expect(screen.getByRole('cell', { name: 'new' })).toBeDefined()
  expect(request).toHaveBeenCalledWith(expect.objectContaining({
    path: '/admin/issues/issue1/status', method: 'PATCH', data: { status: 'resolved', expectedVersion: 2 },
  }))
})
