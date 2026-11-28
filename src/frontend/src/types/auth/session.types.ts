export type StoredSession = {
  schemaVersion: 1
  accessToken: string
  refreshToken: string
  accountId: string
  /** Absolute backend refresh-session expiry (7 or 30 days), when supplied. */
  refreshExpiresAtMs?: number
  rememberMe?: boolean
}

export type AccessTokenInfo = {
  accountId: string
  expiresAtMs: number
  sessionId?: string
}

export type SessionReadResult =
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'valid' | 'expired'; session: StoredSession; expiresAtMs: number }

export type SessionStoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
