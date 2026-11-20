import { useState } from 'react'
import { authGlassProviderIcons } from '../../../../graphics/auth-glass/auth-glass.provider-icons'
import { isShoppingDemo } from '../../../../mocks/shopping-trends/demo-mode'
import { startGoogleSignIn } from '../../../../services/auth/google-sign-in'

export function AuthProviderButtons({ action, disabled }: { action: 'Đăng nhập' | 'Đăng ký'; disabled: boolean }) {
  const [error, setError] = useState(false)
  const googleAvailable = !isShoppingDemo()
  return <>
    <div className="auth-glass-providers" role="group" aria-label={`Tùy chọn ${action.toLowerCase()} khác`} aria-describedby="auth-providers-status">
      {authGlassProviderIcons.map(({ name, paths }) => (
        <button key={name} type="button" disabled={disabled || !googleAvailable || name !== 'Google'} aria-label={`${action} bằng ${name}`} onClick={() => {
          try { startGoogleSignIn() } catch { setError(true) }
        }}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {paths.map(({ fill, d }) => <path key={d} fill={fill} d={d} />)}
          </svg>
        </button>
      ))}
    </div>
    <p className="auth-glass-provider-note" id="auth-providers-status">
      {googleAvailable ? 'Microsoft và GitHub chưa khả dụng.' : `${action} qua nhà cung cấp chưa khả dụng.`}
    </p>
    {error && <p role="alert">Không mở được đăng nhập Google. Vui lòng thử lại.</p>}
  </>
}
