import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../../hooks/auth/use-auth'

export const SessionStatus = () => {
  const { snapshot } = useAuth()
  return <main className="session-wait" aria-busy="true">
    <span className="loading-mark" aria-hidden="true" />
    <h1 id="page-heading" tabIndex={-1}>Đang kiểm tra phiên</h1>
    <p role="status">{snapshot.phase === 'checking-health' ? 'Đang kiểm tra kết nối dịch vụ…' : 'Vui lòng chờ trong giây lát.'}</p>
  </main>
}

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { snapshot } = useAuth()
  const location = useLocation()
  if (snapshot.phase === 'anonymous' || snapshot.phase === 'signing-in') {
    const state = snapshot.sessionEnded ? null : { returnTo: `${location.pathname}${location.search}${location.hash}` }
    return <Navigate to="/auth/login" replace state={state} />
  }
  if (snapshot.phase !== 'authenticated' && snapshot.phase !== 'local-limited') return <SessionStatus />
  return <>{children}</>
}
