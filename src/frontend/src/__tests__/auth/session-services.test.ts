import { AxiosError, AxiosHeaders } from 'axios'
import type { AxiosAdapter } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { createAxiosClient } from '../../lib/axios-client'
import { createAuthService } from '../../services/auth/auth.service'
import { createUsersService } from '../../services/users/users.service'
import { createHealthService } from '../../services/health/health.service'

const token = `e30.${btoa(JSON.stringify({ sub: 'account-a', exp: 123.5 })).replace(/=/g, '')}.c2ln`
const profile = { _id: 'account-a', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'analyst', status: 'active', avatar_url: null }
const health = (status = 'connected') => ({ status: 'ok', services: { mongodb_atlas: { status }, neo4j_auradb: { status: 'disconnected' }, storage: { bucket: 'not-for-ui' } } })
const setup = (data: unknown, failure?: string | number) => {
  const readToken = vi.fn(() => 'test-access')
  const adapter = vi.fn<AxiosAdapter>(async config => {
    if (typeof failure === 'string') throw new AxiosError('private transport detail', failure)
    if (typeof failure === 'number') throw new AxiosError('private HTTP detail', undefined, config, undefined, {
      config, status: failure, statusText: 'Error', headers: new AxiosHeaders(), data: {},
    })
    return { config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { success: true, data } }
  })
  const api = createAxiosClient({ baseUrl: 'http://localhost:3000/api/v1', adapter, readToken })
  const auth = createAuthService(api)
  return { adapter, readToken, auth, users: createUsersService(api), health: createHealthService(api) }
}

describe('session service contracts', () => {
  it('maps users/me from _id and whitelists output fields', async () => {
    const s = setup({ ...profile, password_hash: 'must-not-escape', extra: true })
    const controller = new AbortController()
    expect(await s.users.getMe({ signal: controller.signal })).toEqual({ id: 'account-a', email: 'test@example.com', firstName: 'Test', lastName: 'User', role: 'analyst', status: 'active', avatarUrl: null })
    const config = s.adapter.mock.calls[0][0]
    expect(config.url).toBe('http://localhost:3000/api/v1/users/me')
    expect(config.method).toBe('get')
    expect(config.headers.get('Authorization')).toBe('Bearer test-access')
    expect(config.signal).toBe(controller.signal)
  })

  it.each([null, {}, { ...profile, _id: undefined, id: 'account-a' }, { ...profile, role: 'owner' }, { ...profile, status: 'unknown' }, { ...profile, avatar_url: 4 }, { ...profile, email: '' }, { ...profile, first_name: null }])('rejects malformed profiles', async data => {
    await expect(setup(data).users.getMe()).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it.each(['admin', 'analyst'])('accepts supported role %s and optional avatar', async role => {
    expect(await setup({ ...profile, role, status: 'blocked', avatar_url: undefined }).users.getMe()).toMatchObject({ role, status: 'blocked', avatarUrl: null })
    expect(await setup({ ...profile, avatar_url: '/avatar.png' }).users.getMe()).toMatchObject({ avatarUrl: '/avatar.png' })
  })

  it('checks health publicly within five seconds, ignoring Neo4j for auth availability', async () => {
    const s = setup(health())
    expect(await s.health.check()).toEqual({ available: true })
    const config = s.adapter.mock.calls[0][0]
    expect(config.url).toBe('http://localhost:3000/api/v1/health')
    expect(config.timeout).toBe(5000)
    expect(config.headers.get('Authorization')).toBeUndefined()
    expect(s.readToken).not.toHaveBeenCalled()
    expect(await setup(health('disconnected')).health.check()).toEqual({ available: false })
  })

  it.each([null, {}, { status: 'ok' }, health('unknown'), { ...health(), status: 'bad' }])('rejects malformed health instead of claiming availability', async data => {
    await expect(setup(data).health.check()).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('refreshes publicly, returns claims without persisting or inventing a refresh token', async () => {
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const s = setup({ access_token: token, expires_in: 900, refresh_token: 'unexpected-field' })
    const controller = new AbortController()
    expect(await s.auth.refresh({ refresh_token: 'test-refresh' }, { signal: controller.signal })).toEqual({ accessToken: token, accountId: 'account-a', expiresAtMs: 123500 })
    const config = s.adapter.mock.calls[0][0]
    expect(config.url).toBe('http://localhost:3000/api/v1/auth/refresh')
    expect(config.method).toBe('post')
    expect(JSON.parse(config.data)).toEqual({ refresh_token: 'test-refresh' })
    expect(config.signal).toBe(controller.signal)
    expect(config.headers.get('Authorization')).toBeUndefined()
    expect(s.readToken).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  })

  it.each([null, {}, { access_token: 'bad', expires_in: 900 }, { access_token: token, expires_in: 0 }, { access_token: token, expires_in: Infinity }, { access_token: token, expires_in: '900' }])('rejects malformed refresh responses', async data => {
    await expect(setup(data).auth.refresh({ refresh_token: 'test-refresh' })).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('rejects empty refresh input before transport', async () => {
    const s = setup({})
    await expect(s.auth.refresh({ refresh_token: '' })).rejects.toMatchObject({ kind: 'session' })
    expect(s.adapter).not.toHaveBeenCalled()
  })

  it('logs out with bearer and only acknowledges a valid response', async () => {
    const remove = vi.spyOn(Storage.prototype, 'removeItem')
    const s = setup({ message: 'Đăng xuất thành công' })
    await expect(s.auth.logout()).resolves.toBeUndefined()
    const config = s.adapter.mock.calls[0][0]
    expect(config.url).toBe('http://localhost:3000/api/v1/auth/logout')
    expect(config.method).toBe('post')
    expect(config.headers.get('Authorization')).toBe('Bearer test-access')
    expect(remove).not.toHaveBeenCalled()
    await expect(setup({ message: '' }).auth.logout()).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  const calls = [
    (s: ReturnType<typeof setup>, signal?: AbortSignal) => s.users.getMe({ signal }),
    (s: ReturnType<typeof setup>, signal?: AbortSignal) => s.health.check({ signal }),
    (s: ReturnType<typeof setup>, signal?: AbortSignal) => s.auth.refresh({ refresh_token: 'test-refresh' }, { signal }),
    (s: ReturnType<typeof setup>, signal?: AbortSignal) => s.auth.logout({ signal }),
  ]
  for (const [index, call] of calls.entries()) {
    it.each([401, 403, 500, 'ERR_NETWORK', 'ECONNABORTED'])(`preserves failure without retry for service ${index}: %s`, async failure => {
      const s = setup(null, failure)
      await expect(call(s)).rejects.toMatchObject(typeof failure === 'number' ? { kind: 'http', status: failure } : { kind: failure === 'ERR_NETWORK' ? 'network' : 'timeout' })
      expect(s.adapter).toHaveBeenCalledTimes(1)
    })
    it(`stops cancellation before transport for service ${index}`, async () => {
      const s = setup(null)
      const controller = new AbortController()
      controller.abort()
      await expect(call(s, controller.signal)).rejects.toMatchObject({ kind: 'cancelled' })
      expect(s.adapter).not.toHaveBeenCalled()
    })
  }
})
