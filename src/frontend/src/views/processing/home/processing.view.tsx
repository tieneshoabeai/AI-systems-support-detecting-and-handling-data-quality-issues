import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { projectHref } from '../../../services/navigation/application-route'
import { PreviewShell } from '../../application/components/workbench-shell'
import { usePreviewStore } from '../../../hooks/management/use-management-store'
import { ManagementLoadingContext } from '../../../hooks/management/management-loading-context'
import { DataRegionStatus } from '../../../components/loading/data-region-status'
import { Skeleton } from '../../../components/ui/feedback/skeleton'
import { Dialog } from '../../../components/ui/overlay/dialog'
import { ProjectWizard } from '../../../components/project/create'
import { UniverseHero } from '../../../components/project/list/universe-hero'
import { RecentProjects } from '../../../components/project/list/recent-projects'
import { Icon as PreviewIcon } from '../../../components/ui/primitives/icon'
import { usePreviewSession } from '../../../hooks/workbench/workbench-session-context'
import { ManagementDataProvider } from '../../application/management-data-provider'
import { PreviewSessionProvider } from '../../application/workbench-session'
import styles from './processing.module.css'

export function ProcessingView() {
  const routeState: unknown = useLocation().state
  const navigate = useNavigate()
  const { appearance } = usePreviewSession()
  const source = usePreviewStore().source
  const [isCreateOpen, setIsCreateOpen] = useState(() =>
    typeof routeState === 'object' && routeState !== null &&
    'openProjectWizard' in routeState && routeState.openProjectWizard === true)
  const [recentVersion, setRecentVersion] = useState(0)
  const projectCreated = useRef(false)
  const createButton = useRef<HTMLButtonElement>(null)
  const restoreCreateFocus = useRef(false)
  const closeCreate = useCallback(() => {
    if (projectCreated.current) {
      projectCreated.current = false
      setRecentVersion(version => version + 1)
    }
    restoreCreateFocus.current = true
    setIsCreateOpen(false)
  }, [])
  const markProjectCreated = useCallback(() => { projectCreated.current = true }, [])
  useEffect(() => {
    if (isCreateOpen) return
    if (restoreCreateFocus.current) {
      restoreCreateFocus.current = false
      createButton.current?.focus()
    } else {
      document.getElementById('page-heading')?.focus()
    }
  }, [isCreateOpen])
  return <PreviewShell active="home" area="processing" context={<>
    <Link className="text-link" to="/management">Quản lý</Link>
    <span aria-hidden="true"> / </span>
    <Link className="text-link" to="/processing">AI Data Processing</Link>
  </>}>
    <main className="processing-landing">
      <UniverseHero headingId="page-heading" />
      <RecentProjects key={recentVersion} onOpenProject={id => { void Promise.resolve(navigate(projectHref(id))).catch(error => { reportError(error) }) }}
        action={<button ref={createButton} type="button" className="button-primary" aria-haspopup="dialog"
          onClick={() => setIsCreateOpen(true)}><PreviewIcon name="plus" /> Tạo Project</button>} />
      {source !== 'api' && <p className="action-note">Dữ liệu mẫu, chưa kết nối API. Chọn Project để làm việc với dữ liệu.</p>}
    </main>
    {isCreateOpen && <ManagementDataProvider>
      <PreviewSessionProvider appearance={appearance} routeIds={{}}
        navigateSection={path => { void Promise.resolve(navigate(path)).catch(error => { reportError(error) }) }}>
        <ProcessingProjectCreation onClose={closeCreate} onCreated={markProjectCreated} />
      </PreviewSessionProvider>
    </ManagementDataProvider>}
  </PreviewShell>
}

function ProcessingProjectCreation({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const status = useContext(ManagementLoadingContext)
  if (!status) return <ProjectWizard initialWorkspaceId={null} onClose={onClose} onCreated={onCreated} />

  return <Dialog open onClose={onClose} className="is-wide" aria-labelledby="processing-create-title">
    <header className="dialog-head">
      <span className="dialog-head-icon" aria-hidden="true"><PreviewIcon name="projects" /></span>
      <div className="dialog-head-text"><h2 id="processing-create-title">Tạo Project</h2></div>
      <button type="button" className="icon-button dialog-close" aria-label="Đóng hộp thoại" onClick={onClose}>
        <PreviewIcon name="close" />
      </button>
    </header>
    <div className="pv-wizard-body">
      <DataRegionStatus status={status} label="Đang tải danh sách Workspace">
        <div className={styles['wizardSkeleton']} aria-hidden="true">
          <div className={styles['skeletonSteps']}>
            {[1, 2, 3, 4].map(step => <Skeleton key={step} />)}
          </div>
          <Skeleton className={styles['skeletonWorkspace']} />
          <Skeleton />
          <Skeleton className={styles['skeletonDescription']} />
        </div>
      </DataRegionStatus>
    </div>
    <footer className="dialog-actions">
      <button type="button" className="button-secondary" onClick={onClose}>Hủy</button>
    </footer>
  </Dialog>
}
