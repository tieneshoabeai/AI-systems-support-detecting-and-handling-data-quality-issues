import { requireDefined } from '../../utils/required-value'
import { AxiosError, AxiosHeaders } from 'axios'
import type { AxiosAdapter } from 'axios'
import fixture from './auth.json'

const key = 'shopping-demo.auth-server'
type Session = { access: string; refresh: string }
const read = (): Session | null => {
  const raw = sessionStorage.getItem(key)
  return raw ? JSON.parse(raw) as Session : null
}
const issue = (): Session => {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const access = encode({ alg: 'none', demo: true }) + '.' + encode({
    sub: fixture.user.id, exp: Math.floor(Date.now() / 1000) + 900, jti: crypto.randomUUID(),
  }) + '.demo'
  const value = { access, refresh: crypto.randomUUID() }
  sessionStorage.setItem(key, JSON.stringify(value))
  return value
}
// All requests terminate here. A demo credential never leaves this adapter.
export const shoppingAuthAdapter: AxiosAdapter = async config => {
  const path = new URL(config.url!, config.baseURL).pathname.replace('/api/v1', '')
  const data = typeof config.data === 'string' ? JSON.parse(config.data) as Record<string, unknown> : config.data as Record<string, unknown> | undefined
  const response = (body: unknown, status = 200) => ({
    config, status, statusText: status === 200 ? 'OK' : 'Error', headers: new AxiosHeaders(),
    data: { success: status < 400, ...(status < 400 ? { data: body } : { error: { message: body, code: 'DEMO_ERROR' } }) },
  })
  const fail = (status: number, message: string): never => {
    throw new AxiosError(message, undefined, config, undefined, response(message, status))
  }
  if (path === '/health') return response({ status: 'ok', services: { mongodb_atlas: { status: 'connected' } } })
  if (path === '/auth/login') {
    if (data?.['email'] !== fixture.email || data?.['password'] !== fixture.password) fail(401, 'Email hoặc mật khẩu không chính xác')
    const s = issue()
    return response({ access_token: s.access, refresh_token: s.refresh, expires_in: 900,
      user: { id: fixture.user.id, email: fixture.email, role: fixture.user.role } })
  }
  if (path === '/auth/refresh') {
    if (!read() || data?.['refresh_token'] !== read()?.refresh) fail(401, 'Refresh token không hợp lệ')
    const s = issue()
    return response({ access_token: s.access, refresh_token: s.refresh, expires_in: 900 })
  }
  const session = read()
  if (!session || config.headers.get('Authorization') !== 'Bearer ' + session.access) fail(401, 'Phiên demo không hợp lệ')
  const payload = JSON.parse(atob(requireDefined(session!.access.split('.')[1], 'auth-adapter.ts:46').replace(/-/g, '+').replace(/_/g, '/'))) as { exp: number }
  if (payload.exp * 1000 <= Date.now()) fail(401, 'Access token đã hết hạn')
  if (path === '/users/me') return response(fixture.user)
  if (path === '/auth/logout') { sessionStorage.removeItem(key); return response({ message: 'Đã đăng xuất' }) }
  return fail(404, 'Chức năng API này chưa có trong demo')
}
