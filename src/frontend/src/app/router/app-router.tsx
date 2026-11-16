import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { useAuth } from '../../hooks/auth/use-auth'
import { ProtectedRoute, SessionStatus } from '../guards/protected-route'
import { PublicOnlyRoute } from '../guards/public-only-route'
import { LoginPage } from '../pages/public/login-page'
import { PageSkeleton } from '../../components/loading'
import { WorkspacePage } from '../pages/private'
import { WorkbenchRoutes } from './workbench-routes'
import { legacyManagementRedirect } from '../../services/preview/preview-route'
import { defaultAuthenticatedPath } from '../../services/navigation'
import { DATASET_3D_PATH, LOGIN_PATH, WORKSPACE_PATH } from '../constants'

const Dataset3DPage = lazy(() => import('../pages/private/dataset-3d-page').then(module => ({ default: module.Dataset3DPage })))

const Entry = () => {
  const { snapshot } = useAuth()
  const location = useLocation()
  const legacyDestination = legacyManagementRedirect(location.pathname, location.hash)
  if (legacyDestination) return <Navigate to={legacyDestination} replace />
  if (snapshot.phase === 'authenticated' || snapshot.phase === 'local-limited') return <Navigate to={defaultAuthenticatedPath} replace />
  if (snapshot.phase === 'anonymous' || snapshot.phase === 'signing-in') return <Navigate to={LOGIN_PATH} replace />
  return <SessionStatus />
}

export const AppRouter = () => {
  const location = useLocation()
  useEffect(() => {
    document.getElementById('page-heading')?.focus()
  }, [location.pathname])
  return <Routes>
    <Route path="/" element={<Entry />} />
    <Route path={LOGIN_PATH} element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
    <Route path={WORKSPACE_PATH} element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
    <Route path={DATASET_3D_PATH} element={<ProtectedRoute><Suspense fallback={<PageSkeleton pathname={location.pathname} message="Đang tải Dataset 3D…" />}><Dataset3DPage /></Suspense></ProtectedRoute>} />
    <Route path="/*" element={<WorkbenchRoutes />} />
  </Routes>
}
