import { useAuth } from '../../hooks/auth/use-auth'
import logo from '../../assets/8DA AI Network Logo.png'
import { BrandLockup } from '../../components/ui/brand/brand-lockup'
import { Button } from '../../components/ui/primitives/button'
import { Alert } from '../../components/ui/feedback/alert'

export const WorkspaceView = () => {
  const { snapshot, signOut } = useAuth()
  const user = snapshot.user?.value
  const displayName = snapshot.user?.source === 'profile'
    ? [snapshot.user.value.firstName, snapshot.user.value.lastName].filter(Boolean).join(' ') || user?.email
    : user?.email
  return <main className="workspace-shell">
    <header className="workspace-header">
      <BrandLockup logo={<img className="brand-logo" src={logo} alt="8DA AI Network" width="72" height="72" />}>Không gian dữ liệu</BrandLockup>
      <Button variant="secondary" onClick={() => { void signOut() }}>Đăng xuất <span aria-hidden="true">↗</span></Button>
    </header>
    <section className="workspace-content">
      <span className="eyebrow">Không gian làm việc</span>
      <h1 id="page-heading" tabIndex={-1}>{user ? `Xin chào, ${displayName}` : 'Kết nối đang gián đoạn'}</h1>
      {snapshot.phase === 'local-limited'
        ? <Alert role="status">Chưa thể kết nối dịch vụ. Bản nháp cục bộ vẫn được giữ; thao tác trực tuyến đang bị khóa.</Alert>
        : <p className="workspace-lead">Bạn đã đăng nhập vào phiên làm việc của mình.</p>}
      <div className="workspace-panel">
        <span className="panel-mark" aria-hidden="true">▦</span>
        <h2>Không gian làm việc đang được chuẩn bị</h2>
        <p>Các thao tác workspace chưa được mở trong phiên bản này.</p>
        {user && <span className="account-label">{user.email}</span>}
      </div>
    </section>
  </main>
}
