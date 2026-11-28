import type { AppError } from '../api'
import type { LoginRequestDto } from './auth.types'
import type { SessionSnapshot, SignOutResult } from './session-coordinator.types'
import type { LocalDataPort } from '../offline'
import type { UploadDraftPort } from '../datasets'
import type { OfflineWritePort } from '../offline'
import type { ApiTargetManager } from '../../lib/api-target-manager'

export type AuthContextValue = {
  snapshot: SessionSnapshot
  configurationError: Readonly<AppError> | null
  localData?: LocalDataPort | null
  uploadDrafts?: UploadDraftPort | null
  offlineWrites?: OfflineWritePort | null
  apiTargetManager?: ApiTargetManager | null
  retryConnection?(this: void): Promise<void>
  signIn(this: void, input: LoginRequestDto): Promise<void>
  signOut(this: void): Promise<SignOutResult>
  deleteAccount?(this: void): Promise<void>
  confirmRenewal(this: void, accepted: boolean): Promise<void>
}
