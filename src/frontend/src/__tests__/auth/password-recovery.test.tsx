import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../lib/api-error'
import { PasswordRecoveryDialog } from '../../views/auth/login/sections/password-recovery-dialog'

const account = vi.hoisted(() => ({ forgotPassword: vi.fn(), resetPassword: vi.fn() }))
vi.mock('../../services/auth/account.service', () => ({ createAccountService: () => account }))

afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks() })

const submit = async () => {
  const button = screen.getByRole('button', { name: /Gửi mã xác minh|Cập nhật mật khẩu/ })
  const form = button.closest('form')
  if (!form) throw new Error('Missing recovery form')
  await act(async () => { fireEvent.submit(form); await Promise.resolve() })
}

it('honors Retry-After without sending more requests during the cooldown', async () => {
  vi.useFakeTimers()
  account.forgotPassword.mockRejectedValueOnce(new ApiError({ kind: 'http', status: 429, message: 'Giới hạn gửi mã', retryAfterMs: 3000 }))
  account.forgotPassword.mockResolvedValueOnce({})
  render(<PasswordRecoveryDialog initialEmail="qa@example.com" onClose={() => {}} />)
  await submit()
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Gửi mã xác minh' }).disabled).toBe(true)
  expect(screen.getByRole('status').textContent).toContain('3 giây')
  await submit()
  expect(account.forgotPassword).toHaveBeenCalledTimes(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  expect(screen.getByRole('status').textContent).toContain('1 giây')
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  await submit()
  expect(account.forgotPassword).toHaveBeenCalledTimes(2)
  expect(screen.getByLabelText('Mã xác thực')).toBeDefined()
})

it('submits the OTP and matching passwords through the reset flow', async () => {
  account.forgotPassword.mockResolvedValue({})
  account.resetPassword.mockResolvedValue({})
  render(<PasswordRecoveryDialog initialEmail="qa@example.com" onClose={() => {}} />)
  await submit()
  fireEvent.change(screen.getByLabelText('Mã xác thực'), { target: { value: '123456' } })
  fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'Synthetic-QA-123!' } })
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu'), { target: { value: 'Mismatch-123!' } })
  await submit()
  expect(account.resetPassword).not.toHaveBeenCalled()
  expect(screen.getByRole('alert').textContent).toContain('không khớp')
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu'), { target: { value: 'Synthetic-QA-123!' } })
  await submit()
  expect(account.resetPassword).toHaveBeenCalledExactlyOnceWith({ email: 'qa@example.com', otp: '123456', new_password: 'Synthetic-QA-123!' })
  expect(screen.getByRole('status').textContent).toContain('cập nhật thành công')
})

it('does not send duplicate OTP requests while one is pending', async () => {
  let finish!: () => void
  account.forgotPassword.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  render(<PasswordRecoveryDialog initialEmail="qa@example.com" onClose={() => {}} />)
  await submit()
  await submit()
  expect(account.forgotPassword).toHaveBeenCalledTimes(1)
  await act(async () => { finish(); await Promise.resolve() })
})
