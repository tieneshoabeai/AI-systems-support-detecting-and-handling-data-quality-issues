import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ManagementStoreContext } from '../../hooks/management/use-management-store'
import type { ManagementStore } from '../../services/management/management.types'
import { mutationRefreshFailedCode } from '../../services/management/management.types'
import { ApiError } from '../../lib/api-error'
import { previewMockStore } from '../support/management-mock-store'
import { PreviewSessionProvider } from '../../views/application/workbench-session'
import { ProjectUploadDialog } from '../../views/processing/project/sections/project-data-actions'
import { WorkspaceEditDialog } from '../../components/workspace/dialogs/workspace-detail-dialogs'
import { ProjectWizard } from '../../components/project/create/project-wizard'
import { WorkspaceCreateDialog } from '../../components/workspace/dialogs/workspace-create-dialog'
import { within } from '@testing-library/react'
import { renderFrameWithStore } from '../support/workbench-test-kit'

afterEach(cleanup)
it('keeps an upload open on failure, prevents a second request, closes only after acknowledgment', async () => {
  let accept!: () => void
  const uploadDataset = vi.fn().mockRejectedValueOnce(new Error('Server unavailable')).mockImplementationOnce(() => new Promise(resolve => { accept = () => resolve({ persisted: true, message: 'Đã tải CSV', undo: () => {} }) }))
  const close = vi.fn()
  const snapshot = { ...previewMockStore.getState(), source: 'api' as const, selection: { workspaceId: 'w1', projectId: 'p1' } }
  const store: ManagementStore = { ...previewMockStore, getState: () => snapshot, uploadDataset }
  renderFrameWithStore(<ProjectUploadDialog onClose={close} />, store)
  fireEvent.change(screen.getByLabelText('Chọn tệp dữ liệu'), { target: { files: [new File(['id\n1'], 'data.csv', { type: 'text/csv' })] } })
  expect(uploadDataset).not.toHaveBeenCalled()
  await screen.findByText('data.csv')
  await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Upload data' }).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Upload data' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Server unavailable')
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Upload data' }))
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Đang tải lên…' }).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Đang tải lên…' }))
  expect(uploadDataset).toHaveBeenCalledTimes(2)
  await act(async () => { accept(); await Promise.resolve() })
  expect(screen.getByRole('button', { name: 'Đã tải lên' })).toBeDefined()
  expect(close).not.toHaveBeenCalled()
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
})
it('selects dropped CSV without sending and locks retry if only the reload failed', async () => {
  const uploadDataset = vi.fn().mockRejectedValue(new ApiError({
    kind: 'invalid-response', code: mutationRefreshFailedCode, message: 'Đã lưu. Hãy tải lại trang.',
  }))
  const close = vi.fn()
  const snapshot = { ...previewMockStore.getState(), selection: { workspaceId: 'w1', projectId: 'p1' } }
  const store: ManagementStore = { ...previewMockStore, getState: () => snapshot, uploadDataset }
  renderFrameWithStore(<ProjectUploadDialog onClose={close} />, store)
  const zone = screen.getByRole('button', { name: 'Chọn tệp CSV' })
  const submit = screen.getByRole<HTMLButtonElement>('button', { name: 'Upload data' })
  fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [new File(['id'], 'data.txt')] } })
  expect(screen.getByRole('alert').textContent).toBe('Chỉ hỗ trợ tệp CSV.')
  expect(submit.disabled).toBe(true)
  const file = new File(['id\n1'], 'data.csv', { type: 'text/csv' })
  fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [file] } })
  expect(uploadDataset).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Upload data' }).disabled).toBe(false))
  fireEvent.click(submit)
  expect((await screen.findByRole('alert')).textContent).toBe('Đã lưu. Hãy tải lại trang.')
  expect(uploadDataset).toHaveBeenCalledWith('p1', file, expect.any(String))
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Upload data' }).disabled).toBe(true)
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Đóng' }).disabled).toBe(false)
  expect(close).not.toHaveBeenCalled()
})

it('workspace members cannot submit edits even by submitting the form directly', () => {
  const workspace = { ...previewMockStore.getState().workspaces[0]!, canManage: false }
  const save = vi.fn()
  render(<ManagementStoreContext.Provider value={previewMockStore}>
    <WorkspaceEditDialog workspace={workspace} projectCount={0} ownerEmail="owner@example.com" existingNames={[]} onClose={() => {}} onSave={save} />
  </ManagementStoreContext.Provider>)
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
  renderFrameWithStore(<ProjectWizard initialWorkspaceId={workspace.id} onClose={() => {}} />, store)
  const dialog = screen.getByRole('dialog', { name: 'Tạo Project' })
  const steps = within(dialog).getByRole('list', { name: 'Các bước tạo project' })
  fireEvent.click(within(steps).getByRole('button', { name: 'Xác nhận' }))
  expect(within(dialog).getByRole('textbox', { name: 'Tên Project' })).toBeDefined()
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Tên Project' }), { target: { value: 'API migration test' } })
  fireEvent.keyDown(within(steps).getByRole('button', { name: 'Thông tin Project' }), { key: 'ArrowRight' })
  expect(document.activeElement).toBe(within(steps).getByRole('button', { name: 'Import Dataset' }))
  const file = new File(['id|name\n1|Tai'], 'data.csv', { type: 'text/csv' })
  Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(new TextEncoder().encode('id|name\n1|Tai').buffer) })
  fireEvent.change(dialog.querySelector('input[type="file"]')!, { target: { files: [file] } })
  await waitFor(() => expect(within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Tiếp theo' }).disabled).toBe(false))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp theo' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp theo' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo Project' }))
  await waitFor(() => expect(createProject).toHaveBeenCalledOnce())
  expect(createProject.mock.calls[0]?.[0].dataset.file).toBe(file)
  expect(within(dialog).queryByText('Tạo Project thành công!')).toBeNull()
  expect(within(dialog).queryByText('API migration test')).toBeNull()
  const pendingButton = within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Đang tạo Project…' })
  expect(pendingButton.disabled).toBe(true)
  fireEvent.click(pendingButton)
  expect(createProject).toHaveBeenCalledTimes(1)
  await act(async () => { accept(); await Promise.resolve() })
  expect(await within(dialog).findByText('Tạo Project thành công!')).toBeDefined()
})

it('the migrated workspace form does not show success after an API rejection', async () => {
  let reject!: (error: Error) => void
  const createWorkspace = vi.fn<ManagementStore['createWorkspace']>(() => new Promise((_, rejectRequest) => { reject = rejectRequest }))
  const store: ManagementStore = { ...previewMockStore, createWorkspace }
  render(<ManagementStoreContext.Provider value={store}><PreviewSessionProvider routeIds={{}}>
    <WorkspaceCreateDialog existingNames={[]} onClose={() => {}} />
  </PreviewSessionProvider></ManagementStoreContext.Provider>)
  fireEvent.change(screen.getByRole('textbox', { name: /Tên Workspace/ }), { target: { value: 'Rejected workspace' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tạo Workspace' }))
  expect(createWorkspace).toHaveBeenCalledOnce()
  expect(screen.queryByRole('textbox', { name: /Tên Workspace/ })).toBeNull()
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Đang tạo Workspace…' }).disabled).toBe(true)
  reject(new Error('Forbidden'))
  expect((await screen.findByRole('alert')).textContent).toBe('Forbidden')
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Tạo Workspace' }).disabled).toBe(false)
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: /Tên Workspace/ }).value).toBe('Rejected workspace')
  expect(screen.queryByText('Tạo Workspace thành công!')).toBeNull()
})

it('selects an existing or newly created workspace without discarding the project draft', async () => {
  let undoCreation: (() => void) | undefined
  const store: ManagementStore = {
    ...previewMockStore,
    createWorkspace: async input => {
      const result = await previewMockStore.createWorkspace(input)
      undoCreation = result.undo
      return result
    },
  }
  const existing = store.getState().workspaces.find(workspace => workspace.canManage !== false)!
  renderFrameWithStore(<ProjectWizard initialWorkspaceId={null} onClose={() => {}} />, store)

  try {
    const project = () => within(screen.getByRole('dialog', { name: 'Tạo Project' }))
    const selector = () => project().getByRole('button', { name: 'Workspace' })
    fireEvent.change(project().getByRole('textbox', { name: 'Tên Project' }), { target: { value: 'Project draft' } })
    fireEvent.keyDown(selector(), { key: 'ArrowDown' })
    const first = project().getByRole('menuitemradio', { name: existing.name })
    expect(document.activeElement).toBe(first)
    fireEvent.click(first)
    expect(selector().textContent).toContain(existing.name)

    fireEvent.click(selector())
    fireEvent.click(project().getByRole('menuitem', { name: 'Tạo Workspace' }))
    expect(screen.queryByRole('dialog', { name: 'Tạo Project' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(project().getByDisplayValue('Project draft')).toBeDefined()
    expect(selector().textContent).toContain(existing.name)

    fireEvent.click(selector())
    fireEvent.click(project().getByRole('menuitem', { name: 'Tạo Workspace' }))
    const creation = within(screen.getByRole('dialog', { name: 'Tạo Workspace' }))
    fireEvent.change(creation.getByRole('textbox', { name: /Tên Workspace/ }), { target: { value: 'Workspace from wizard' } })
    fireEvent.click(creation.getByRole('button', { name: 'Tạo Workspace' }))
    fireEvent.click(await creation.findByRole('button', { name: 'Dùng Workspace này' }))

    expect(project().getByDisplayValue('Project draft')).toBeDefined()
    expect(selector().textContent).toContain('Workspace from wizard')
    fireEvent.click(project().getByRole('button', { name: 'Tiếp theo' }))
    expect(project().getByRole('button', { name: 'Import Dataset' }).parentElement?.getAttribute('aria-current')).toBe('step')
  } finally {
    cleanup()
    undoCreation?.()
  }
})
