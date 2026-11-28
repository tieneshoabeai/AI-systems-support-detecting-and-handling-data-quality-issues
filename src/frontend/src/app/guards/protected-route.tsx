import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../../hooks/auth/use-auth'
import { PageSkeleton } from '../../components/loading'
import { LOGIN_PATH } from '../constants'

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
    return <Navigate to={LOGIN_PATH} replace state={state} />
  }
  if (snapshot.accountId === null) return <SessionStatus />
  return <>{children}</>
}
