import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { parseManagementRoute } from '../../services/navigation'
import { previewNavigateEvent } from '../../services/preview/preview-route'
import { ManagementDataProvider } from './management-data-provider'
import { PreviewSessionProvider } from '../preview/preview-session'
import '../preview/preview.css'
import '../preview/preview-theme.css'

// Chế độ xem thử giữ fixture như trước khi nối API: dev + VITE_MANAGEMENT_DATA_MODE=mock, và bộ
// test (Vite mode "test", cũng là fixture). Thiếu nhánh này thì không có BE, ManagementDataProvider
// chỉ dừng ở "Cần phiên đăng nhập trực tuyến" và mọi màn quản lý thành trắng. Production và dev
// mặc định (api) vẫn nhận store thật từ provider.
const usesFixtureStore = import.meta.env.MODE === 'test'
  || (import.meta.env.DEV && import.meta.env.VITE_MANAGEMENT_DATA_MODE === 'mock')

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
  const frame = <PreviewSessionProvider routeIds={routeIds} navigateSection={path => { void Promise.resolve(navigate(path)).catch(error => { reportError(error) }) }}>
    <Outlet />
  </PreviewSessionProvider>
  return usesFixtureStore ? frame : <ManagementDataProvider>{frame}</ManagementDataProvider>
}
