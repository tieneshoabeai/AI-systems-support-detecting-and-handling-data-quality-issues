import { ApiError, isRecord } from '../../lib/api-error'
import type { ApiClient } from '../../types/api/api.types'
import type { CurrentUser } from '../../types/users/user.types'

export const createUsersService = (api: ApiClient) => ({
  async getMe(options: { signal?: AbortSignal } = {}): Promise<CurrentUser> {
    const response = await api.request<unknown>({ path: '/users/me', auth: 'session', signal: options.signal })
    // /users/me trả document có _id, khác user.id của login.
    if (!isRecord(response)
      || typeof response._id !== 'string' || !response._id.trim()
      || typeof response.email !== 'string' || !response.email.trim()
      || typeof response.first_name !== 'string' || typeof response.last_name !== 'string'
      || (response.role !== 'admin' && response.role !== 'analyst')
      || (response.status !== 'active' && response.status !== 'blocked')
      || (response.avatar_url !== undefined && response.avatar_url !== null && typeof response.avatar_url !== 'string')) {
      throw new ApiError({ kind: 'invalid-response', message: 'Phản hồi hồ sơ người dùng thiếu hoặc sai dữ liệu.' })
    }
    // Whitelist đầu ra: không đưa document/backend metadata vào UI/cache.
    return {
      id: response._id, email: response.email, firstName: response.first_name,
      lastName: response.last_name, role: response.role, status: response.status,
      avatarUrl: response.avatar_url ?? null,
    }
  },
})
