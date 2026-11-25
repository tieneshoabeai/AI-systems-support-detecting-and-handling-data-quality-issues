import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { parseManagementRoute, parseProjectRoute } from '../../services/navigation'
import { previewNavigateEvent } from '../../services/navigation/legacy-workbench-route'
import { usePreviewColorScheme } from '../../hooks/ui/use-workbench-color-scheme'
import { ManagementDataProvider, ProcessingDataProvider } from './management-data-provider'
import { PreviewSessionProvider } from './workbench-session'
import '../../styles/workbench/workbench.css'
import '../../styles/workbench/workbench-theme.css'

// The common frame is composed with the data scope of the active route.
export function ApplicationFrame() {
  const location = useLocation()
  const navigate = useNavigate()
  const appearance = usePreviewColorScheme()
  useEffect(() => { window.dispatchEvent(new Event(previewNavigateEvent)) }, [location.key])
  const management = parseManagementRoute(`${location.pathname}${location.search}`)
  const projectId = location.pathname.match(/^\/processing\/projects\/([^/]+)(?:\/|$)/)?.[1] ?? null
  const routeIds = management
    ? { ...management, workspaceId: management.section === 'projects' && !management.projectId
      ? management.workspaceId ?? '' : management.workspaceId }
    : { projectId }
  const frame = <PreviewSessionProvider routeIds={routeIds} appearance={appearance} navigateSection={path => { void Promise.resolve(navigate(path)).catch(error => { reportError(error) }) }}>
    <Outlet />
  </PreviewSessionProvider>
  const detailId = parseProjectRoute(location.pathname)
  if (/^\/processing\/?$/.test(location.pathname)) {
    return <ProcessingDataProvider>{frame}</ProcessingDataProvider>
  }
  return detailId
    ? <ProcessingDataProvider projectId={detailId}>{frame}</ProcessingDataProvider>
    : <ManagementDataProvider progressiveProjects={management?.section === 'projects' && !management.projectId}>{frame}</ManagementDataProvider>
}
