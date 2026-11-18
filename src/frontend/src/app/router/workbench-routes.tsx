import { lazy, Suspense, useContext } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router'
import { PageSkeleton } from '../../components/loading'
import { NotFoundPage } from '../pages/public/not-found-page'
import { legacyManagementRedirect } from '../../services/preview/preview-route'
import { ProtectedRoute } from '../guards/protected-route'
import { managementHref } from '../../services/navigation'
import { usePreviewStore } from '../../hooks/preview/use-preview-store'
import { ProcessingDataContext } from '../../views/application/processing-data-context'

const ManagementPage = lazy(() => import('../pages/private/management-page').then(module => ({ default: module.ManagementPage })))
const ProcessingPage = lazy(() => import('../pages/private/processing-page').then(module => ({ default: module.ProcessingPage })))
const ApplicationFrame = lazy(() => import('../../views/application/application-frame').then(module => ({ default: module.ApplicationFrame })))
const ProjectWorkspacePage = lazy(() => import('../pages/private/project-workspace-page').then(module => ({ default: module.ProjectWorkspacePage })))
const ShoppingRecordsPage = lazy(() => import('../pages/private/shopping-records-page').then(module => ({ default: module.ShoppingRecordsPage })))

function ProcessingProject() {
  const { projectId } = useParams()
  const state = usePreviewStore()
  const processing = useContext(ProcessingDataContext)
  if (!projectId || (!processing && !state.projects.some(project => project.id === projectId))) {
    return <NotFoundPage title="Không tìm thấy project" />
  }
  return <Suspense key={projectId} fallback={<PageSkeleton pathname={`/processing/projects/${projectId}`} message="Đang mở scene 3D…" />}>
    <ProjectWorkspacePage projectId={projectId} />
  </Suspense>
}

function LegacyRedirect() {
  const location = useLocation()
  const destination = legacyManagementRedirect(location.pathname, location.hash)
  return destination ? <Navigate to={destination} replace /> : <NotFoundPage />
}

function ProjectStepRedirect() {
  const { projectId } = useParams()
  return projectId ? <Navigate to={managementHref('projects', { projectId })} replace /> : <NotFoundPage />
}

export function WorkbenchRoutes() {
  const location = useLocation()
  return <Suspense fallback={<PageSkeleton pathname={location.pathname} message="Đang mở trang…" />}>
    <Routes>
      <Route path="/preview/*" element={<LegacyRedirect />} />
      <Route path="/" element={<LegacyRedirect />} />
      <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
        <Route element={<ApplicationFrame />}>
          {['/management', '/management/workspaces', '/management/workspaces/:workspaceId',
            '/management/projects', '/management/notifications',
            '/management/notifications/:notificationId', '/management/settings', '/management/settings/:settingsSection']
            .map(path => <Route key={path} path={path} element={<ManagementPage />} />)}
          {['/processing', '/processing/new']
            .map(path => <Route key={path} path={path} element={<ProcessingPage />} />)}
          <Route path="/processing/projects/:projectId" element={<ProcessingProject />} />
          <Route path="/processing/projects/:projectId/records" element={<ShoppingRecordsPage />} />
          {['/processing/projects/:projectId/upload',
            '/processing/projects/:projectId/analysis', '/processing/projects/:projectId/review',
            '/processing/projects/:projectId/results']
            .map(path => <Route key={path} path={path} element={<ProjectStepRedirect />} />)}
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </Suspense>
}

// Standalone router composition still requires an AuthProvider from its caller.
export function WorkbenchEntry() {
  return <BrowserRouter><WorkbenchRoutes /></BrowserRouter>
}
