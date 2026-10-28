import { AxiosError, AxiosHeaders } from 'axios'
import type { AxiosAdapter } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { createAxiosClient } from '../../lib/axios-client'
import { createAuthService } from '../../services/auth/auth.service'

const accessToken = (sub = 'account-a', exp = 100) => {
  return `e30.${btoa(JSON.stringify({ sub, exp })).replace(/=/g, '')}.c2ln`
}
const fixture = () => ({
  access_token: accessToken(), refresh_token: 'test-refresh', expires_in: 900,
  user: { id: 'account-a', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'analyst' },
})
const setup = (data: unknown) => {
  const readToken = vi.fn(() => 'old-token')
  const adapter = vi.fn<AxiosAdapter>(async config => ({
    config, status: 200, statusText: 'OK', headers: new AxiosHeaders(),
    data: { success: true, data },
  }))
  const api = createAxiosClient({ baseUrl: 'http://localhost:3000/api/v1', readToken, adapter })
  return { service: createAuthService(api), adapter, readToken }
}

describe('auth login service', () => {
  it('sends a public POST, preserves password and maps the checked response', async () => {
    const { service, adapter, readToken } = setup(fixture())
    const result = await service.login({ email: 'test@example.com', password: ' x ' })
    const config = adapter.mock.calls[0][0]
    expect(config.url).toBe('http://localhost:3000/api/v1/auth/login')
    expect(config.method).toBe('post')
    expect(JSON.parse(config.data)).toEqual({ email: 'test@example.com', password: ' x ' })
    expect(readToken).not.toHaveBeenCalled()
    expect(config.headers.get('Authorization')).toBeUndefined()
    expect(result).toEqual({
      session: { schemaVersion: 1, accessToken: accessToken(), refreshToken: 'test-refresh', accountId: 'account-a' },
      expiresAtMs: 100_000,
      user: { id: 'account-a', email: 'test@example.com', firstName: 'Test', lastName: 'User', role: 'analyst' },
    })
  })

  it('forwards optional device_name and cancellation signal', async () => {
    const { service, adapter } = setup(fixture())
    const controller = new AbortController()
    await service.login({ email: 'test@example.com', password: 'x', device_name: 'Test Browser' }, { signal: controller.signal })
    expect(JSON.parse(adapter.mock.calls[0][0].data).device_name).toBe('Test Browser')
    expect(adapter.mock.calls[0][0].signal).toBe(controller.signal)
  })

  it.each(['admin', 'analyst'])('accepts backend role %s', async role => {
    const data = fixture()
    data.user.role = role
    await expect(setup(data).service.login({ email: 'test@example.com', password: 'x' }))
      .resolves.toMatchObject({ user: { role } })
  })

  it.each([
    null, {}, { ...fixture(), access_token: '' }, { ...fixture(), refresh_token: ' ' },
    { ...fixture(), expires_in: '900' }, { ...fixture(), expires_in: -1 },
    { ...fixture(), user: null }, { ...fixture(), user: { ...fixture().user, id: 'account-b' } },
    { ...fixture(), user: { ...fixture().user, first_name: null } },
    { ...fixture(), user: { ...fixture().user, role: 'invented' } },
    { ...fixture(), access_token: 'malformed' },
    { ...fixture(), accessToken: accessToken(), access_token: undefined },
  ])('rejects incomplete or inconsistent response', async data => {
    await expect(setup(data).service.login({ email: 'test@example.com', password: 'x' }))
      .rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('uses token exp rather than expires_in to calculate expiry', async () => {
    const data = { ...fixture(), access_token: accessToken('account-a', 123.5), expires_in: 900 }
    await expect(setup(data).service.login({ email: 'test@example.com', password: 'x' }))
      .resolves.toMatchObject({ expiresAtMs: 123_500 })
  })

  it('does not persist credentials while returning a login result', async () => {
    const write = vi.spyOn(Storage.prototype, 'setItem')
    await setup(fixture()).service.login({ email: 'test@example.com', password: 'x' })
    expect(write).not.toHaveBeenCalled()
    write.mockRestore()
  })

  it.each([401, 403, 500])('preserves HTTP %s without retry or refresh', async status => {
    const adapter = vi.fn<AxiosAdapter>(async config => {
      throw new AxiosError('failure', undefined, config, undefined, {
        config, status, statusText: 'Error', headers: new AxiosHeaders(),
        data: { success: false, error: { code: 'ERROR', message: 'Login rejected' } },
      })
    })
    const service = createAuthService(createAxiosClient({ baseUrl: 'http://localhost:3000/api/v1', adapter }))
    await expect(service.login({ email: 'test@example.com', password: 'x' }))
      .rejects.toMatchObject({ kind: 'http', status })
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it.each(['ERR_NETWORK', 'ECONNABORTED'])('preserves transport failure %s', async code => {
    const adapter = vi.fn<AxiosAdapter>(async () => { throw new AxiosError('raw error', code) })
    const service = createAuthService(createAxiosClient({ baseUrl: 'http://localhost:3000/api/v1', adapter }))
    await expect(service.login({ email: 'test@example.com', password: 'x' }))
      .rejects.toMatchObject({ kind: code === 'ERR_NETWORK' ? 'network' : 'timeout' })
    expect(adapter).toHaveBeenCalledTimes(1)
  })
})
