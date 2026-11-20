import { useContext, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import type { PreviewRoute } from '../../types'
import { parseManagementRoute } from '../../services/navigation'
import { useManagementStore, usePreviewStore } from '../../hooks/preview/use-preview-store'
import { NotFoundView } from '../../components/navigation'
import { HomePreviewView } from './home-2d.view'
import { WorkspacesPreviewView } from './workspaces-2d.view'
import { ProjectsPreviewView } from './projects-2d.view'
import { NotificationsPreviewView } from './notifications-2d.view'
import { SettingsPreviewView } from './settings-2d.view'
import { ManagementLoadingContext, ManagementPersonalLoadingContext } from '../../hooks/preview/management-loading-context'
import { DataRegionStatus } from '../../components/loading/data-region-status'
import { Skeleton } from '../../components/ui/feedback/skeleton'
import { Panel } from '../../components/resource'
import { PreviewShell } from './components/preview-shell'
import { AdminApiPanel } from '../management/members/admin-api-panel'

const managementTitles: Partial<Record<PreviewRoute['section'], string>> = {
  home: 'Tổng quan', workspaces: 'Workspaces', projects: 'Dự án', notifications: 'Thông báo', settings: 'Cài đặt',
  members: 'Quản lý thành viên',
}

export function ManagementArea() {
  const location = useLocation()
  const route = parseManagementRoute(`${location.pathname}${location.search}`)
  const state = usePreviewStore()
  const { adminService } = useManagementStore()
  const coreStatus = useContext(ManagementLoadingContext)
  const personalStatus = useContext(ManagementPersonalLoadingContext)
  const needsPersonalData = route?.section === 'notifications' || route?.section === 'settings'
  const status = coreStatus ?? (needsPersonalData ? personalStatus : null)
  const ready = status === null
  useEffect(() => { document.getElementById('page-heading')?.focus() }, [location.pathname, ready])
  if (!route) return <NotFoundView />
  if (status) {
    const title = managementTitles[route.section] ?? 'Quản lý'
    const cardList = (route.section === 'workspaces' && !route.workspaceId) || route.section === 'projects'
    return <PreviewShell active={route.section}>
      <div className="page-head"><h1 id="page-heading" tabIndex={-1}>{title}</h1></div>
      <Panel title={route.workspaceId ? 'Chi tiết workspace' : route.notificationId ? 'Chi tiết thông báo' : title}>
        <DataRegionStatus status={status} label={`Đang tải ${title}`}>
          <div className={cardList ? 'card-grid' : undefined}>
            {[1, 2, 3].map(row => <Skeleton key={row} style={{ height: cardList ? '8rem' : '2rem', marginBlock: '0.75rem' }} />)}
          </div>
        </DataRegionStatus>
      </Panel>
    </PreviewShell>
  }
  if (route.section === 'members') {
    if (!adminService) return <NotFoundView title="Bạn không có quyền truy cập trang quản trị" />
    return <PreviewShell active="members">
      <div className="page-head"><h1 id="page-heading" tabIndex={-1}>Quản lý thành viên</h1></div>
      <AdminApiPanel />
    </PreviewShell>
  }
  if (route.workspaceId && !state.workspaces.some(item => item.id === route.workspaceId)) {
    return <NotFoundView title="Không tìm thấy workspace" />
  }
  if (route.projectId && !state.projects.some(item => item.id === route.projectId)) {
    return <NotFoundView title="Không tìm thấy project" />
  }
  return renderSection(route)
}

function renderSection(route: PreviewRoute): ReactNode {
  if (route.section === 'workspaces') return <WorkspacesPreviewView workspaceId={route.workspaceId} />
  if (route.section === 'projects') return <ProjectsPreviewView />
  if (route.section === 'notifications') return <NotificationsPreviewView notificationId={route.notificationId} />
  if (route.section === 'settings') return <SettingsPreviewView key={route.settingsSection ?? 'overview'} section={route.settingsSection} />
  return <HomePreviewView />
}
