import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../../hooks/auth/use-auth'
import { validReturnTarget } from '../router/return-target'
import { SessionStatus } from './protected-route'
import { isRecord } from '../../lib/api-error'
import { LOGIN_PATH } from '../constants'

export const PublicOnlyRoute = ({ children }: { children: ReactNode }) => {
  const { snapshot } = useAuth()
  const location = useLocation()
  const state: unknown = location.state
  if (snapshot.phase === 'authenticated' || snapshot.phase === 'local-limited') {
    return <Navigate to={validReturnTarget(isRecord(state) ? state['returnTo'] : undefined)} replace state={null} />
  }
  if (snapshot.phase !== 'anonymous' && snapshot.phase !== 'signing-in') return <SessionStatus />
  if (snapshot.sessionEnded && location.state) return <Navigate to={LOGIN_PATH} replace state={null} />
  return <>{children}</>
}
