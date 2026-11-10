import './page-skeleton.css'

export function LoginSceneSkeleton({ message }: { message?: string }) {
  return <div className="login-scene-skeleton">
    {message && <p className="skeleton-status" role="status">{message}</p>}
    <div className="login-skeleton-panels" aria-hidden="true">
      <span className="skeleton-block" />
      <span className="skeleton-block" />
    </div>
    <div className="skeleton-toolbar" aria-hidden="true">
      <span className="skeleton-block" />
      <span className="skeleton-block" />
      <span className="skeleton-block" />
    </div>
  </div>
}

export function PageSkeleton({ pathname, message }: { pathname: string; message: string }) {
  const path = pathname.replace(/\/+$/, '') || '/'
  const status = <p className="skeleton-status" role="status">{message}</p>

  if (path === '/auth/login') {
    return <main className="login-page auth-glass-login skeleton-login">
      {status}
      <div className="auth-glass-brand" aria-hidden="true">
        <span className="skeleton-block skeleton-brand-mark" />
        <span className="skeleton-block skeleton-brand-text" />
      </div>
      <div className="auth-glass-login-layout" aria-hidden="true">
        <div className="auth-glass-visual" data-scene="loading">
          <LoginSceneSkeleton />
          <div className="skeleton-login-form">
            <span className="skeleton-block skeleton-title" />
            <span className="skeleton-block skeleton-line" />
            <span className="skeleton-block skeleton-input" />
            <span className="skeleton-block skeleton-input" />
            <span className="skeleton-block skeleton-input" />
            <div className="skeleton-toolbar">
              <span className="skeleton-block" /><span className="skeleton-block" /><span className="skeleton-block" />
            </div>
          </div>
        </div>
        <div className="auth-glass-universe skeleton-workspace-copy">
          <span className="skeleton-block skeleton-title" />
          <span className="skeleton-block skeleton-line" />
          <span className="skeleton-block skeleton-line" />
        </div>
      </div>
    </main>
  }

  if (path === '/workspaces/3d-dataset') {
    return <main className="skeleton-dataset">
      {status}
      <div className="skeleton-workspace-copy" aria-hidden="true">
        <span className="skeleton-block skeleton-line" />
        <span className="skeleton-block skeleton-title" />
      </div>
      <div className="skeleton-dataset-stage" aria-hidden="true">
        <span className="skeleton-block skeleton-brand-mark" />
        <span className="skeleton-block skeleton-dataset-control" />
      </div>
    </main>
  }

  return <main className="workspace-shell">
    {status}
    <div className="workspace-header" aria-hidden="true">
      <span className="skeleton-block skeleton-workspace-logo" />
      <span className="skeleton-block skeleton-brand-text" />
    </div>
    <div className="workspace-content skeleton-workspace-copy" aria-hidden="true">
      <span className="skeleton-block skeleton-line" />
      <span className="skeleton-block skeleton-title" />
      <span className="skeleton-block skeleton-line" />
      <div className="workspace-panel skeleton-workspace-panel">
        <span className="skeleton-block skeleton-brand-mark" />
        <span className="skeleton-block skeleton-title" />
        <span className="skeleton-block skeleton-line" />
      </div>
    </div>
  </main>
}
