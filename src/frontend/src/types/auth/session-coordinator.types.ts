import type { AppError } from '../api/api.types'
import type { LoginRequestDto, LoginResult, RefreshRequestDto, RefreshResult } from './auth.types'
import type { SessionReadResult, StoredSession } from './session.types'
import type { CurrentUser } from '../users/user.types'

export type SessionUser =
  | { readonly source: 'login'; readonly value: Readonly<LoginResult['user']> }
  | { readonly source: 'profile'; readonly value: Readonly<CurrentUser> }

type SnapshotBase = {
  readonly generation: number
  readonly sessionEnded: boolean
  readonly error: Readonly<AppError> | null
  readonly cleanupError: Readonly<AppError> | null
}

export type SessionSnapshot = SnapshotBase & (
  | {
    readonly phase: 'bootstrapping' | 'anonymous' | 'signing-in' | 'signing-out'
    readonly accountId: null
    readonly expiresAtMs: null
    readonly user: null
  }
  | {
    readonly phase: 'checking-health' | 'awaiting-consent' | 'refreshing' | 'local-limited'
    readonly accountId: string
    readonly expiresAtMs: number
    readonly user: null
  }
  | {
    readonly phase: 'authenticated'
    readonly accountId: string
    readonly expiresAtMs: number
    readonly user: SessionUser
  }
)

type CallOptions = { signal?: AbortSignal }

export type SessionCoordinatorOptions = {
  storage: {
    read(): SessionReadResult
    write(session: StoredSession): void
    clear(): void
  }
  auth: {
    login(input: LoginRequestDto, options?: CallOptions): Promise<LoginResult>
    refresh(input: RefreshRequestDto, options?: CallOptions): Promise<RefreshResult>
  }
  health: { check(options?: CallOptions): Promise<{ available: boolean }> }
  // Trusted composition tạo service với token cố định; không cấp port này cho UI.
  bindSession(accessToken: string): {
    getMe(options?: CallOptions): Promise<CurrentUser>
    logout(options?: CallOptions): Promise<void>
  }
  // Synchronously invalidate old cache; async query completion vẫn phải check generation.
  clearSessionCache(): void
  now?: () => number
}

export type SignOutResult = {
  serverRevoked: boolean
  revokeError: Readonly<AppError> | null
  cleanupError: Readonly<AppError> | null
}
