import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useLogin } from '../../hooks/auth/use-login'
import { LoginSceneSkeleton } from '../../components/loading/page-skeleton'
import { DataVerseMark } from '../../components/branding/dataverse-mark'
import { authGlassDebugModes, parseAuthGlassView } from '../../graphics/auth-glass/auth-glass.config'
import { authGlassProviderIcons } from '../../graphics/auth-glass/auth-glass.provider-icons'
import type { AuthGlassPanel } from '../../types/auth/auth-glass.types'
import { parseDisplayBaseView } from '../../graphics/auth-glass/display-base/display-base.config'
import './login-glass.css'

const compactLoginQuery = '(width < 992px)'
const sceneLoadTimeoutMs = 10_000

class LoginSceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onFailure()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

const AuthGlassStage = lazy(async () => {
  const { AuthGlassStage } = await import('../../components/graphics/auth-glass/auth-glass.scene')
  return { default: AuthGlassStage }
})

const AuthGlassReview = lazy(async () => {
  const { AuthGlassReview } = await import('../../components/graphics/auth-glass/auth-glass.scene')
  return { default: AuthGlassReview }
})

const DisplayBaseReview = lazy(async () => {
  const { DisplayBaseReview } = await import('../../components/graphics/auth-glass/display-base/display-base.review')
  return { default: DisplayBaseReview }
})

function AuthProviderButtons({ action }: { action: 'Đăng nhập' | 'Đăng ký' }) {
  return <>
    <div className="auth-glass-providers" role="group" aria-label={`Tùy chọn ${action.toLowerCase()} khác`} aria-describedby="auth-providers-status">
      {authGlassProviderIcons.map(({ name, paths }) => (
        <button key={name} type="button" aria-label={`${action} bằng ${name}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {paths.map(({ fill, d }) => <path key={d} fill={fill} d={d} />)}
          </svg>
        </button>
      ))}
    </div>
    <p className="auth-glass-provider-note" id="auth-providers-status">{action} qua nhà cung cấp chưa khả dụng.</p>
  </>
}

export const LoginView = () => {
  const form = useLogin()
  const pageElement = useRef<HTMLElement>(null)
  const formElement = useRef<HTMLElement>(null)
  const registerElement = useRef<HTMLElement>(null)
  const [searchParams] = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [activePanel, setActivePanel] = useState<AuthGlassPanel>('login')
  const [registerDraft, setRegisterDraft] = useState({ familyName: '', givenName: '', email: '', password: '' })
  const [compact, setCompact] = useState(() => window.matchMedia?.(compactLoginQuery)?.matches ?? false)
  const [sceneStatus, setSceneStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const showScene = !compact && typeof WebGL2RenderingContext !== 'undefined' && sceneStatus !== 'failed'
  const sceneLoading = showScene && sceneStatus === 'loading'

  useEffect(() => {
    const media = window.matchMedia?.(compactLoginQuery)
    const updateLayout = (event: MediaQueryListEvent) => {
      setCompact(event.matches)
      setSceneStatus('loading')
      setActivePanel('login')
    }
    media?.addEventListener('change', updateLayout)
    return () => media?.removeEventListener('change', updateLayout)
  }, [])

  useEffect(() => {
    if (!sceneLoading) return
    const timeout = window.setTimeout(() => {
      setSceneStatus(status => status === 'loading' ? 'failed' : status)
    }, sceneLoadTimeoutMs)
    return () => window.clearTimeout(timeout)
  }, [sceneLoading])

  function updateRegisterDraft(field: keyof typeof registerDraft, value: string) {
    setRegisterDraft(draft => ({ ...draft, [field]: value }))
  }

  function changePanel(panel: AuthGlassPanel) {
    setShowPassword(false)
    setActivePanel(panel)
  }
  const disabled = form.pending || !!form.configurationError || !!form.cleanupError
  const overlay = searchParams.get('overlay') === '1'
  const low = searchParams.get('quality') === 'low'
  const debugMode = import.meta.env.DEV ? searchParams.get('glassDebug') : null
  const lensDebug = Math.max(0, authGlassDebugModes.findIndex(mode => mode === debugMode))
  const thicknessParam = import.meta.env.DEV ? searchParams.get('glassThickness') : null
  const thickness = thicknessParam?.trim() ? Number(thicknessParam) : NaN
  const lensThickness = Number.isFinite(thickness) ? Math.min(200, Math.max(0, thickness)) : undefined
  const reviewView = parseAuthGlassView(searchParams.get('view')) ?? (overlay ? 'hero' : undefined)
  if (import.meta.env.DEV && searchParams.get('preview') === 'display-base') {
    const view = parseDisplayBaseView(searchParams.get('view'))
    return <Suspense fallback={null}>
      <DisplayBaseReview view={view} overlay={overlay && view === 'front'} slabs={searchParams.get('slabs') === '1'} />
    </Suspense>
  }
  if (import.meta.env.DEV && reviewView) {
    return <Suspense fallback={null}><AuthGlassReview view={reviewView} overlay={overlay && reviewView === 'hero'} low={low} /></Suspense>
  }
  return <main className="login-page auth-glass-login" ref={pageElement}>
    <header className="auth-glass-brand">
      <DataVerseMark className="auth-glass-brand-mark" />
      <div><strong>DataVerse</strong><span>Your Data. Our Universe.</span></div>
    </header>
    <div className="auth-glass-login-layout">
      <div className="auth-glass-visual" data-scene={showScene ? sceneStatus : undefined}>
        {sceneLoading && <LoginSceneSkeleton message="Đang tải giao diện 3D…" />}
        {showScene && <div className="auth-glass-login-stage" inert={sceneLoading}>
          <LoginSceneBoundary onFailure={() => setSceneStatus('failed')}>
            <Suspense fallback={null}>
              <AuthGlassStage
                interactive
                pageElement={pageElement}
                formElement={formElement}
                registerElement={registerElement}
                activePanel={activePanel}
                onPanelChange={changePanel}
                onRotateStart={() => setShowPassword(false)}
                onSceneStatus={setSceneStatus}
                low={low}
                lensDebug={lensDebug}
                lensThickness={lensThickness}
              />
            </Suspense>
          </LoginSceneBoundary>
        </div>}
        {(!showScene || activePanel === 'login') ? <section className="auth-glass-login-form auth-glass-form-panel" ref={formElement} hidden={sceneLoading} aria-labelledby="page-heading">
        <DataVerseMark className="auth-glass-sign-in-mark" />
        <div className="auth-glass-sign-in-content">
        <header className="auth-glass-form-header">
          <h1 id="page-heading" tabIndex={-1}>Chào mừng trở lại</h1>
          <p className="form-intro">Đăng nhập để tiếp tục với DataVerse.</p>
        </header>
        {form.configurationError && <div className="feedback-error" role="alert">Dịch vụ đăng nhập chưa được cấu hình. Vui lòng liên hệ người quản trị.</div>}
        {!form.configurationError && form.error && <div id="login-error" className="feedback-error" role="alert">{form.error}</div>}
        <form aria-label="Đăng nhập" aria-busy={form.pending} aria-describedby={!form.configurationError && form.error ? 'login-error' : undefined} onSubmit={event => {
          event.preventDefault()
          if (event.currentTarget.reportValidity()) void form.submit()
        }}>
          <div className="form-field">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" name="email" type="email" autoComplete="username" inputMode="email"
              placeholder="ten@congty.com" required value={form.email} disabled={disabled}
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
          <div className="auth-glass-sign-in-options">
            <label><input type="checkbox" /> Ghi nhớ đăng nhập</label>
            <button type="button">Quên mật khẩu</button>
          </div>
          <button className="button-primary login-submit" type="submit" disabled={disabled}>
            {form.pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
          <p className="form-status" role="status">{form.pending ? 'Đang xác nhận thông tin đăng nhập.' : ''}</p>
        </form>
        <AuthProviderButtons action="Đăng nhập" />
        <p className="auth-glass-sign-in-register">
          Chưa có tài khoản?{' '}
          <button type="button" disabled={!showScene} onClick={() => changePanel('register')}>Đăng ký</button>
        </p>
        {form.cleanupError && <button type="button" className="text-link" onClick={() => { void form.signOut() }}>Thử dọn phiên lại</button>}
        </div>
        </section> : <section
          className="auth-glass-login-form auth-glass-form-panel auth-glass-register-form"
          ref={registerElement}
          hidden={sceneLoading}
          aria-labelledby="register-heading"
        >
          <DataVerseMark className="auth-glass-sign-in-mark" />
          <div className="auth-glass-sign-in-content">
          <header className="auth-glass-form-header">
            <h2 id="register-heading" tabIndex={-1}>Tạo tài khoản</h2>
            <p className="form-intro">Đăng ký để bắt đầu với DataVerse.</p>
          </header>
          <form aria-label="Đăng ký" onSubmit={event => event.preventDefault()}>
            <div className="auth-glass-name-fields">
              <div className="form-field">
                <label htmlFor="register-family-name">Họ</label>
                <input id="register-family-name" name="familyName" autoComplete="family-name" placeholder="Nhập họ" required
                  value={registerDraft.familyName} onChange={event => updateRegisterDraft('familyName', event.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="register-given-name">Tên</label>
                <input id="register-given-name" name="givenName" autoComplete="given-name" placeholder="Nhập tên" required
                  value={registerDraft.givenName} onChange={event => updateRegisterDraft('givenName', event.target.value)} />
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="register-email">Email</label>
              <input id="register-email" name="email" type="email" autoComplete="email" placeholder="Nhập email" required
                value={registerDraft.email} onChange={event => updateRegisterDraft('email', event.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="register-password">Mật khẩu</label>
              <input id="register-password" name="password" type="password" autoComplete="new-password" placeholder="Nhập mật khẩu" required
                value={registerDraft.password} onChange={event => updateRegisterDraft('password', event.target.value)} />
            </div>
            <button className="button-primary login-submit" type="button">Tạo tài khoản</button>
            <p className="form-status">Chưa mở đăng ký tài khoản.</p>
          </form>
          <AuthProviderButtons action="Đăng ký" />
          <p className="auth-glass-sign-in-register">
            Đã có tài khoản?{' '}
            <button type="button" onClick={() => changePanel('login')}>Đăng nhập</button>
          </p>
          </div>
        </section>}
      </div>
      <section className="auth-glass-universe" aria-labelledby="auth-glass-universe-heading">
        <span className="eyebrow">Data Universe</span>
        <h2 id="auth-glass-universe-heading">Dữ liệu là<br />vũ trụ của những cơ hội</h2>
        <p>DataVerse giúp bạn khám phá, đánh giá và nâng tầm chất lượng dữ liệu bằng sức mạnh công nghệ và trí tuệ nhân tạo.</p>
        <ul>
          <li><strong>Khám phá</strong><span>Dữ liệu sâu hơn</span></li>
          <li><strong>Đánh giá</strong><span>Chất lượng thông minh</span></li>
          <li><strong>Kiến tạo</strong><span>Những giá trị mới</span></li>
        </ul>
      </section>
    </div>
  </main>
}
