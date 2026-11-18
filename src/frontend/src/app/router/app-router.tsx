import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { useAuth } from '../../hooks/auth/use-auth'
import { SessionStatus } from '../guards/protected-route'
import { PublicOnlyRoute } from '../guards/public-only-route'
import { LoginPage } from '../pages/public/login-page'
import { WorkbenchRoutes } from './workbench-routes'
import { legacyManagementRedirect } from '../../services/preview/preview-route'
import { defaultAuthenticatedPath } from '../../services/navigation'
import { LOGIN_PATH } from '../constants'

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
    <Route path="/*" element={<WorkbenchRoutes />} />
  </Routes>
}
