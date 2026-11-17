import { createRef } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Button } from '../../../components/ui/primitives/button'
import { IconButton } from '../../../components/ui/primitives/icon-button'
import { Input } from '../../../components/ui/primitives/input'
import { Textarea } from '../../../components/ui/primitives/textarea'
import { Checkbox } from '../../../components/ui/primitives/checkbox'
import { Icon } from '../../../components/ui/primitives/icon'
import { FormField } from '../../../components/ui/form/form-field'
import { PasswordInput } from '../../../components/ui/form/password-input'
import { Select } from '../../../components/ui/form/select'

afterEach(cleanup)

it('preserves native button refs, explicit submit and secondary variant', () => {
  const ref = createRef<HTMLButtonElement>()
  const onClick = vi.fn()
  render(<Button ref={ref} type="submit" variant="secondary" onClick={onClick}>Lưu</Button>)
  const button = screen.getByRole('button', { name: 'Lưu' })
  expect(ref.current).toBe(button)
  expect(button.getAttribute('type')).toBe('submit')
  expect(button.classList.contains('button-secondary')).toBe(true)
  fireEvent.click(button)
  expect(onClick).toHaveBeenCalledTimes(1)
})

it('prevents repeated actions while loading and defaults to a non-submit button', () => {
  const onClick = vi.fn()
  render(<Button loading onClick={onClick}>Đang lưu</Button>)
  const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Đang lưu' })
  expect(button.disabled).toBe(true)
  expect(button.getAttribute('aria-busy')).toBe('true')
  expect(button.type).toBe('button')
  fireEvent.click(button)
  expect(onClick).not.toHaveBeenCalled()
})

it('keeps an icon button named and disabled without swallowing native attributes', () => {
  render(<IconButton aria-label="Đóng" disabled data-testid="close"><Icon name="close" /></IconButton>)
  const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Đóng' })
  expect(button.disabled).toBe(true)
  expect(screen.getByTestId('close')).toBe(button)
  expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
})

it('connects labels, help and errors to a native input and keeps the supplied ID', () => {
  const ref = createRef<HTMLInputElement>()
  render(<FormField id="name" label="Tên" hint="Tên hiển thị" error="Thiếu tên">
    {props => <Input {...props} ref={ref} defaultValue="" />}
  </FormField>)
  const input = screen.getByLabelText('Tên')
  expect(ref.current).toBe(input)
  expect(input.id).toBe('name')
  expect(input.getAttribute('aria-describedby')).toBe('name-hint name-error')
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(screen.getByRole('alert').textContent).toBe('Thiếu tên')
})

it('generates independent field IDs and removes stale error descriptions', () => {
  const view = render(<><FormField label="Một" error="Sai">{props => <Input {...props} />}</FormField>
    <FormField label="Hai">{props => <Input {...props} />}</FormField></>)
  expect(screen.getByLabelText('Một').id).not.toBe(screen.getByLabelText('Hai').id)
  view.rerender(<FormField label="Một">{props => <Input {...props} />}</FormField>)
  expect(screen.getByLabelText('Một').getAttribute('aria-describedby')).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('toggles password visibility without altering value, ref or autocomplete', () => {
  const ref = createRef<HTMLInputElement>()
  render(<PasswordInput ref={ref} aria-label="Mật khẩu" defaultValue="  aB12!  " autoComplete="current-password" />)
  const input = screen.getByLabelText<HTMLInputElement>('Mật khẩu')
  expect(input.type).toBe('password')
  fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }))
  expect(input.type).toBe('text')
  expect(input.value).toBe('  aB12!  ')
  expect(ref.current).toBe(input)
  expect(input.autocomplete).toBe('current-password')
  fireEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }))
  expect(input.type).toBe('password')
})

it('disables both password input and reveal control', () => {
  render(<PasswordInput aria-label="Mật khẩu" disabled />)
  expect(screen.getByLabelText<HTMLInputElement>('Mật khẩu').disabled).toBe(true)
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Hiện mật khẩu' }).disabled).toBe(true)
})

it('keeps textarea, select and checkbox native change behavior', () => {
  const onChange = vi.fn()
  render(<><Textarea aria-label="Ghi chú" onChange={onChange} error />
    <Select aria-label="Vai trò" defaultValue="a"><option value="a">A</option><option value="b">B</option></Select>
    <Checkbox aria-label="Đồng ý" /></>)
  fireEvent.change(screen.getByLabelText('Ghi chú'), { target: { value: 'Nội dung' } })
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText('Ghi chú').getAttribute('aria-invalid')).toBe('true')
  fireEvent.change(screen.getByLabelText('Vai trò'), { target: { value: 'b' } })
  expect(screen.getByLabelText<HTMLSelectElement>('Vai trò').value).toBe('b')
  fireEvent.click(screen.getByLabelText('Đồng ý'))
  expect(screen.getByLabelText<HTMLInputElement>('Đồng ý').checked).toBe(true)
})

it('exposes a named icon and retains the existing unknown-name fallback', () => {
  const view = render(<Icon name="unknown" label="Biểu tượng" />)
  const path = screen.getByRole('img', { name: 'Biểu tượng' }).querySelector('path')?.getAttribute('d')
  view.rerender(<Icon name="datasets" label="Biểu tượng" />)
  expect(screen.getByRole('img').querySelector('path')?.getAttribute('d')).toBe(path)
})
