import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Workspace3DPreview } from '../../views/workspace-3d/workspace-3d-preview'

vi.mock('../../graphics/workspace-3d/resource-scene', () => ({ ResourceScene: () => <div>Renderer fixture</div> }))
let showDescriptor: PropertyDescriptor | undefined
let closeDescriptor: PropertyDescriptor | undefined
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: true }))
  showDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
  closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute('open') } })
})
afterEach(() => {
  cleanup(); vi.unstubAllGlobals()
  if (showDescriptor) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showDescriptor)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  if (closeDescriptor) Object.defineProperty(HTMLDialogElement.prototype, 'close', closeDescriptor)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
})

function file(name: string, content: string) {
  const result = new File([content], name, { type: 'text/csv' })
  Object.defineProperty(result, 'arrayBuffer', { value: async () => new TextEncoder().encode(content).buffer })
  return result
}
async function choose(files: File[]) {
  await act(async () => { fireEvent.change(screen.getByLabelText('Thử xem file CSV trên máy', { selector: 'input' }), { target: { files } }) })
}

it('opens the selected file by name/action, pages all rows, and keeps selection when the dialog closes', async () => {
  render(<Workspace3DPreview />)
  const content = 'code;value\n' + Array.from({ length: 112 }, (_, i) => `line-${i + 1};${i}`).join('\n')
  await choose([file('sales.csv', content), file('customers.csv', 'age,review\n30,Good')])
  expect(screen.getByText('5 tài nguyên trong góc nhìn')).toBeDefined()
  const selected = screen.getByRole('button', { name: /sales.csv Dataset/ })
  fireEvent.click(selected)
  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'sales.csv' }))
  const dialog = screen.getByRole('dialog', { name: 'sales.csv' })
  expect(within(dialog).getByText('112 dòng dữ liệu · 2 cột · Phân cách: ;')).toBeDefined()
  expect(within(dialog).getAllByRole('row')).toHaveLength(51)
  expect(within(dialog).getByText('line-1')).toBeDefined()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Trang sau' }))
  expect(within(dialog).getByText('line-51')).toBeDefined()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Trang sau' }))
  expect(within(dialog).getByText('line-112')).toBeDefined()
  expect(within(dialog).getAllByRole('row')).toHaveLength(13)
  expect(within(dialog).getByRole('button', { name: 'Trang sau' }).hasAttribute('disabled')).toBe(true)
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(selected.getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: /customers.csv Dataset/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Xem dữ liệu' }))
  expect(screen.getByRole('dialog', { name: 'customers.csv' })).toBeDefined()
  expect(screen.queryByText('line-1')).toBeNull()
})

it('reports bad CSV without replacing good files and drops local data when returning to the demo', async () => {
  render(<Workspace3DPreview />)
  await choose([file('good.csv', 'a,b\n1,2')])
  await choose([file('bad.csv', 'a,b\n1')])
  expect(screen.getByRole('alert').textContent).toContain('Record dữ liệu 1')
  expect(screen.getByRole('button', { name: /good.csv Dataset/ })).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Đóng file cục bộ, quay lại demo' }))
  expect(screen.queryByRole('button', { name: /good.csv Dataset/ })).toBeNull()
  expect(screen.getByText('6 tài nguyên trong góc nhìn')).toBeDefined()
})
