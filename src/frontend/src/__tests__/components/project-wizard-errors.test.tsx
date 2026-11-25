import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ProjectWizard } from '../../components/project/create/project-wizard'
import { previewMockStore as store } from '../support/management-mock-store'
import { requireDefined } from '../../utils/required-value'
import { renderFrame } from '../support/workbench-test-kit'

beforeEach(() => { store.reset('demo') })
afterEach(cleanup)
const workspace = () => requireDefined(store.getState().workspaces[0], 'wizard workspace')
function start() {
  renderFrame(<ProjectWizard initialWorkspaceId={workspace().id} onClose={() => {}} />)
  fireEvent.change(screen.getByRole('textbox', { name: /Tên Project/ }), { target: { value: 'Coverage project' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp theo' }))
}
async function pick(file: File, read: () => Promise<ArrayBuffer>) {
  Object.defineProperty(file, 'arrayBuffer', { value: read })
  await act(() => {
    fireEvent.change(screen.getByLabelText('Chọn tập dữ liệu CSV'), { target: { files: [file] } })
    return Promise.resolve()
  })
}

it('requires an explicit workspace before accepting a project name', () => {
  const before = store.getState().projects
  renderFrame(<ProjectWizard initialWorkspaceId={null} onClose={() => {}} />)
  fireEvent.change(screen.getByRole('textbox', { name: /Tên Project/ }), { target: { value: 'New project' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp theo' }))
  expect(screen.getByRole('alert').textContent).toContain('Chọn Workspace')
  expect(store.getState().projects).toBe(before)
})

it('rejects whitespace-only names even with a valid workspace', () => {
  renderFrame(<ProjectWizard initialWorkspaceId={workspace().id} onClose={() => {}} />)
  fireEvent.change(screen.getByRole('textbox', { name: /Tên Project/ }), { target: { value: '   ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp theo' }))
  expect(screen.getByRole('alert').textContent).toBe('Tên project không được để trống.')
})

it('rejects unsupported files before reading their contents', async () => {
  start()
  const read = vi.fn(() => Promise.resolve(new ArrayBuffer(0)))
  await pick(new File(['{}'], 'data.json'), read)
  expect(read).not.toHaveBeenCalled()
  expect(screen.getByRole('alert').textContent).toContain('không phải .csv')
})

it.each([new Error('Device read failed'), 'read-rejected'])('keeps the import step usable after a read failure %s', async reason => {
  start()
  // Exercise the existing unknown-rejection fallback, including non-Error failures.
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
  await pick(new File([''], 'broken.csv'), () => Promise.reject(reason))
  expect(screen.getByRole('alert').textContent).toContain(reason instanceof Error ? reason.message : 'Không đọc được')
  expect(screen.getByLabelText('Chọn tập dữ liệu CSV')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp theo' }))
  expect(screen.getByRole('alert').textContent).toContain('hãy chọn tệp .csv')
})

it.each([
  ['malformed.csv', new TextEncoder().encode('a,b\n1').buffer],
  ['invalid-utf8.csv', new Uint8Array([0xff, 0xfe, 0xff]).buffer],
])('does not accept invalid CSV content in %s', async (name, buffer) => {
  start()
  await pick(new File([''], name), () => Promise.resolve(buffer))
  expect(screen.getByRole('alert').textContent?.length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: 'Bỏ tệp đã chọn' })).toBeNull()
})

it('lets the user discard a parsed file and requires a replacement before advancing', async () => {
  start()
  await pick(new File(['a,b\n1,2'], 'valid.csv'), () => Promise.resolve(new TextEncoder().encode('a,b\n1,2').buffer))
  expect(screen.getByText('valid.csv', { exact: false })).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ tệp đã chọn' }))
  expect(screen.getByLabelText<HTMLInputElement>('Chọn tập dữ liệu CSV').value).toBe('')
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp theo' }))
  expect(screen.getByRole('alert').textContent).toContain('hãy chọn tệp .csv')
})
