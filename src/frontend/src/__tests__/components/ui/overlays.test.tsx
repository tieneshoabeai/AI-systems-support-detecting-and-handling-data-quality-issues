import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Dialog } from '../../../components/ui/overlay/dialog'
import { Popover } from '../../../components/ui/overlay/popover'
import { ContextMenu } from '../../../components/ui/overlay/context-menu'
import { Toast } from '../../../components/ui/overlay/toast'

afterEach(cleanup)

it('renders dialog inline, preserves scroll state and traps/restores focus', () => {
  const onClose = vi.fn()
  const originalOverflow = document.body.style.overflow
  const view = render(<button>Ouvrir</button>)
  const trigger = screen.getByRole('button')
  trigger.focus()
  view.rerender(<><button>Ouvrir</button><Dialog open onClose={onClose} aria-labelledby="title">
    <h2 id="title">Xác nhận</h2><button>Đầu</button><button>Cuối</button>
  </Dialog></>)
  const first = screen.getByRole('button', { name: 'Đầu' })
  const last = screen.getByRole('button', { name: 'Cuối' })
  expect(document.activeElement).toBe(first)
  expect(view.container.contains(screen.getByRole('dialog'))).toBe(true)
  expect(document.body.style.overflow).toBe(originalOverflow)
  last.focus()
  fireEvent.keyDown(document, { key: 'Tab' })
  expect(document.activeElement).toBe(first)
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(last)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(1)
  view.rerender(<button>Ouvrir</button>)
  expect(document.activeElement).toBe(trigger)
})

it('distinguishes backdrop clicks from clicks inside and blocks dismissal while busy', () => {
  const onClose = vi.fn()
  const view = render(<Dialog open onClose={onClose} aria-label="Task"><button>Nội dung</button></Dialog>)
  fireEvent.mouseDown(screen.getByRole('button'))
  expect(onClose).not.toHaveBeenCalled()
  const dialog = screen.getByRole('dialog')
  if (!dialog.parentElement) throw new Error('Missing inline scrim')
  fireEvent.mouseDown(dialog.parentElement)
  expect(onClose).toHaveBeenCalledTimes(1)
  view.rerender(<Dialog open busy onClose={onClose} aria-label="Task"><button disabled>Đợi</button></Dialog>)
  fireEvent.keyDown(document, { key: 'Escape' })
  fireEvent.mouseDown(dialog.parentElement)
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('preserves form submission and does not mount a closed dialog', () => {
  const onSubmit = vi.fn((event: React.FormEvent<HTMLElement>) => event.preventDefault())
  const view = render(<Dialog open as="form" onClose={vi.fn()} onSubmit={onSubmit} aria-label="Form"><button type="submit">Lưu</button></Dialog>)
  expect(screen.getByRole('dialog').tagName).toBe('FORM')
  fireEvent.submit(screen.getByRole('dialog'))
  expect(onSubmit).toHaveBeenCalledTimes(1)
  view.rerender(<Dialog open={false} onClose={vi.fn()} />)
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('retains focus inside a busy dialog with no enabled controls', () => {
  const onClose = vi.fn()
  render(<Dialog open busy onClose={onClose} aria-label="Đang xử lý"><button disabled>Đợi</button></Dialog>)
  const dialog = screen.getByRole('dialog')
  expect(document.activeElement).toBe(dialog)
  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
  document.dispatchEvent(tab)
  expect(tab.defaultPrevented).toBe(true)
  expect(document.activeElement).toBe(dialog)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
})

it('does not dismiss a popover when pressing its trigger, but dismisses outside and on Escape', () => {
  const trigger = document.createElement('button')
  document.body.append(trigger)
  const onClose = vi.fn()
  const view = render(<Popover open label="Tùy chọn" trigger={trigger} onClose={onClose}>Nội dung</Popover>)
  fireEvent.pointerDown(trigger)
  expect(onClose).not.toHaveBeenCalled()
  fireEvent.pointerDown(document.body)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(2)
  view.unmount()
  trigger.remove()
  fireEvent.pointerDown(document.body)
  expect(onClose).toHaveBeenCalledTimes(2)
})

it('does not mount a popover without a trigger', () => {
  render(<Popover open label="Tùy chọn" trigger={null} onClose={vi.fn()}>Ẩn</Popover>)
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('moves context-menu focus between enabled items and cleans listeners on unmount', () => {
  const onClose = vi.fn()
  const view = render(<ContextMenu label="Thao tác" anchor={{ x: 10, y: 10, top: 0, bottom: 0, right: 0 }} anchored={false} onClose={onClose}>
    <button role="menuitem">Một</button><button role="menuitem" disabled>Khóa</button><button role="menuitem">Ba</button>
  </ContextMenu>)
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Một' }))
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Ba' }))
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Home' })
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Một' }))
  view.unmount()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
})

it('keeps the toast live region mounted and preserves undo rejection semantics', () => {
  const onDismiss = vi.fn()
  const onUndo = vi.fn(() => false)
  const view = render(<Toast label="Kết quả" toasts={[]} onDismiss={onDismiss} />)
  const region = screen.getByRole('status')
  view.rerender(<Toast label="Kết quả" toasts={[{ id: '1', text: 'Đã lưu cục bộ', tone: 'success', onUndo }]} onDismiss={onDismiss} />)
  expect(screen.getByRole('status')).toBe(region)
  fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }))
  expect(onUndo).toHaveBeenCalledTimes(1)
  expect(onDismiss).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }))
  expect(onDismiss).toHaveBeenCalledWith('1')
})
