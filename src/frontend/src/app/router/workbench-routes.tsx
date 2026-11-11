import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router'
import { PageSkeleton } from '../../components/loading/page-skeleton'
import { NotFoundView } from '../../components/navigation/not-found'
import { legacyManagementRedirect } from '../../services/preview/preview-route'
import { ProtectedRoute } from '../guards/protected-route'
import { managementHref } from '../../services/navigation/application-route'
import { usePreviewStore } from '../../hooks/preview/use-preview-store'

const ManagementArea = lazy(() => import('../../views/preview/preview-entry').then(module => ({ default: module.ManagementArea })))
const ProcessingView = lazy(() => import('../../views/processing/processing.view').then(module => ({ default: module.ProcessingView })))
const ApplicationFrame = lazy(() => import('../../views/application/application-frame').then(module => ({ default: module.ApplicationFrame })))
const ProjectWorkspaceView = lazy(() => import('../../views/preview/project-workspace-2d.view').then(module => ({ default: module.ProjectWorkspaceView })))

function ProcessingProject() {
  const { projectId } = useParams()
  const state = usePreviewStore()
  return projectId && state.projects.some(project => project.id === projectId)
    ? <ProjectWorkspaceView key={projectId} projectId={projectId} /> : <NotFoundView title="Không tìm thấy project" />
}

function LegacyRedirect() {
  const location = useLocation()
  const destination = legacyManagementRedirect(location.pathname, location.hash)
  return destination ? <Navigate to={destination} replace /> : <NotFoundView />
}

function ProjectStepRedirect() {
  const { projectId } = useParams()
  return projectId ? <Navigate to={managementHref('projects', { projectId })} replace /> : <NotFoundView />
}

export function WorkbenchRoutes({ protect = true }: { protect?: boolean }) {
  const location = useLocation()
  return <Suspense fallback={<PageSkeleton pathname={location.pathname} message="Đang mở trang…" />}>
    <Routes>
      <Route path="/preview/*" element={<LegacyRedirect />} />
      <Route path="/" element={<LegacyRedirect />} />
      <Route element={protect ? <ProtectedRoute><Outlet /></ProtectedRoute> : <Outlet />}>
        <Route element={<ApplicationFrame />}>
          {['/management', '/management/workspaces', '/management/workspaces/:workspaceId',
            '/management/projects', '/management/notifications',
            '/management/notifications/:notificationId', '/management/settings', '/management/settings/:settingsSection']
            .map(path => <Route key={path} path={path} element={<ManagementArea />} />)}
          {['/processing', '/processing/new']
            .map(path => <Route key={path} path={path} element={<ProcessingView />} />)}
          <Route path="/processing/projects/:projectId" element={<ProcessingProject />} />
          {['/processing/projects/:projectId/upload',
            '/processing/projects/:projectId/analysis', '/processing/projects/:projectId/review',
            '/processing/projects/:projectId/results']
            .map(path => <Route key={path} path={path} element={<ProjectStepRedirect />} />)}
        </Route>
      </Route>
      <Route path="*" element={<NotFoundView />} />
    </Routes>
  </Suspense>
}

// Local UI review remains available without an API session in development only.
// Production mounts the same routes with protect=true through AppRouter.
export function WorkbenchEntry() {
  return <BrowserRouter><WorkbenchRoutes protect={false} /></BrowserRouter>
}
