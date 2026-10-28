import { useAuth } from '../hooks/auth/use-auth'
import logo from '../assets/8DA AI Network Logo.png'

const Layout = () => {
  const { snapshot, signOut } = useAuth()
  const user = snapshot.user?.value
  return <main className="workspace-shell">
    <header className="workspace-header">
      <div className="brand-lockup"><img className="brand-logo" src={logo} alt="8DA AI Network" width="72" height="72" /><span>Không gian dữ liệu</span></div>
      <button className="button-secondary" onClick={() => { void signOut() }}>Đăng xuất <span aria-hidden="true">↗</span></button>
    </header>
    <section className="workspace-content">
      <span className="eyebrow">Không gian làm việc</span>
      <h1 id="page-heading" tabIndex={-1}>{user ? `Xin chào, ${[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}` : 'Kết nối đang gián đoạn'}</h1>
      {snapshot.phase === 'local-limited'
        ? <div className="feedback-error" role="status">Chưa thể kết nối dịch vụ. Bản nháp cục bộ vẫn được giữ; thao tác trực tuyến đang bị khóa.</div>
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

export default Layout
