import { useState } from 'react'
import { Dialog } from '../../../../components/ui/overlay/dialog'
import { createAccountService } from '../../../../services/auth/account.service'

export function PasswordRecoveryDialog({ initialEmail, onClose }: { initialEmail: string; onClose: () => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    if (busy) return
    if (step === 'reset' && password !== confirm) { setError('Hai lần nhập mật khẩu không khớp.'); return }
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không gửi được yêu cầu.') }
    finally { setBusy(false) }
  }
  return <Dialog open onClose={onClose} busy={busy} aria-labelledby="recovery-title">
    <h2 id="recovery-title">Khôi phục mật khẩu</h2>
    {step === 'done' ? <><p role="status">Đã đặt lại mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới.</p><button onClick={onClose}>Về đăng nhập</button></>
      : <form onSubmit={event => { event.preventDefault(); void submit() }} aria-busy={busy}>
        <label className="dialog-field">Email<input type="email" required autoComplete="email" value={email} disabled={busy || step === 'reset'} onChange={event => setEmail(event.target.value)} /></label>
        {step === 'reset' && <>
          <p>Nếu tài khoản hợp lệ và dịch vụ email khả dụng, hãy kiểm tra mã OTP trong hộp thư.</p>
          <label className="dialog-field">Mã OTP<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} disabled={busy} onChange={event => setOtp(event.target.value)} /></label>
          <label className="dialog-field">Mật khẩu mới<input required type="password" autoComplete="new-password" minLength={8} maxLength={100} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>
          <label className="dialog-field">Nhập lại mật khẩu<input required type="password" autoComplete="new-password" minLength={8} maxLength={100} value={confirm} disabled={busy} onChange={event => setConfirm(event.target.value)} /></label>
          <button type="button" disabled={busy} onClick={() => { setStep('request'); setOtp(''); setError('') }}>Đổi email hoặc yêu cầu mã mới</button>
        </>}
        {error && <p role="alert">{error}</p>}
        <div className="dialog-actions"><button type="button" disabled={busy} onClick={onClose}>Hủy</button>
          <button type="submit" disabled={busy}>{step === 'request' ? 'Yêu cầu OTP' : 'Đặt lại mật khẩu'}</button></div>
      </form>}
  </Dialog>
}
