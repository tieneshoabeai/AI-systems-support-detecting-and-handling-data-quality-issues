import { createContext } from 'react'
import type { AppError } from '../../types/api/api.types'
import type { LoginRequestDto } from '../../types/auth/auth.types'
import type { SessionSnapshot, SignOutResult } from '../../types/auth/session-coordinator.types'

export type AuthContextValue = {
  snapshot: SessionSnapshot
  configurationError: Readonly<AppError> | null
  signIn(input: LoginRequestDto): Promise<void>
  signOut(): Promise<SignOutResult>
  confirmRenewal(accepted: boolean): Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
