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
import { within } from '@testing-library/react'

afterEach(cleanup)
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
  expect(uploadDataset).toHaveBeenCalledTimes(2)
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
  expect(createProject.mock.calls[0]?.[0].dataset.file).toBe(file)
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
