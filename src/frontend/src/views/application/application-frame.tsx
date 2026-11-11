import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { parseManagementRoute } from '../../services/navigation/application-route'
import { previewNavigateEvent } from '../../services/preview/preview-route'
import { PreviewSessionProvider } from '../preview/preview-session'
import '../preview/preview.css'
import '../preview/preview-theme.css'

// One UI session owns theme and floating surfaces across both application areas.
// Moving between management and processing must not remount the theme provider.
export function ApplicationFrame() {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => { window.dispatchEvent(new Event(previewNavigateEvent)) }, [location.key])
  const management = parseManagementRoute(`${location.pathname}${location.search}`)
  const projectId = location.pathname.match(/^\/processing\/projects\/([^/]+)(?:\/|$)/)?.[1] ?? null
  const routeIds = management
    ? { ...management, workspaceId: management.section === 'projects' && !management.projectId
      ? management.workspaceId ?? '' : management.workspaceId }
    : { projectId }
  return <PreviewSessionProvider routeIds={routeIds} navigateSection={navigate}>
    <Outlet />
  </PreviewSessionProvider>
}
