import type { StoredSession } from './session.types'

export type RefreshRequestDto = { refresh_token: string }

export type RefreshResult = {
  accessToken: string
  refreshToken: string
  accountId: string
  expiresAtMs: number
  refreshExpiresAtMs?: number
  rememberMe?: boolean
}

export type LoginRequestDto = {
  email: string
  password: string
  device_name?: string
  remember_me?: boolean
}

export type LoginResponseDto = {
  access_token: string
  refresh_token: string
  expires_in: number
  remember_me?: boolean
  expires_at?: string
  user: {
    id: string
    email: string
    role: 'admin' | 'analyst'
  }
}

export type LoginResult = {
  session: StoredSession
  expiresAtMs: number
  user: {
    id: string
    email: string
    role: LoginResponseDto['user']['role']
  }
}
