import { lazy, Suspense, useEffect } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router'
import { useAuth } from '../../hooks/auth/use-auth'
import { ProtectedRoute, SessionStatus } from '../guards/protected-route'
import { PublicOnlyRoute } from '../guards/public-only-route'
import { LoginView } from '../../views/auth/login.view'
import { PageSkeleton } from '../../components/loading/page-skeleton'
import Layout from '../layout'

const Dataset3DView = lazy(async () => import('../../views/dataset-3d/dataset-3d.view').then(module => ({ default: module.Dataset3DView })))

const Entry = () => {
  const { snapshot } = useAuth()
  if (snapshot.phase === 'authenticated' || snapshot.phase === 'local-limited') return <Navigate to="/workspaces" replace />
  if (snapshot.phase === 'anonymous' || snapshot.phase === 'signing-in') return <Navigate to="/auth/login" replace />
  return <SessionStatus />
}

export const AppRouter = () => {
  const location = useLocation()
  useEffect(() => {
    document.getElementById('page-heading')?.focus()
  }, [location.pathname])
  return <Routes>
    <Route path="/" element={<Entry />} />
    <Route path="/auth/login" element={<PublicOnlyRoute><LoginView /></PublicOnlyRoute>} />
    <Route path="/workspaces" element={<ProtectedRoute><Layout /></ProtectedRoute>} />
    {/* TEMP: Bypass authentication only while the Dataset 3D visual is under review. Restore ProtectedRoute before release. */}
    <Route path="/workspaces/3d-dataset" element={<Suspense fallback={<PageSkeleton pathname={location.pathname} message="Đang tải Dataset 3D…" />}><Dataset3DView /></Suspense>} />
    <Route path="*" element={<main className="session-wait"><span className="eyebrow">404</span>
      <h1 id="page-heading" tabIndex={-1}>Không tìm thấy trang</h1>
      <Link className="text-link" to="/">Về trang bắt đầu <span aria-hidden="true">↗</span></Link>
    </main>} />
  </Routes>
}
