import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../../hooks/auth/use-auth'
import { validReturnTarget } from '../router/return-target'
import { SessionStatus } from './protected-route'

export const PublicOnlyRoute = ({ children }: { children: ReactNode }) => {
  const { snapshot } = useAuth()
  const location = useLocation()
  if (snapshot.phase === 'authenticated' || snapshot.phase === 'local-limited') {
    return <Navigate to={validReturnTarget(location.state?.returnTo)} replace state={null} />
  }
  if (snapshot.phase !== 'anonymous' && snapshot.phase !== 'signing-in') return <SessionStatus />
  if (snapshot.sessionEnded && location.state) return <Navigate to="/auth/login" replace state={null} />
  return <>{children}</>
}
