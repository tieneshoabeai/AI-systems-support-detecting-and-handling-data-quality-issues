import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { parseManagementRoute, parseProjectRoute } from '../../services/navigation'
import { previewNavigateEvent } from '../../services/preview/preview-route'
import { ManagementDataProvider, ProcessingDataProvider } from './management-data-provider'
import { PreviewSessionProvider } from '../preview/preview-session'
import { PreviewAppearanceProvider } from '../preview/preview-appearance-provider'
import '../preview/preview.css'
import '../preview/preview-theme.css'

// The common frame is composed with the data scope of the active route.
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
  const frame = <PreviewSessionProvider routeIds={routeIds} navigateSection={path => { void Promise.resolve(navigate(path)).catch(error => { reportError(error) }) }}>
    <Outlet />
  </PreviewSessionProvider>
  const detailId = parseProjectRoute(location.pathname)
  const scopedFrame = /^\/processing\/?$/.test(location.pathname)
    ? <ProcessingDataProvider>{frame}</ProcessingDataProvider>
    : detailId
    ? <ProcessingDataProvider projectId={detailId}>{frame}</ProcessingDataProvider>
    : <ManagementDataProvider progressiveProjects={management?.section === 'projects' && !management.projectId}>{frame}</ManagementDataProvider>
  // Data scopes can remount across areas; keep the in-memory theme above that boundary.
  return <PreviewAppearanceProvider>{scopedFrame}</PreviewAppearanceProvider>
}
