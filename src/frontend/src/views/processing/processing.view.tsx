import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { PreviewShell } from '../preview/components/preview-shell'
import { UniverseHero } from '../preview/components/universe-hero'
import { RecentProjects } from '../preview/components/recent-projects'
import { PreviewIcon } from '../preview/components/preview-icons'
import './processing.css'

// Landing and project-creation UI only. All dataset work belongs to the project page.
// Creation remains unavailable until its API/workspace contract is integrated.
export function ProcessingView() {
  const { pathname } = useLocation()
  const creating = pathname.replace(/\/$/, '') === '/processing/new'
  useEffect(() => { document.getElementById('page-heading')?.focus() }, [pathname])
  return <PreviewShell active="home" area="processing" context={<>
    <Link className="text-link" to="/management">Quản lý</Link>
    <span aria-hidden="true"> / </span>
    <Link className="text-link" to="/processing">AI Data Processing</Link>
  </>}>
    {creating ? <main className="processing-content">
      <h1 id="page-heading" tabIndex={-1}>Tạo Project mới</h1>
      <section className="panel processing-panel">
        <h2>Thông tin Project</h2>
        <fieldset disabled className="processing-fields">
          <label>Tên Project<input name="name" type="text" /></label>
          <label>Mô tả<textarea name="description" rows={3} /></label>
        </fieldset>
        <p id="create-project-unavailable">Chưa kết nối dịch vụ tạo Project. Khi được lưu, Project sẽ mở tại trang Tổng quan; upload dữ liệu thực hiện trong trang Project.</p>
        <button type="button" className="button-primary" disabled aria-describedby="create-project-unavailable">Tạo Project và tiếp tục</button>
        <Link className="text-link" to="/processing">Quay lại</Link>
      </section>
    </main> : <main className="processing-landing">
      <UniverseHero headingId="page-heading" />
      <RecentProjects action={<Link className="button-primary" to="/processing/new"><PreviewIcon name="plus" /> Tạo Project</Link>} />
      <p className="action-note">Dữ liệu mẫu, chưa kết nối API. Chọn Project để làm việc với dữ liệu.</p>
    </main>}
  </PreviewShell>
}
