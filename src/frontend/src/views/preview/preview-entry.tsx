import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import type { PreviewRoute } from '../../types/preview/preview-route.types'
import { parseManagementRoute } from '../../services/navigation/application-route'
import { usePreviewStore } from '../../hooks/preview/use-preview-store'
import { NotFoundView } from '../../components/navigation/not-found'
import { HomePreviewView } from './home-2d.view'
import { WorkspacesPreviewView } from './workspaces-2d.view'
import { ProjectsPreviewView } from './projects-2d.view'
import { NotificationsPreviewView } from './notifications-2d.view'
import { SettingsPreviewView } from './settings-2d.view'

// Existing screens share one UI session; React Router owns their navigation.
// Management still uses sample data until its services are connected to the API.
export function ManagementArea() {
  const location = useLocation()
  const route = parseManagementRoute(`${location.pathname}${location.search}`)
  const state = usePreviewStore()
  useEffect(() => { document.getElementById('page-heading')?.focus() }, [location.pathname])
  if (!route) return <NotFoundView />
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
