import type { AccessTokenInfo } from '../../types/auth/session.types'

// Chỉ đọc claim để điều phối FE; không xác minh chữ ký JWT hoặc quyền truy cập.
export const readAccessToken = (token: string): AccessTokenInfo | null => {
  const parts = token.split('.')
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    const claims: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (typeof claims !== 'object' || claims === null || Array.isArray(claims)) return null
    const { sub, exp } = claims as Record<string, unknown>
    if (typeof sub !== 'string' || sub.trim().length === 0
      || typeof exp !== 'number' || !Number.isFinite(exp)) return null
    const expiresAtMs = exp * 1000
    if (!Number.isFinite(expiresAtMs) || !Number.isFinite(new Date(expiresAtMs).getTime())) return null
    return { accountId: sub, expiresAtMs }
  } catch {
    return null
  }
}

export const isAccessTokenExpired = (info: AccessTokenInfo, nowMs: number): boolean => {
  return !Number.isFinite(nowMs) || nowMs >= info.expiresAtMs
}
