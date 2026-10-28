import { describe, expect, it, vi } from 'vitest'
import type { AxiosAdapter } from 'axios'
import { AxiosHeaders } from 'axios'
import { createSessionStorage, SESSION_STORAGE_KEY } from '../../lib/session-storage'
import { createAxiosClient } from '../../lib/axios-client'
import { readAccessToken } from '../../utils/auth/access-token'
import type { SessionStoragePort, StoredSession } from '../../types/auth/session.types'

const token = (claims: unknown) => `e30.${btoa(JSON.stringify(claims)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}.c2ln`
const session = (): StoredSession => ({
  schemaVersion: 1, accountId: 'account-a', refreshToken: 'test-refresh',
  accessToken: token({ sub: 'account-a', exp: 100 }),
})
const setup = (initial?: string, now = () => 99_999) => {
  const entries = new Map<string, string>([['draft', 'keep']])
  if (initial !== undefined) entries.set(SESSION_STORAGE_KEY, initial)
  const storage: SessionStoragePort = {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value) },
    removeItem: key => { entries.delete(key) },
  }
  return { entries, storage, manager: createSessionStorage({ getStorage: () => storage, now }) }
}

describe('access token claims', () => {
  it('reads subject and expiry without claiming signature validation', () => {
    expect(readAccessToken(session().accessToken)).toEqual({ accountId: 'account-a', expiresAtMs: 100_000 })
  })
  it.each([{}, [], null, { sub: '', exp: 100 }, { sub: 'a' },
    { sub: 'a', exp: '100' }, { sub: 'a', exp: 1e300 }])('rejects malformed claims %j', claims => {
    expect(readAccessToken(token(claims))).toBeNull()
  })
  it.each(['', 'abc', 'a.b.c.d', 'e30.!!!.c2ln', 'e30.YQ.c2ln'])('rejects malformed token %s', value => {
    expect(readAccessToken(value)).toBeNull()
  })
})

describe('session storage', () => {
  it('starts empty and stores a single complete session', () => {
    const { manager, entries } = setup()
    expect(manager.read()).toEqual({ status: 'empty' })
    manager.write(session())
    expect(manager.read()).toMatchObject({ status: 'valid', session: session() })
    expect(JSON.parse(entries.get(SESSION_STORAGE_KEY)!)).toEqual(session())
  })

  it('restores after creating another manager', () => {
    const { manager, storage } = setup()
    manager.write(session())
    const restored = createSessionStorage({ getStorage: () => storage, now: () => 99_999 })
    expect(restored.readToken()).toBe(session().accessToken)
  })

  it.each([100_000, 100_001])('keeps an expired session at time %s but does not supply its token', time => {
    const { manager, entries } = setup(JSON.stringify(session()), () => time)
    expect(manager.read()).toMatchObject({ status: 'expired', session: session() })
    expect(manager.readToken()).toBeNull()
    expect(entries.has(SESSION_STORAGE_KEY)).toBe(true)
  })

  it.each(['{', 'null', '[]', JSON.stringify({ ...session(), schemaVersion: 2 }),
    JSON.stringify({ ...session(), refreshToken: '' }),
    JSON.stringify({ ...session(), accountId: 'account-b' }),
    JSON.stringify({ ...session(), accessToken: token({ sub: 'account-a' }) })])(
    'clears only a corrupt session', initial => {
      const { manager, entries } = setup(initial)
      expect(manager.read()).toEqual({ status: 'invalid' })
      expect(entries.has(SESSION_STORAGE_KEY)).toBe(false)
      expect(entries.get('draft')).toBe('keep')
    },
  )

  it('only persists approved fields', () => {
    const { manager, entries } = setup()
    manager.write({ ...session(), password: 'never-store' } as StoredSession)
    expect(entries.get(SESSION_STORAGE_KEY)).not.toContain('password')
    expect(entries.get(SESSION_STORAGE_KEY)).not.toContain('never-store')
  })

  it('does not overwrite an existing session with invalid input', () => {
    const { manager, entries } = setup(JSON.stringify(session()))
    expect(() => manager.write({ ...session(), accountId: 'other' })).toThrow()
    expect(entries.get(SESSION_STORAGE_KEY)).toBe(JSON.stringify(session()))
  })

  it('clears only its own key', () => {
    const { manager, entries } = setup(JSON.stringify(session()))
    manager.clear()
    expect(manager.readToken()).toBeNull()
    expect(entries.get('draft')).toBe('keep')
  })

  it.each(['getItem', 'setItem', 'removeItem'] as const)('reports failure of %s', method => {
    const { storage } = setup()
    storage[method] = vi.fn(() => { throw new Error('raw credential detail') })
    const manager = createSessionStorage({ getStorage: () => storage })
    const operation = method === 'getItem' ? manager.read
      : method === 'setItem' ? () => manager.write(session()) : manager.clear
    try { operation(); expect.fail('must throw') } catch (error) {
      expect(error).toMatchObject({ kind: 'storage' })
      expect(String(error)).not.toContain('credential')
    }
  })

  it('reports failure to access the browser storage itself', () => {
    const manager = createSessionStorage({ getStorage: () => { throw new Error('blocked') } })
    expect(() => manager.read()).toThrow('sessionStorage')
  })

  it('does not report successful cleanup when removal of corrupt data fails', () => {
    const { storage } = setup('{')
    storage.removeItem = () => { throw new Error('blocked') }
    expect(() => createSessionStorage({ getStorage: () => storage }).read()).toThrow('sessionStorage')
  })

  it('supplies the latest token to Axios and blocks transport when it expires', async () => {
    let now = 99_999
    const { manager } = setup(JSON.stringify(session()), () => now)
    const adapter = vi.fn<AxiosAdapter>(async config => {
      expect(config.headers.get('Authorization')).toBe(`Bearer ${session().accessToken}`)
      return { data: { success: true, data: true }, status: 200, statusText: 'OK',
        config, headers: new AxiosHeaders() }
    })
    const client = createAxiosClient({ baseUrl: 'http://localhost:3000/api/v1', readToken: manager.readToken, adapter })
    await expect(client.request({ path: 'users/me', auth: 'session' })).resolves.toBe(true)
    now = 100_000
    await expect(client.request({ path: 'users/me', auth: 'session' })).rejects.toMatchObject({ kind: 'session' })
    expect(adapter).toHaveBeenCalledTimes(1)
  })
})
