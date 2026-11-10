import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../../hooks/auth/use-auth'
import { PageSkeleton } from '../../components/loading/page-skeleton'

export const SessionStatus = () => {
  const { snapshot } = useAuth()
  const { pathname } = useLocation()
  const message = snapshot.phase === 'checking-health' ? 'Đang kiểm tra kết nối dịch vụ…' : 'Đang kiểm tra phiên'
  return <PageSkeleton pathname={pathname} message={message} />
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
