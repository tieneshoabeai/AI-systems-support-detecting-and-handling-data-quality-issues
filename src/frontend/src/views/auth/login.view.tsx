import { useState } from 'react'
import { useLogin } from '../../hooks/auth/use-login'
import logo from '../../assets/8DA AI Network Logo.png'

export const LoginView = () => {
  const form = useLogin()
  const [showPassword, setShowPassword] = useState(false)
  const disabled = form.pending || !!form.configurationError || !!form.cleanupError
  return <main className="login-page">
    <section className="login-story" aria-labelledby="story-title">
      <header className="brand-lockup">
        <img className="brand-logo" src={logo} alt="8DA AI Network" width="88" height="88" />
        <span>Hệ thống AI hỗ trợ phát hiện<br />và xử lý vấn đề về chất lượng dữ liệu</span>
      </header>
      <div className="story-copy">
        <span className="eyebrow"><span className="brand-dot" /> Không gian dữ liệu</span>
        <h1 id="story-title">Hiểu dữ liệu.<br /><span>Kiểm soát<br className="desktop-break" /> chất lượng.</span></h1>
        <p>Một nơi để khám phá dữ liệu,<br />kiểm tra vấn đề và đưa ra quyết định.</p>
      </div>
      <footer className="story-footer"><span className="fine-rule" />Dữ liệu rõ ràng. Quyết định có cơ sở.</footer>
    </section>
    <section className="login-form-area" aria-labelledby="page-heading">
      <div className="form-tray"><div className="login-card">
        <span className="eyebrow">Bắt đầu phiên làm việc</span>
        <h2 id="page-heading" tabIndex={-1}>Chào mừng trở lại</h2>
        <p className="form-intro">Đăng nhập để tiếp tục làm việc với dữ liệu.</p>
        {form.configurationError && <div className="feedback-error" role="alert">Dịch vụ đăng nhập chưa được cấu hình. Vui lòng liên hệ người quản trị.</div>}
        {!form.configurationError && form.error && <div id="login-error" className="feedback-error" role="alert">{form.error}</div>}
        <form aria-label="Đăng nhập" aria-busy={form.pending} aria-describedby={!form.configurationError && form.error ? 'login-error' : undefined} onSubmit={event => {
          event.preventDefault()
          if (event.currentTarget.reportValidity()) void form.submit()
        }}>
          <div className="form-field">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" name="email" type="email" autoComplete="username" inputMode="email"
              placeholder="Nhập email của bạn" required value={form.email} disabled={disabled}
              onChange={event => form.setEmail(event.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="login-password">Mật khẩu</label>
            <div className="password-field">
              <input id="login-password" name="password" type={showPassword ? 'text' : 'password'}
                autoComplete="current-password" placeholder="Nhập mật khẩu" required value={form.password}
                disabled={disabled} onChange={event => form.setPassword(event.target.value)} />
              <button type="button" className="password-toggle" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword} disabled={disabled} onClick={() => setShowPassword(value => !value)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
                  {showPassword && <path d="m4 3 16 18" />}
                </svg>
              </button>
            </div>
          </div>
          <button className="button-primary login-submit" type="submit" disabled={disabled}>
            <span>{form.pending ? 'Đang đăng nhập…' : 'Đăng nhập'}</span>
            <span className="button-arrow" aria-hidden="true">↗</span>
          </button>
          <p className="form-status" role="status">{form.pending ? 'Đang xác nhận thông tin đăng nhập.' : 'Tiếp tục với tài khoản của bạn.'}</p>
        </form>
        {form.cleanupError && <button type="button" className="text-link" onClick={() => { void form.signOut() }}>Thử dọn phiên lại</button>}
      </div></div>
      <p className="login-footer">AI Systems · Data Quality</p>
    </section>
  </main>
}
