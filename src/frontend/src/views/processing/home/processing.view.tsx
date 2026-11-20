import { useContext, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { projectHref } from '../../../services/navigation/application-route'
import { PreviewShell } from '../../preview/components/preview-shell'
import { usePreviewStore } from '../../../hooks/preview/use-preview-store'
import { ManagementLoadingContext } from '../../../hooks/preview/management-loading-context'
import { DataRegionStatus } from '../../../components/loading/data-region-status'
import { ProjectWizard } from '../../../components/project/create'
import { UniverseHero } from '../../preview/components/universe-hero'
import { RecentProjects } from '../../preview/components/recent-projects'
import { PreviewIcon } from '../../preview/components/preview-icons'
import styles from './processing.module.css'

export function ProcessingView() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const source = usePreviewStore().source
  const loading = useContext(ManagementLoadingContext)
  const creating = pathname.replace(/\/$/, '') === '/processing/new'
  useEffect(() => {
    if (!creating) document.getElementById('page-heading')?.focus()
  }, [creating])
  return <PreviewShell active="home" area="processing" contentClassName={styles['screen'] ?? ''} context={<>
    <Link className="text-link" to="/management">Quản lý</Link>
    <span aria-hidden="true"> / </span>
    <Link className="text-link" to="/processing">AI Data Processing</Link>
  </>}>
    {creating ? <main className="processing-content">
      <h1 id="page-heading" tabIndex={-1}>Tạo Project mới</h1>
      {loading ? <section className="panel processing-panel">
        <DataRegionStatus status={loading} label="Đang tải danh sách Workspace">
          <p>Đang tải danh sách Workspace…</p>
        </DataRegionStatus>
        <Link className="text-link" to="/processing">Quay lại</Link>
      </section> : <ProjectWizard initialWorkspaceId={null} onClose={() => {
        void Promise.resolve(navigate('/processing', { replace: true })).catch(error => { reportError(error) })
      }} />}
    </main> : <main className="processing-landing">
      <UniverseHero headingId="page-heading" />
      <RecentProjects onOpenProject={id => { void Promise.resolve(navigate(projectHref(id))).catch(error => { reportError(error) }) }}
        action={<Link className="button-primary" to="/processing/new"><PreviewIcon name="plus" /> Tạo Project</Link>} />
      {source !== 'api' && <p className="action-note">Dữ liệu mẫu, chưa kết nối API. Chọn Project để làm việc với dữ liệu.</p>}
    </main>}
  </PreviewShell>
}
