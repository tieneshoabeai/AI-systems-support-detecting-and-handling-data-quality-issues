import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { PreviewShell } from '../../preview/components/preview-shell'
import { usePreviewStore } from '../../../hooks/preview/use-preview-store'
import { UniverseHero } from '../../preview/components/universe-hero'
import { RecentProjects } from '../../preview/components/recent-projects'
import { PreviewIcon } from '../../preview/components/preview-icons'
import { ProjectWizard } from '../../../components/project/create/project-wizard'
import styles from './processing.module.css'

export function ProcessingView() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { source, workspaces } = usePreviewStore()
  const creating = pathname.replace(/\/$/, '') === '/processing/new'
  const canCreate = workspaces.some(workspace => workspace.canManage !== false)
  useEffect(() => { document.getElementById('page-heading')?.focus() }, [pathname])
  return <PreviewShell active="home" area="processing" contentClassName={styles['screen'] ?? ''} context={<>
    <Link className="text-link" to="/management">Quản lý</Link>
    <span aria-hidden="true"> / </span>
    <Link className="text-link" to="/processing">AI Data Processing</Link>
  </>}>
    {creating ? <main className="processing-content">
      <h1 id="page-heading" tabIndex={-1}>Tạo Project mới</h1>
      {canCreate
        ? <ProjectWizard initialWorkspaceId={null} onClose={() => { void navigate('/processing', { replace: true }) }} />
        : <p>Bạn cần sở hữu một Workspace để tạo Project.</p>}
      <Link className="text-link" to="/processing">Quay lại</Link>
    </main> : <main className="processing-landing">
      <UniverseHero headingId="page-heading" />
      <RecentProjects action={<Link className="button-primary" to="/processing/new"><PreviewIcon name="plus" /> Tạo Project</Link>} />
      {source !== 'api' && <p className="action-note">Dữ liệu mẫu, chưa kết nối API. Chọn Project để làm việc với dữ liệu.</p>}
    </main>}
  </PreviewShell>
}
