import type { AppError } from '../api/api.types'
import type { LoginRequestDto } from './auth.types'
import type { SessionSnapshot, SignOutResult } from './session-coordinator.types'

export type AuthContextValue = {
  snapshot: SessionSnapshot
  configurationError: Readonly<AppError> | null
  signIn(input: LoginRequestDto): Promise<void>
  signOut(): Promise<SignOutResult>
  confirmRenewal(accepted: boolean): Promise<void>
}
