import { ApiError, isRecord } from '../../lib/api-error'
import type { ApiClient } from '../../types'
import type { LoginRequestDto, LoginResponseDto, LoginResult, RefreshRequestDto, RefreshResult } from '../../types'
import { readAccessToken } from '../../utils'

const isNonemptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0
}

const isLoginResponse = (value: unknown): value is LoginResponseDto => {
  if (!isRecord(value) || !isRecord(value['user'])) return false
  const user = value['user']
  return isNonemptyString(value['access_token'])
    && isNonemptyString(value['refresh_token'])
    && typeof value['expires_in'] === 'number'
    && Number.isFinite(value['expires_in']) && value['expires_in'] > 0
    && (value['remember_me'] === undefined || typeof value['remember_me'] === 'boolean')
    && (value['expires_at'] === undefined || (typeof value['expires_at'] === 'string' && Number.isFinite(Date.parse(value['expires_at']))))
    && isNonemptyString(user['id']) && isNonemptyString(user['email'])
    && (user['role'] === 'admin' || user['role'] === 'analyst')
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
      ...(value.expires_at === undefined ? {} : { refreshExpiresAtMs: Date.parse(value.expires_at) }),
      ...(value.remember_me === undefined ? {} : { rememberMe: value.remember_me }),
    },
    expiresAtMs: info.expiresAtMs,
    user: {
      id: value.user.id, email: value.user.email,
      role: value.user.role,
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
      data: { refresh_token: input.refresh_token }, ...(options.signal === undefined ? {} : { signal: options.signal }),
    })
    const invalidResponse = () => new ApiError({ kind: 'invalid-response', message: 'Phản hồi gia hạn thiếu hoặc sai dữ liệu phiên.' })
    if (!isRecord(response) || !isNonemptyString(response['access_token'])
      || !isNonemptyString(response['refresh_token'])
      || typeof response['expires_in'] !== 'number' || !Number.isFinite(response['expires_in'])
      || response['expires_in'] <= 0
      || (response['remember_me'] !== undefined && typeof response['remember_me'] !== 'boolean')
      || (response['expires_at'] !== undefined && (typeof response['expires_at'] !== 'string' || !Number.isFinite(Date.parse(response['expires_at']))))) throw invalidResponse()
    const info = readAccessToken(response['access_token'])
    if (!info) throw invalidResponse()
    // Coordinator kiểm tra hạn, account và phiên hiện tại trước khi ghi.
    // Backend rotate refresh token; trả cả hai để coordinator lưu cùng một phiên.
    return { accessToken: response['access_token'], refreshToken: response['refresh_token'],
      accountId: info.accountId, expiresAtMs: info.expiresAtMs,
      ...(typeof response['expires_at'] === 'string' ? { refreshExpiresAtMs: Date.parse(response['expires_at']) } : {}),
      ...(typeof response['remember_me'] === 'boolean' ? { rememberMe: response['remember_me'] } : {}) }
  },

  async logout(options: { signal?: AbortSignal } = {}): Promise<void> {
    const response = await api.request<unknown>({
      path: '/auth/logout', method: 'POST', auth: 'session', ...(options.signal === undefined ? {} : { signal: options.signal }),
    })
    if (!isRecord(response) || !isNonemptyString(response['message'])) {
      throw new ApiError({ kind: 'invalid-response', message: 'Phản hồi đăng xuất không hợp lệ.' })
    }
    // Chỉ xác nhận response server; dọn credential/cache thuộc coordinator.
  },

  async login(input: LoginRequestDto, options: { signal?: AbortSignal } = {}): Promise<LoginResult> {
    // Chọn đúng field DTO; không gửi field lạ, không sửa/trim password.
    const data: LoginRequestDto = { email: input.email, password: input.password }
    if (input.device_name !== undefined) data.device_name = input.device_name
    if (input.remember_me !== undefined) data.remember_me = input.remember_me

    const response = await api.request<unknown>({
      path: '/auth/login', method: 'POST', auth: 'public', data, ...(options.signal === undefined ? {} : { signal: options.signal }),
    })
    // Client đã unwrap envelope đúng một lần. Service kiểm tra DTO cụ thể.
    const result = mapLoginResponse(response)
    if (result.session.rememberMe === undefined && input.remember_me !== undefined) {
      return { ...result, session: { ...result.session, rememberMe: input.remember_me } }
    }
    return result
  },
})
