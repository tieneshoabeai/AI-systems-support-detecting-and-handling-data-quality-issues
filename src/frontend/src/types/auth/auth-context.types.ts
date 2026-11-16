import type { AppError } from '../api'
import type { LoginRequestDto } from './auth.types'
import type { SessionSnapshot, SignOutResult } from './session-coordinator.types'

export type AuthContextValue = {
  snapshot: SessionSnapshot
  configurationError: Readonly<AppError> | null
  signIn(this: void, input: LoginRequestDto): Promise<void>
  signOut(this: void): Promise<SignOutResult>
  confirmRenewal(this: void, accepted: boolean): Promise<void>
}
