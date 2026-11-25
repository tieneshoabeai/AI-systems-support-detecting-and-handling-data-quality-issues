import './page-skeleton.css'
import { Skeleton } from '../ui/feedback/skeleton'
import { readSidebarCollapsed } from '../../hooks/workbench/sidebar-preference'

export function LoginSceneSkeleton({ message }: { message?: string }) {
  return <div className="login-scene-skeleton">
    {message && <p className="skeleton-status" role="status">{message}</p>}
    <div className="login-skeleton-panels" aria-hidden="true">
      <div className="login-skeleton-panel">
        <Skeleton className="skeleton-title" />
        <Skeleton className="skeleton-line" />
        <Skeleton className="skeleton-input" />
        <Skeleton className="skeleton-input" />
        <Skeleton className="skeleton-input" />
      </div>
      <div className="login-skeleton-panel">
        <Skeleton className="skeleton-title" />
        <Skeleton className="skeleton-line" />
      </div>
    </div>
    <div className="skeleton-toolbar" aria-hidden="true">
      <span className="skeleton-block" />
      <span className="skeleton-block" />
      <span className="skeleton-block" />
    </div>
  </div>
}

export function ProjectHeaderSkeleton() {
  return <div className="pj-head-row skeleton-project-head" aria-hidden="true">
    <Skeleton className="skeleton-line" />
    <div className="skeleton-project-dataset">
      <Skeleton className="skeleton-brand-mark" />
      <div><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line" /></div>
    </div>
  </div>
}

export function ProjectSceneSkeleton({ message }: { message?: string }) {
  return <div className="skeleton-project-scene">
    {message && <p className="skeleton-status" role="status">{message}</p>}
    <Skeleton className="skeleton-scene-core" />
    <div className="skeleton-scene-controls" aria-hidden="true">
      <Skeleton /><Skeleton />
    </div>
  </div>
}

export function RecentProjectSkeletonRows() {
  return [0, 1, 2].map(row => <tr key={row} aria-hidden="true" className="skeleton-recent-row">
    {[0, 1, 2, 3, 4, 5, 6].map(column => <td key={column}><Skeleton /></td>)}
  </tr>)
}

export function WorkspaceStatsSkeleton() {
  return <div className="stat-row skeleton-workspace-stats">
    {[0, 1, 2, 3, 4].map(index => <Skeleton key={index} />)}
  </div>
}

export function WorkspaceCardsSkeleton({ list = false }: { list?: boolean }) {
  return <div className={`card-grid skeleton-workspace-cards${list ? ' is-list' : ''}`}>
    {[0, 1, 2].map(index => <div key={index}>
      <Skeleton className="skeleton-workspace-cover" />
      <Skeleton className="skeleton-line" />
      <Skeleton className="skeleton-line" />
    </div>)}
  </div>
}

function WorkspacesSkeleton() {
  return <div className="skeleton-route-content" aria-hidden="true">
    <div className="workspace-hero skeleton-route-hero">
      <div className="workspace-hero-copy skeleton-route-copy">
        <Skeleton className="skeleton-line" />
        <Skeleton className="skeleton-title" />
        <Skeleton className="skeleton-line" />
        <Skeleton className="skeleton-route-action" />
      </div>
      <Skeleton className="skeleton-route-art" />
    </div>
    <WorkspaceStatsSkeleton />
    <div className="toolbar skeleton-workspace-filters">
      {[0, 1, 2, 3].map(index => <Skeleton key={index} />)}
    </div>
    <WorkspaceCardsSkeleton />
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

  if (path === '/management' || path === '/management/workspaces') {
    return <main className="skeleton-route-frame skeleton-management-frame" data-compact={readSidebarCollapsed()}>
      {status}
      <aside className="skeleton-management-sidebar" aria-hidden="true">
        <Skeleton className="skeleton-brand-mark" />
        {[0, 1, 2].map(index => <div key={index}><Skeleton /><Skeleton /></div>)}
      </aside>
      <div className="skeleton-management-main">
        <div className="skeleton-route-header" aria-hidden="true">
          <Skeleton className="skeleton-brand-text" /><Skeleton className="skeleton-brand-mark" />
        </div>
        {path === '/management/workspaces' ? <WorkspacesSkeleton /> : <div className="skeleton-route-content" aria-hidden="true">
          <div className="skeleton-route-hero">
            <div className="skeleton-route-copy"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /></div>
            <Skeleton className="skeleton-route-art" />
          </div>
          <WorkspaceStatsSkeleton />
          <WorkspaceCardsSkeleton />
        </div>}
      </div>
    </main>
  }

  if (path === '/processing' || /^\/processing\/projects\/[^/]+$/.test(path)) {
    const project = path.startsWith('/processing/projects/')
    return <main className="skeleton-route-frame">
      {status}
      <div className="skeleton-route-header" aria-hidden="true">
        <Skeleton className="skeleton-brand-text" />
        <Skeleton className="skeleton-brand-mark" />
      </div>
      {project ? <div className="skeleton-route-content" aria-hidden="true">
        <ProjectHeaderSkeleton />
        <ProjectSceneSkeleton />
        <div className="skeleton-project-modules"><Skeleton /><Skeleton /><Skeleton /></div>
      </div> : <div className="skeleton-route-content" aria-hidden="true">
          <div className="skeleton-route-hero skeleton-processing-hero">
            <div className="skeleton-route-copy"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-route-action" /></div>
            <Skeleton className="skeleton-route-art" />
          </div>
          <div className="skeleton-recent-panel">
            <Skeleton className="skeleton-line" />
            <table><tbody><RecentProjectSkeletonRows /></tbody></table>
          </div>
        </div>}
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
