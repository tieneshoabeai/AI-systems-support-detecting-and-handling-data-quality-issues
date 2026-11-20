import { ApiError, isRecord } from '../../lib/api-error'
import type { ApiClient } from '../../types'
import type { CurrentUser } from '../../types'

export const createUsersService = (api: ApiClient) => ({
  async deleteMe(options: { signal?: AbortSignal } = {}): Promise<void> {
    await api.request({ path: '/users/me', method: 'DELETE', auth: 'session', ...options })
  },
  async getMe(options: { signal?: AbortSignal } = {}): Promise<CurrentUser> {
    const response = await api.request<unknown>({ path: '/users/me', auth: 'session', ...(options.signal === undefined ? {} : { signal: options.signal }) })
    // /users/me trả domain record camelCase, không phải document MongoDB.
    if (!isRecord(response)
      || typeof response['id'] !== 'string' || !response['id'].trim()
      || typeof response['email'] !== 'string' || !response['email'].trim()
      || typeof response['firstName'] !== 'string' || typeof response['lastName'] !== 'string'
      || (response['role'] !== 'admin' && response['role'] !== 'analyst')
      || (response['status'] !== 'active' && response['status'] !== 'blocked')
      || (response['avatarUrl'] !== undefined && response['avatarUrl'] !== null && typeof response['avatarUrl'] !== 'string')) {
      throw new ApiError({ kind: 'invalid-response', message: 'Phản hồi hồ sơ người dùng thiếu hoặc sai dữ liệu.' })
    }
    // Whitelist đầu ra: không đưa document/backend metadata vào UI/cache.
    return {
      id: response['id'], email: response['email'], firstName: response['firstName'],
      lastName: response['lastName'], role: response['role'], status: response['status'],
      avatarUrl: response['avatarUrl'] ?? null,
    }
  },
})
