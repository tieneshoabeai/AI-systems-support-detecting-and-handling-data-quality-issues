export type StoredSession = {
  schemaVersion: 1
  accessToken: string
  refreshToken: string
  accountId: string
}

export type AccessTokenInfo = {
  accountId: string
  expiresAtMs: number
}

export type SessionReadResult =
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'valid' | 'expired'; session: StoredSession; expiresAtMs: number }

export type SessionStoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
