import type { StoredSession } from './session.types'

export type RefreshRequestDto = { refresh_token: string }

export type RefreshResult = {
  accessToken: string
  accountId: string
  expiresAtMs: number
}

export type LoginRequestDto = {
  email: string
  password: string
  device_name?: string
}

export type LoginResponseDto = {
  access_token: string
  refresh_token: string
  expires_in: number
  user: {
    id: string
    email: string
    first_name: string
    last_name: string
    role: 'admin' | 'analyst'
  }
}

export type LoginResult = {
  session: StoredSession
  expiresAtMs: number
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: LoginResponseDto['user']['role']
  }
}
