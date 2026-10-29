import type { StoredSession, SessionReadResult, SessionStoragePort } from '../types/auth/session.types'
import type { TokenReader } from '../types/api/api.types'
import { isAccessTokenExpired, readAccessToken } from '../utils/auth/access-token'
import { ApiError, isRecord } from './api-error'

export const SESSION_STORAGE_KEY = 'data-quality.auth.v1'

const validateSession = (value: unknown): { session: StoredSession; expiresAtMs: number } | null => {
  if (!isRecord(value) || value.schemaVersion !== 1
    || typeof value.accessToken !== 'string' || typeof value.refreshToken !== 'string'
    || value.refreshToken.trim().length === 0 || typeof value.accountId !== 'string') return null
  const info = readAccessToken(value.accessToken)
  if (!info || info.accountId !== value.accountId) return null
  // Chỉ giữ các trường đã duyệt, không lưu password/role hoặc trường lạ từ caller.
  return {
    session: {
      schemaVersion: 1, accessToken: value.accessToken,
      refreshToken: value.refreshToken, accountId: value.accountId,
    },
    expiresAtMs: info.expiresAtMs,
  }
}

type SessionStorageOptions = {
  getStorage?: () => SessionStoragePort
  now?: () => number
}

export const createSessionStorage = (options: SessionStorageOptions = {}) => {
  const getStorage = options.getStorage ?? (() => window.sessionStorage)
  const now = options.now ?? Date.now

  const withStorage = <T>(operation: (storage: SessionStoragePort) => T): T => {
    try {
      return operation(getStorage())
    } catch {
      // Không đính kèm raw error: có thể chứa dữ liệu credential.
      throw new ApiError({ kind: 'storage', message: 'Không thể đọc hoặc cập nhật phiên trong sessionStorage.' })
    }
  }

  const clear = (): void => withStorage(storage => storage.removeItem(SESSION_STORAGE_KEY))

  const read = (): SessionReadResult => {
    const raw = withStorage(storage => storage.getItem(SESSION_STORAGE_KEY))
    if (raw === null) return { status: 'empty' }
    let value: unknown
    try { value = JSON.parse(raw) } catch { value = null }
    const validated = validateSession(value)
    if (!validated) {
      clear()
      return { status: 'invalid' }
    }
    const { session, expiresAtMs } = validated
    return {
      status: isAccessTokenExpired({ accountId: session.accountId, expiresAtMs }, now()) ? 'expired' : 'valid',
      session, expiresAtMs,
    }
  }

  const write = (value: StoredSession): void => {
    const validated = validateSession(value)
    if (!validated) throw new ApiError({ kind: 'session', message: 'Dữ liệu phiên đăng nhập không hợp lệ.' })
    withStorage(storage => storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(validated.session)))
  }

  const readToken: TokenReader = () => {
    const result = read()
    return result.status === 'valid' ? result.session.accessToken : null
  }

  return { read, write, clear, readToken }
}
