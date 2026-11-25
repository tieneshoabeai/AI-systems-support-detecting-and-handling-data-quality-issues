import type { AppError } from '../api'
import type { LoginRequestDto } from './auth.types'
import type { SessionSnapshot, SignOutResult } from './session-coordinator.types'
import type { LocalDataServices } from '../offline/offline.types'

export type AuthContextValue = {
  snapshot: SessionSnapshot
  configurationError: Readonly<AppError> | null
  localData?: LocalDataServices
  signIn(this: void, input: LoginRequestDto): Promise<void>
  signOut(this: void): Promise<SignOutResult>
  deleteAccount?(this: void): Promise<void>
  confirmRenewal(this: void, accepted: boolean): Promise<void>
}
