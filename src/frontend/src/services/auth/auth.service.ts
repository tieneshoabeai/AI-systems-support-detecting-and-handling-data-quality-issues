import { ApiError, isRecord } from '../../lib/api-error'
import type { ApiClient } from '../../types/api/api.types'
import type { LoginRequestDto, LoginResponseDto, LoginResult, RefreshRequestDto, RefreshResult } from '../../types/auth/auth.types'
import { readAccessToken } from '../../utils/auth/access-token'

const isNonemptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0
}

const isLoginResponse = (value: unknown): value is LoginResponseDto => {
  if (!isRecord(value) || !isRecord(value.user)) return false
  const user = value.user
  return isNonemptyString(value.access_token)
    && isNonemptyString(value.refresh_token)
    && typeof value.expires_in === 'number'
    && Number.isFinite(value.expires_in) && value.expires_in > 0
    && isNonemptyString(user.id) && isNonemptyString(user.email)
    && typeof user.first_name === 'string' && typeof user.last_name === 'string'
    && (user.role === 'admin' || user.role === 'analyst')
}

const mapLoginResponse = (value: unknown): LoginResult => {
  const invalidResponse = () => new ApiError({
    kind: 'invalid-response', message: 'Phản hồi đăng nhập thiếu hoặc sai dữ liệu phiên.',
  })
  if (!isLoginResponse(value)) throw invalidResponse()

  const info = readAccessToken(value.access_token)
  if (!info || info.accountId !== value.user.id) throw invalidResponse()

  // exp chỉ phục vụ điều phối FE; backend vẫn xác minh chữ ký và quyền.
  // Không lấy expires_in để cộng một hạn mới khi response tới chậm.
  return {
    session: {
      schemaVersion: 1, accessToken: value.access_token,
      refreshToken: value.refresh_token, accountId: value.user.id,
    },
    expiresAtMs: info.expiresAtMs,
    user: {
      id: value.user.id, email: value.user.email,
      firstName: value.user.first_name, lastName: value.user.last_name, role: value.user.role,
    },
  }
}

export const createAuthService = (api: ApiClient) => ({
  async refresh(input: RefreshRequestDto, options: { signal?: AbortSignal } = {}): Promise<RefreshResult> {
    if (!isNonemptyString(input.refresh_token)) {
      throw new ApiError({ kind: 'session', message: 'Thiếu refresh token của phiên đăng nhập.' })
    }
    const response = await api.request<unknown>({
      path: '/auth/refresh', method: 'POST', auth: 'public',
      data: { refresh_token: input.refresh_token }, signal: options.signal,
    })
    const invalidResponse = () => new ApiError({ kind: 'invalid-response', message: 'Phản hồi gia hạn thiếu hoặc sai dữ liệu phiên.' })
    if (!isRecord(response) || typeof response.access_token !== 'string'
      || typeof response.expires_in !== 'number' || !Number.isFinite(response.expires_in)
      || response.expires_in <= 0) throw invalidResponse()
    const info = readAccessToken(response.access_token)
    if (!info) throw invalidResponse()
    // Coordinator kiểm tra hạn, account và phiên hiện tại trước khi ghi.
    // Backend không rotate refresh token; service không tự tạo/lưu phiên.
    return { accessToken: response.access_token, accountId: info.accountId, expiresAtMs: info.expiresAtMs }
  },

  async logout(options: { signal?: AbortSignal } = {}): Promise<void> {
    const response = await api.request<unknown>({
      path: '/auth/logout', method: 'POST', auth: 'session', signal: options.signal,
    })
    if (!isRecord(response) || !isNonemptyString(response.message)) {
      throw new ApiError({ kind: 'invalid-response', message: 'Phản hồi đăng xuất không hợp lệ.' })
    }
    // Chỉ xác nhận response server; dọn credential/cache thuộc coordinator.
  },

  async login(input: LoginRequestDto, options: { signal?: AbortSignal } = {}): Promise<LoginResult> {
    // Chọn đúng field DTO; không gửi field lạ, không sửa/trim password.
    const data: LoginRequestDto = { email: input.email, password: input.password }
    if (input.device_name !== undefined) data.device_name = input.device_name

    const response = await api.request<unknown>({
      path: '/auth/login', method: 'POST', auth: 'public', data, signal: options.signal,
    })
    // Client đã unwrap envelope đúng một lần. Service kiểm tra DTO cụ thể.
    return mapLoginResponse(response)
  },
})
