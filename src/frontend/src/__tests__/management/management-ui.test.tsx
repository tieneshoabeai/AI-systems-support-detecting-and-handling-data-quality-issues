import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ManagementStoreContext } from '../../hooks/preview/use-preview-store'
import type { ManagementStore } from '../../services/management/management.types'
import { previewMockStore } from '../../services/preview/preview-mock.service'
import { PreviewSessionProvider } from '../../views/preview/preview-session'
import { ProjectUploadDialog } from '../../views/preview/components/project-data-actions'
import { WorkspaceEditDialog } from '../../views/preview/components/workspace-detail-dialogs'
import { ProjectWizard } from '../../components/project/create/project-wizard'
import { WorkspaceCreateDialog } from '../../views/management/workspaces/sections/workspace-create-dialog'
import { ReportCenter } from '../../components/report/center/report-center'
import { createManagementStore } from '../../services/management/management.store'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'
import { within } from '@testing-library/react'

afterEach(cleanup)
it('submits the report edit from the detail UI and renders the server response', async () => {
  const issue = { id: 'i1', title: 'Issue to edit', description: 'Initial', issueType: 'data_error', status: 'needs_info',
    version: 2, updatedAt: '2026-11-18', createdAt: '2026-11-18' }
  const request = vi.fn((options: ApiRequestOptions) => Promise.resolve().then(() => {
    switch (options.path) {
      case '/workspaces':
      case '/projects': return { items: [], total: 0 }
      case '/users/me': return { firstName: 'Test', lastName: 'User', email: 'test@example.com', role: 'analyst', notificationsEnabled: true }
      case '/notifications': return { items: [], meta: { hasMore: false } }
      case '/notifications/unread-count': return { unreadCount: 0 }
      case '/issues': return { items: [issue], meta: { hasMore: false } }
      case '/issues/i1': return options.method === 'PATCH'
        ? { ...issue, description: 'More information', status: 'in_progress', version: 3 } : issue
      default: throw new Error(`Unexpected request: ${options.path}`)
    }
  }))
  const { store, load } = createManagementStore({ request } as ApiClient, { id: 'u1', role: 'analyst', name: 'Test User', initials: 'TU' })
  await load()
  render(<ManagementStoreContext.Provider value={store}><PreviewSessionProvider routeIds={{}}>
    <ReportCenter />
  </PreviewSessionProvider></ManagementStoreContext.Provider>)
  fireEvent.click(screen.getByRole('button', { name: 'Xem các báo cáo của tôi' }))
  fireEvent.click(screen.getByRole('button', { name: /Issue to edit/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Bổ sung báo cáo' }))
  fireEvent.change(screen.getByLabelText('Mô tả bổ sung'), { target: { value: 'More information' } })
  fireEvent.click(screen.getByRole('button', { name: 'Gửi bổ sung' }))

  expect(await screen.findByText('More information')).toBeDefined()
  expect(screen.queryByRole('button', { name: 'Bổ sung báo cáo' })).toBeNull()
  const lastRequest = request.mock.calls.at(-1)?.[0]
  expect(lastRequest).toMatchObject({ path: '/issues/i1', method: 'PATCH', auth: 'session',
    data: { title: 'Issue to edit', description: 'More information', expectedVersion: 2 } })
  expect(lastRequest?.signal).toBeInstanceOf(AbortSignal)
})
it('keeps an upload open on failure, prevents a second request, closes only after acknowledgment', async () => {
  let accept!: () => void
  const uploadDataset = vi.fn().mockRejectedValueOnce(new Error('Server unavailable')).mockImplementationOnce(() => new Promise(resolve => { accept = () => resolve({ persisted: true, message: 'Đã tải CSV', undo: () => {} }) }))
  const close = vi.fn()
  const snapshot = { ...previewMockStore.getState(), source: 'api' as const, selection: { workspaceId: 'w1', projectId: 'p1' } }
  const store: ManagementStore = { ...previewMockStore, getState: () => snapshot, uploadDataset }
  render(<ManagementStoreContext.Provider value={store}><PreviewSessionProvider routeIds={{}}><ProjectUploadDialog onClose={close} /></PreviewSessionProvider></ManagementStoreContext.Provider>)
  fireEvent.change(screen.getByLabelText('Chọn tệp dữ liệu'), { target: { files: [new File(['id\n1'], 'data.csv', { type: 'text/csv' })] } })
  fireEvent.click(screen.getByRole('button', { name: 'Upload data' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Server unavailable')
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Upload data' }))
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Upload data' }).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Upload data' }))
  await waitFor(() => expect(uploadDataset).toHaveBeenCalledTimes(2))
  await act(async () => { accept(); await Promise.resolve() })
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
})
it('workspace members cannot submit edits even by submitting the form directly', () => {
  const workspace = { ...previewMockStore.getState().workspaces[0]!, canManage: false }
  const save = vi.fn()
  render(<WorkspaceEditDialog workspace={workspace} projectCount={0} ownerEmail="owner@example.com" existingNames={[]} onClose={() => {}} onSave={save} />)
  expect(screen.getByRole<HTMLButtonElement>('button', { name: /Lưu thay đổi/ }).disabled).toBe(true)
  fireEvent.submit(screen.getByRole('dialog'))
  expect(save).not.toHaveBeenCalled()
})

it('the migrated project wizard forwards the original file and waits for acknowledgment', async () => {
  let accept!: () => void
  const createProject = vi.fn<ManagementStore['createProject']>(() => new Promise<{ persisted: boolean; message: string; undo: () => void }>(resolve => {
    accept = () => resolve({ persisted: true, message: 'Saved', undo: () => {} })
  }))
  const store: ManagementStore = { ...previewMockStore, createProject }
  const workspace = store.getState().workspaces[0]!
  render(<ManagementStoreContext.Provider value={store}><PreviewSessionProvider routeIds={{}}>
    <ProjectWizard initialWorkspaceId={workspace.id} onClose={() => {}} />
  </PreviewSessionProvider></ManagementStoreContext.Provider>)
  const dialog = screen.getByRole('dialog', { name: 'Tạo Project' })
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Tên Project' }), { target: { value: 'API migration test' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp theo' }))
  const file = new File(['id|name\n1|Tai'], 'data.csv', { type: 'text/csv' })
  Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(new TextEncoder().encode('id|name\n1|Tai').buffer) })
  fireEvent.change(dialog.querySelector('input[type="file"]')!, { target: { files: [file] } })
  await within(dialog).findByText(/data\.csv/)
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp theo' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp theo' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo Project' }))
  await waitFor(() => expect(createProject.mock.calls[0]?.[0].dataset.file).toBe(file))
  expect(within(dialog).queryByText('Tạo Project thành công!')).toBeNull()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo Project' }))
  expect(createProject).toHaveBeenCalledTimes(1)
  await act(async () => { accept(); await Promise.resolve() })
  expect(await within(dialog).findByText('Tạo Project thành công!')).toBeDefined()
})

it('the migrated workspace form does not show success after an API rejection', async () => {
  const createWorkspace = vi.fn().mockRejectedValue(new Error('Forbidden'))
  const store: ManagementStore = { ...previewMockStore, createWorkspace }
  render(<ManagementStoreContext.Provider value={store}><PreviewSessionProvider routeIds={{}}>
    <WorkspaceCreateDialog existingNames={[]} onClose={() => {}} />
  </PreviewSessionProvider></ManagementStoreContext.Provider>)
  fireEvent.change(screen.getByRole('textbox', { name: /Tên Workspace/ }), { target: { value: 'Rejected workspace' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tạo Workspace' }))
  await waitFor(() => expect(createWorkspace).toHaveBeenCalledOnce())
  await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Tạo Workspace' }).disabled).toBe(false))
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: /Tên Workspace/ }).value).toBe('Rejected workspace')
  expect(screen.queryByText('Tạo Workspace thành công!')).toBeNull()
})
