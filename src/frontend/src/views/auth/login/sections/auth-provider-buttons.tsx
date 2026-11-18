import { authGlassProviderIcons } from '../../../../graphics/auth-glass/auth-glass.provider-icons'

export function AuthProviderButtons({ action }: { action: 'Đăng nhập' | 'Đăng ký' }) {
  return <>
    <div className="auth-glass-providers" role="group" aria-label={`Tùy chọn ${action.toLowerCase()} khác`} aria-describedby="auth-providers-status">
      {authGlassProviderIcons.map(({ name, paths }) => (
        <button key={name} type="button" disabled aria-label={`${action} bằng ${name}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {paths.map(({ fill, d }) => <path key={d} fill={fill} d={d} />)}
          </svg>
        </button>
      ))}
    </div>
    <p className="auth-glass-provider-note" id="auth-providers-status">{action} qua nhà cung cấp chưa khả dụng.</p>
  </>
}
