import { Button, Input } from '../../../../components/ui/controls'
import { Icon } from '../../../../components/ui/primitives/icon'
import { useEffect, useRef, useState } from 'react'
import { Dialog } from '../../../../components/ui/overlay/dialog'
import { createAccountService } from '../../../../services/auth/account.service'
import { ApiError } from '../../../../lib/api-error'

export function PasswordRecoveryDialog({ initialEmail, onClose }: { initialEmail: string; onClose: () => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retryAt, setRetryAt] = useState<number | null>(null)
  const [retrySeconds, setRetrySeconds] = useState(0)
  const submitting = useRef(false)
  useEffect(() => {
    if (retryAt === null) return
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))
      setRetrySeconds(remaining)
      if (remaining === 0) setRetryAt(null)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [retryAt])
  const submit = async () => {
    if (submitting.current || (retryAt !== null && Date.now() < retryAt)) return
    if (step === 'reset' && password !== confirm) { setError('Hai lần nhập mật khẩu không khớp.'); return }
    submitting.current = true
    setBusy(true); setError('')
    try {
      const api = createAccountService()
      if (step === 'request') {
        await api.forgotPassword({ email: email.trim() })
        setStep('reset')
      } else {
        await api.resetPassword({ email: email.trim(), otp, new_password: password })
        setPassword(''); setConfirm(''); setOtp(''); setStep('done')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không gửi được yêu cầu.')
      if (cause instanceof ApiError && cause.status === 429) {
        const delay = Math.max(1000, cause.retryAfterMs ?? 60_000)
        setRetryAt(Date.now() + delay)
        setRetrySeconds(Math.ceil(delay / 1000))
      }
    } finally { submitting.current = false; setBusy(false) }
  }
  const complete = step === 'done'
  return <Dialog open onClose={onClose} busy={busy} aria-labelledby="recovery-title" className="auth-password-recovery">
    <div className="password-recovery-header">
      <span className={`password-recovery-mark${complete ? ' is-complete' : ''}`} aria-hidden="true">
        <Icon name={complete ? 'check-circle' : 'lock'} />
      </span>
      <div className="password-recovery-heading">
        <span className="password-recovery-kicker">KHÔI PHỤC TÀI KHOẢN</span>
        <h2 id="recovery-title">{complete ? 'Mật khẩu đã cập nhật' : step === 'request' ? 'Xác minh email' : 'Tạo mật khẩu mới'}</h2>
        <p>{complete
          ? 'Bạn có thể đăng nhập bằng mật khẩu mới.'
          : step === 'request'
            ? 'Nhập email đăng ký để nhận mã xác minh bảo mật.'
            : 'Nhập mã trong email và chọn mật khẩu an toàn mới.'}</p>
      </div>
      <Button type="button" className="password-recovery-close" aria-label="Đóng cửa sổ" disabled={busy} onClick={onClose}>
        <Icon name="close" />
      </Button>
    </div>
    {!complete && <ol className="password-recovery-steps" aria-label="Các bước khôi phục mật khẩu">
      <li data-state={step === 'request' ? 'active' : 'complete'} aria-current={step === 'request' ? 'step' : undefined}>
        <span className="password-recovery-step-number" aria-hidden="true">{step === 'reset' ? '✓' : '1'}</span>
        <span>Xác minh email</span>
      </li>
      <li data-state={step === 'reset' ? 'active' : 'upcoming'} aria-current={step === 'reset' ? 'step' : undefined}>
        <span className="password-recovery-step-number" aria-hidden="true">2</span>
        <span>Mật khẩu mới</span>
      </li>
    </ol>}
    {complete ? <div className="password-recovery-success">
      <p role="status">Mật khẩu của bạn đã được cập nhật thành công. Hãy đăng nhập để tiếp tục.</p>
      <Button className="password-recovery-submit" onClick={onClose}>Về đăng nhập</Button>
    </div> : <form className="password-recovery-form" onSubmit={event => { event.preventDefault(); void submit() }} aria-busy={busy}>
      <label className="dialog-field">Email đăng ký
        <Input type="email" required autoComplete="email" value={email} disabled={busy || step === 'reset'} onChange={event => setEmail(event.target.value)} />
      </label>
      {step === 'reset' && <>
        <p>Nếu tài khoản hợp lệ và dịch vụ email khả dụng, mã OTP có hiệu lực 10 phút. Kiểm tra hộp thư và thư rác.</p>
        <label className="dialog-field">Mã xác thực
          <Input className="password-recovery-otp" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} disabled={busy} onChange={event => setOtp(event.target.value)} />
        </label>
        <div className="password-recovery-passwords">
          <label className="dialog-field">Mật khẩu mới
            <Input required type="password" autoComplete="new-password" minLength={8} maxLength={100} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} />
          </label>
          <label className="dialog-field">Nhập lại mật khẩu
            <Input required type="password" autoComplete="new-password" minLength={8} maxLength={100} value={confirm} disabled={busy} onChange={event => setConfirm(event.target.value)} />
          </label>
        </div>
        <Button className="password-recovery-resend" type="button" disabled={busy} onClick={() => { setStep('request'); setOtp(''); setError('') }}>
          Thay đổi email
        </Button>
      </>}
      {error && <p className="password-recovery-error" role="alert">{error}</p>}
      {retryAt !== null && <p role="status">Bạn đã gửi quá nhiều yêu cầu. Thử lại sau {retrySeconds} giây.</p>}
      <div className="dialog-actions password-recovery-actions">
        <Button className="password-recovery-cancel" type="button" disabled={busy} onClick={onClose}>Hủy</Button>
        <Button className="password-recovery-submit" type="submit" disabled={busy || retryAt !== null}>
          {step === 'request' ? 'Gửi mã xác minh' : 'Cập nhật mật khẩu'}
        </Button>
      </div>
    </form>}
  </Dialog>
}
