import { ApiError, isRecord } from '../../lib/api-error'
import type { SessionDetail } from './management.types'

// Auth presentation handlers serialize session fields as snake_case.
export function mapSessionDetail(value: unknown): SessionDetail {
  const invalid = () => new ApiError({ kind: 'invalid-response', message: 'Thông tin phiên từ máy chủ không hợp lệ.' })
  if (!isRecord(value) || typeof value['id'] !== 'string' || !value['id'].trim()
    || typeof value['is_revoked'] !== 'boolean' || typeof value['remember_me'] !== 'boolean') throw invalid()
  const nullableText = (key: string): string | null => {
    const field = value[key]
    if (field === null || typeof field === 'string') return field
    throw invalid()
  }
  const date = (key: string, nullable: boolean): string | null => {
    const field = nullableText(key)
    if (field === null ? !nullable : !Number.isFinite(Date.parse(field))) throw invalid()
    return field
  }
  return {
    id: value['id'], deviceName: nullableText('device_name'), ipAddress: nullableText('ip_address'),
    userAgent: nullableText('user_agent'), isRevoked: value['is_revoked'], rememberMe: value['remember_me'],
    lastUsedAt: date('last_used_at', true), expiresAt: date('expires_at', false), createdAt: date('created_at', true),
  }
}
