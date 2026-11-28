import { requireDefined } from '../../utils/required-value'
/// <reference types="node" />
import 'fake-indexeddb/auto'
import { File as NodeFile } from 'node:buffer'
import { AxiosHeaders } from 'axios'
import type { AxiosAdapter } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { createAppRuntime } from '../../app/app-runtime'
import { UploadDraftDatabase } from '../../repositories/datasets/upload-draft.database'
import { ApiError } from '../../lib/api-error'
import { createSessionStorage } from '../../lib/session-storage'
import { createSessionCoordinator } from '../../services/auth/session-coordinator'
import type { LoginRequestDto, LoginResult, RefreshResult } from '../../types'
import type { StoredSession } from '../../types'
import type { CurrentUser } from '../../types'

const token = (account = 'a', exp = 20) => `e30.${btoa(JSON.stringify({ sub: account, exp })).replace(/=/g, '')}.c2ln`
const session = (account = 'a', exp = 20): StoredSession => ({
  schemaVersion: 1, accessToken: token(account, exp), accountId: account, refreshToken: `test-refresh-${account}`,
})
const profile = (account = 'a'): CurrentUser => ({ id: account, email: 'test@example.com', firstName: 'Test', lastName: 'User', role: 'analyst', status: 'active', avatarUrl: null })
const loginResult = (account = 'a', exp = 20): LoginResult => ({
  session: session(account, exp), expiresAtMs: exp * 1000,
  user: { id: account, email: 'test@example.com', role: 'analyst' },
})
const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const failure = (kind: 'http' | 'network' | 'timeout' | 'invalid-response', status?: number) => new ApiError({ kind, ...(status === undefined ? {} : { status }), message: 'Test failure' })

const setup = (stored?: StoredSession) => {
  let time = 10000
  const records = new Map<string, string>()
  const storage = createSessionStorage({
    now: () => time,
    getStorage: () => ({ getItem: key => records.get(key) ?? null, setItem: (key, value) => { records.set(key, value) }, removeItem: key => { records.delete(key) } }),
  })
  if (stored) storage.write(stored)
  const getMe = vi.fn(async () => Promise.resolve(profile()))
  const logout = vi.fn(async () => {})
  const deleteMe = vi.fn(async () => {})
  const login = vi.fn<(input: LoginRequestDto) => Promise<LoginResult>>(async () => Promise.resolve(loginResult()))
  const refresh = vi.fn<(input: { refresh_token: string }) => Promise<RefreshResult>>(async () => Promise.resolve(({ accessToken: token('a', 40), refreshToken: 'rotated-refresh', accountId: 'a', expiresAtMs: 40000 })))
  const health = vi.fn(async () => Promise.resolve(({ available: true })))
  const bindSession = vi.fn<(accessToken: string) => { getMe: typeof getMe; logout: typeof logout; deleteMe: typeof deleteMe }>(() => ({ getMe, logout, deleteMe }))
  const clearSessionCache = vi.fn()
  const coordinator = createSessionCoordinator({ storage, auth: { login, refresh }, health: { check: health }, bindSession, clearSessionCache, now: () => time })
  return { coordinator, storage, records, getMe, logout, deleteMe, login, refresh, health, bindSession, clearSessionCache, setTime: (next: number) => { time = next } }
}

describe('session coordinator', () => {
  it('clears the session after account deletion succeeds', async () => {
    const s = setup(session())
    await s.coordinator.restore()
    await s.coordinator.deleteAccount()
    expect(s.deleteMe).toHaveBeenCalledOnce()
    expect(s.coordinator.getSnapshot().phase).toBe('anonymous')
    expect(s.storage.read()).toEqual({ status: 'empty' })
  })

  it('preserves the session when account deletion is rejected', async () => {
    const s = setup(session())
    await s.coordinator.restore()
    s.deleteMe.mockRejectedValueOnce(failure('http', 403))
    await expect(s.coordinator.deleteAccount()).rejects.toMatchObject({ status: 403 })
    expect(s.coordinator.getSnapshot().phase).toBe('authenticated')
    expect(s.storage.read().status).toBe('valid')
    expect(s.deleteMe).toHaveBeenCalledOnce()
  })

  it('does not clear a replacement session when an old account deletion finishes', async () => {
    const s = setup(session())
    await s.coordinator.restore()
    const pending = deferred<void>()
    s.deleteMe.mockReturnValueOnce(pending.promise)
    const deleting = s.coordinator.deleteAccount()
    await s.coordinator.signOut()
    s.login.mockResolvedValueOnce(loginResult('b'))
    await s.coordinator.signIn({ email: 'b@example.test', password: 'test-only' })
    pending.resolve()
    await deleting
    expect(s.coordinator.getSnapshot()).toMatchObject({ phase: 'authenticated', accountId: 'b' })
  })

  it('accepts a Google session only after checking its active profile', async () => {
    const s = setup()
    await s.coordinator.restore()
    await s.coordinator.signInWithGoogle({ accessToken: token(), refreshToken: 'google-refresh' })
    expect(s.getMe).toHaveBeenCalledOnce()
    expect(s.login).not.toHaveBeenCalled()
    expect(s.coordinator.getSnapshot()).toMatchObject({ phase: 'authenticated', accountId: 'a', user: { source: 'profile' } })
    expect(s.storage.read()).toMatchObject({ status: 'valid', session: { refreshToken: 'google-refresh' } })
  })

  it('does not save Google credentials for a mismatched profile', async () => {
    const s = setup()
    await s.coordinator.restore()
    s.getMe.mockResolvedValueOnce(profile('other'))
    await expect(s.coordinator.signInWithGoogle({ accessToken: token(), refreshToken: 'google-refresh' })).rejects.toThrow('không khớp')
    expect(s.coordinator.getSnapshot().phase).toBe('anonymous')
    expect(s.storage.read()).toEqual({ status: 'empty' })
  })

  it('restores empty storage without private API and keeps a stable snapshot', async () => {
    const s = setup()
    await s.coordinator.restore()
    expect(s.coordinator.getSnapshot().phase).toBe('anonymous')
    expect(s.coordinator.getSnapshot()).toBe(s.coordinator.getSnapshot())
    expect(s.getMe).not.toHaveBeenCalled()
    expect(s.coordinator.draftAccess.read()).toBeNull()
  })

  it('restores a valid session only after matching active profile', async () => {
    const s = setup(session())
    const pending = deferred<CurrentUser>()
    s.getMe.mockReturnValueOnce(pending.promise)
    const work = s.coordinator.restore()
    expect(s.coordinator.draftAccess.read()).toBeNull()
    pending.resolve(profile())
    await work
    expect(s.coordinator.getSnapshot()).toMatchObject({ phase: 'authenticated', accountId: 'a', user: { source: 'profile' } })
    expect(s.bindSession).toHaveBeenCalledWith(token())
    expect(s.coordinator.draftAccess.read()).toMatchObject({ accountId: 'a', expiresAtMs: 604810000 })
  })

  it('uses login user without me or fabricated profile fields', async () => {
    const s = setup()
    await s.coordinator.restore()
    await s.coordinator.signIn({ email: 'test@example.com', password: ' x ' })
    expect(s.getMe).not.toHaveBeenCalled()
    expect(requireDefined(s.login.mock.calls[0], 'session-coordinator.test.ts:81')[0].password).toBe(' x ')
    const snapshot = s.coordinator.getSnapshot()
    expect(snapshot).toMatchObject({ phase: 'authenticated', user: { source: 'login' } })
    expect(JSON.stringify(snapshot)).not.toContain('accessToken')
    expect(JSON.stringify(snapshot)).not.toContain('refreshToken')
    expect(s.storage.read()).toMatchObject({ status: 'valid', session: session() })
    if (snapshot.phase === 'authenticated') expect(snapshot.user.value).not.toHaveProperty('status')
  })

  it('rejects login until anonymous and blocks duplicate submits', async () => {
    const s = setup()
    await s.coordinator.restore()
    const pending = deferred<LoginResult>()
    s.login.mockReturnValueOnce(pending.promise)
    const work = s.coordinator.signIn({ email: 'test@example.com', password: 'x' })
    await expect(s.coordinator.signIn({ email: 'test@example.com', password: 'x' })).rejects.toMatchObject({ kind: 'session' })
    pending.resolve(loginResult())
    await work
    await expect(s.coordinator.signIn({ email: 'test@example.com', password: 'x' })).rejects.toMatchObject({ kind: 'session' })
    expect(s.login).toHaveBeenCalledTimes(1)
  })

  it.each([[401, 'awaiting-consent'], [403, 'awaiting-consent'], [404, 'local-limited']] as const)(
    'preserves restored credentials when me returns HTTP %s', async (status, phase) => {
    const s = setup(session())
    s.getMe.mockRejectedValueOnce(failure('http', status))
    await s.coordinator.restore()
    expect(s.coordinator.getSnapshot()).toMatchObject({ phase, error: { kind: 'http', status } })
    expect(s.storage.read()).toMatchObject({ status: 'valid', session: { accountId: 'a' } })
    expect(s.refresh).not.toHaveBeenCalled()
  })

  it.each([profile('b'), { ...profile(), status: 'blocked' as const }])('rejects mismatched or blocked profile', async value => {
    const s = setup(session())
    s.getMe.mockResolvedValueOnce(value)
    await s.coordinator.restore()
    expect(s.coordinator.getSnapshot().phase).toBe('anonymous')
  })

  it('keeps credentials on malformed me response and clears only corrupt storage', async () => {
    const s = setup(session())
    s.getMe.mockRejectedValueOnce(failure('invalid-response'))
    await s.coordinator.restore()
    expect(s.coordinator.getSnapshot().phase).toBe('local-limited')
    expect(s.storage.read()).toMatchObject({ status: 'valid', session: { accountId: 'a' } })
    const broken = setup()
    broken.records.set('data-quality.auth.v1', '{bad')
    await broken.coordinator.restore()
    expect(broken.storage.read()).toEqual({ status: 'empty' })
  })

  it.each([failure('network'), failure('timeout'), failure('http', 500)])('limits valid restored sessions on outage', async error => {
    const s = setup(session())
    s.getMe.mockRejectedValueOnce(error)
    await s.coordinator.restore()
    expect(s.coordinator.getSnapshot()).toMatchObject({ phase: 'local-limited', user: null })
    expect(s.coordinator.draftAccess.read()).toMatchObject({ accountId: 'a' })
  })

  it('treats access expiry as remote-auth blocked but keeps local draft access and coalesces health', async () => {
    const s = setup(session())
    await s.coordinator.restore()
    s.setTime(19999)
    expect(s.coordinator.draftAccess.read()).not.toBeNull()
    s.setTime(20000)
    expect(s.coordinator.draftAccess.read()).toMatchObject({ accountId: 'a', expiresAtMs: 604810000 })
    const pending = deferred<{ available: boolean }>()
    s.health.mockReturnValueOnce(pending.promise)
    const jobs = [s.coordinator.checkSession(), s.coordinator.checkSession(), s.coordinator.checkSession()]
    pending.resolve({ available: true })
    await Promise.all(jobs)
    expect(s.health).toHaveBeenCalledTimes(1)
    expect(s.coordinator.getSnapshot().phase).toBe('awaiting-consent')
    expect(s.refresh).not.toHaveBeenCalled()
  })

  it('renews only after consent, binds candidate token to me and stores the rotated refresh token', async () => {
    const s = setup(session('a', 5))
    await s.coordinator.restore()
    expect(s.coordinator.getSnapshot().phase).toBe('awaiting-consent')
    const pending = deferred<RefreshResult>()
    s.refresh.mockReturnValueOnce(pending.promise)
    const work = s.coordinator.confirmRenewal(true)
    const duplicate = s.coordinator.confirmRenewal(true)
    expect(s.coordinator.draftAccess.read()).toMatchObject({ accountId: 'a', expiresAtMs: 604810000 })
    pending.resolve({ accessToken: token('a', 40), refreshToken: 'rotated-refresh', accountId: 'a', expiresAtMs: 40000 })
    await Promise.all([work, duplicate])
    expect(s.refresh).toHaveBeenCalledTimes(1)
    expect(s.bindSession).toHaveBeenCalledWith(token('a', 40))
    expect(s.storage.read()).toMatchObject({ session: { accessToken: token('a', 40), refreshToken: 'rotated-refresh' } })
    expect(s.coordinator.getSnapshot()).toMatchObject({ phase: 'authenticated', user: { source: 'profile' } })
  })

  it('uses the rotated refresh token on the next renewal', async () => {
    const s = setup(session('a', 5))
    await s.coordinator.restore()
    await s.coordinator.confirmRenewal(true)
    s.setTime(40000)
    await s.coordinator.checkSession()
    s.refresh.mockResolvedValueOnce({ accessToken: token('a', 80), refreshToken: 'rotated-again', accountId: 'a', expiresAtMs: 80000 })
    await s.coordinator.confirmRenewal(true)
    expect(requireDefined(s.refresh.mock.calls[1], 'session-coordinator.test.ts:180')[0]).toEqual({ refresh_token: 'rotated-refresh' })
    expect(s.storage.read()).toMatchObject({ session: { accessToken: token('a', 80), refreshToken: 'rotated-again' } })
  })

  it('declines without refresh and clears access and cache', async () => {
    const s = setup(session('a', 5))
    await s.coordinator.restore()
    await s.coordinator.confirmRenewal(false)
    expect(s.refresh).not.toHaveBeenCalled()
    expect(s.coordinator.getSnapshot()).toMatchObject({ phase: 'anonymous', accountId: null, user: null })
    expect(s.storage.read()).toEqual({ status: 'empty' })
    expect(s.clearSessionCache).toHaveBeenCalled()
  })

  it.each([false, 'network', 'payload'])('keeps expired-access session when health is unavailable: %s', async state => {
    const s = setup(session('a', 5))
    if (state === false) s.health.mockResolvedValueOnce({ available: false })
    else s.health.mockRejectedValueOnce(failure(state === 'network' ? 'network' : 'invalid-response'))
    await s.coordinator.restore()
    expect(s.coordinator.getSnapshot().phase).toBe('local-limited')
    expect(s.storage.read()).toMatchObject({ status: 'expired', session: { accountId: 'a', refreshToken: 'test-refresh-a' } })
    expect(s.refresh).not.toHaveBeenCalled()
  })

  it.each(['b', 'expired', 'network', 'me'])('handles failed renewal by auth vs outage result: %s', async state => {
    const s = setup(session('a', 5))
    await s.coordinator.restore()
    if (state === 'network') s.refresh.mockRejectedValueOnce(failure('network'))
    else if (state === 'me') s.getMe.mockRejectedValueOnce(failure('http', 500))
    else s.refresh.mockResolvedValueOnce({ accessToken: token(state === 'b' ? 'b' : 'a', 5), refreshToken: 'rotated-refresh', accountId: state === 'b' ? 'b' : 'a', expiresAtMs: 5000 })
    await expect(s.coordinator.confirmRenewal(true)).rejects.toBeDefined()
    if (state === 'network' || state === 'me') {
      expect(s.coordinator.getSnapshot().phase).toBe('local-limited')
      expect(s.storage.read()).toMatchObject({ status: state === 'network' ? 'expired' : 'valid', session: { accountId: 'a' } })
    } else {
      expect(s.coordinator.getSnapshot().phase).toBe('anonymous')
      expect(s.storage.read()).toEqual({ status: 'empty' })
    }
  })

  it('rechecks expiry after a slow me response, including outage', async () => {
    const s = setup(session())
    const pending = deferred<CurrentUser>()
    s.getMe.mockReturnValueOnce(pending.promise)
    const work = s.coordinator.restore()
    s.setTime(20000)
    pending.reject(failure('network'))
    await work
    expect(s.coordinator.getSnapshot().phase).toBe('local-limited')
    expect(s.storage.read()).toMatchObject({ status: 'expired', session: { accountId: 'a' } })
  })

  it('does not accept an already expired login token', async () => {
    const s = setup()
    await s.coordinator.restore()
    s.login.mockResolvedValueOnce(loginResult('a', 5))
    await expect(s.coordinator.signIn({ email: 'test@example.com', password: 'x' })).rejects.toMatchObject({ kind: 'session' })
    expect(s.coordinator.getSnapshot().phase).toBe('anonymous')
  })

  it.each([[401, 'awaiting-consent'], [403, 'awaiting-consent'], [404, 'local-limited']] as const)(
    'retains session on me response %s after access token expires in flight', async (status, phase) => {
    const s = setup(session())
    const pending = deferred<CurrentUser>()
    s.getMe.mockReturnValueOnce(pending.promise)
    const work = s.coordinator.restore()
    s.setTime(20000)
    pending.reject(failure('http', status))
    await work
    expect(s.coordinator.getSnapshot().phase).toBe(phase)
    expect(s.storage.read()).toMatchObject({ status: 'expired', session: { accountId: 'a' } })
    expect(s.health).not.toHaveBeenCalled()
  })

  it('does not renew a blocked user even if the old token expires during me', async () => {
    const s = setup(session())
    const pending = deferred<CurrentUser>()
    s.getMe.mockReturnValueOnce(pending.promise)
    const work = s.coordinator.restore()
    s.setTime(20000)
    pending.resolve({ ...profile(), status: 'blocked' })
    await work
    expect(s.coordinator.getSnapshot().phase).toBe('anonymous')
    expect(s.health).not.toHaveBeenCalled()
  })

  it('keeps the renewed session locally limited if persistence temporarily fails', async () => {
    const s = setup(session('a', 5))
    await s.coordinator.restore()
    vi.spyOn(s.storage, 'write').mockImplementationOnce(() => { throw new ApiError({ kind: 'storage', message: 'write failed' }) })
    await expect(s.coordinator.confirmRenewal(true)).rejects.toMatchObject({ kind: 'storage' })
    expect(s.coordinator.getSnapshot().phase).toBe('local-limited')
    expect(s.coordinator.draftAccess.read()).toMatchObject({ accountId: 'a' })
    expect(s.storage.read()).toMatchObject({ status: 'expired', session: { accountId: 'a' } })
  })

  it('invalidates draft subscriptions synchronously on logout and binds revoke to old token', async () => {
    const s = setup(session())
    await s.coordinator.restore()
    const seen: unknown[] = []
    const unsubscribe = s.coordinator.draftAccess.subscribe(() => { seen.push(s.coordinator.draftAccess.read()) })
    const pending = deferred<void>()
    s.logout.mockReturnValueOnce(pending.promise)
    const work = s.coordinator.signOut()
    expect(s.coordinator.draftAccess.read()).toBeNull()
    expect(seen).toContain(null)
    s.login.mockResolvedValueOnce(loginResult('b'))
    await s.coordinator.signIn({ email: 'test@example.com', password: 'x' })
    pending.resolve()
    expect(await work).toMatchObject({ serverRevoked: true })
    expect(s.coordinator.getSnapshot()).toMatchObject({ phase: 'authenticated', accountId: 'b' })
    expect(s.storage.read()).toMatchObject({ session: { accountId: 'b' } })
    unsubscribe()
  })

  it('discards refresh results after logout and login B', async () => {
    const s = setup(session('a', 5))
    await s.coordinator.restore()
    const pending = deferred<RefreshResult>()
    s.refresh.mockReturnValueOnce(pending.promise)
    const work = s.coordinator.confirmRenewal(true)
    await Promise.resolve()
    await s.coordinator.signOut()
    s.login.mockResolvedValueOnce(loginResult('b'))
    await s.coordinator.signIn({ email: 'test@example.com', password: 'x' })
    pending.resolve({ accessToken: token('a', 40), refreshToken: 'rotated-refresh', accountId: 'a', expiresAtMs: 40000 })
    await work
    expect(s.coordinator.getSnapshot().accountId).toBe('b')
  })

  it('discards old login and me results even when accountId is the same', async () => {
    const s = setup()
    await s.coordinator.restore()
    const pending = deferred<LoginResult>()
    s.login.mockReturnValueOnce(pending.promise)
    const old = s.coordinator.signIn({ email: 'test@example.com', password: 'x' })
    await s.coordinator.signOut()
    s.login.mockResolvedValueOnce(loginResult('a', 40))
    await s.coordinator.signIn({ email: 'test@example.com', password: 'x' })
    pending.resolve(loginResult('a', 20))
    await old
    expect(s.storage.read()).toMatchObject({ expiresAtMs: 40000 })
  })

  it('reports storage failures and prevents login if cleanup is not complete', async () => {
    const s = setup()
    await s.coordinator.restore()
    vi.spyOn(s.storage, 'write').mockImplementationOnce(() => { throw new ApiError({ kind: 'storage', message: 'write failed' }) })
    await expect(s.coordinator.signIn({ email: 'test@example.com', password: 'x' })).rejects.toMatchObject({ kind: 'storage' })
    const clear = vi.spyOn(s.storage, 'clear').mockImplementation(() => { throw new ApiError({ kind: 'storage', message: 'clear failed' }) })
    expect(await s.coordinator.signOut()).toMatchObject({ cleanupError: { kind: 'storage' } })
    await expect(s.coordinator.signIn({ email: 'test@example.com', password: 'x' })).rejects.toMatchObject({ kind: 'session' })
    clear.mockRestore()
    await s.coordinator.signOut()
    await expect(s.coordinator.signIn({ email: 'test@example.com', password: 'x' })).resolves.toBeUndefined()
  })

  it('reports revoke failure but does not retain FE credentials', async () => {
    const s = setup(session())
    await s.coordinator.restore()
    s.logout.mockRejectedValueOnce(failure('network'))
    expect(await s.coordinator.signOut()).toMatchObject({ serverRevoked: false, revokeError: { kind: 'network' } })
    expect(s.storage.read()).toEqual({ status: 'empty' })
    expect(s.coordinator.draftAccess.read()).toBeNull()
  })

  it('coalesces restore and prevents disposed async results from committing', async () => {
    const s = setup(session())
    const pending = deferred<CurrentUser>()
    s.getMe.mockReturnValueOnce(pending.promise)
    const jobs = [s.coordinator.restore(), s.coordinator.restore()]
    s.coordinator.dispose()
    pending.resolve(profile())
    await Promise.all(jobs)
    expect(s.getMe).toHaveBeenCalledTimes(1)
    expect(s.coordinator.draftAccess.read()).toBeNull()
    await expect(s.coordinator.signIn({ email: 'test@example.com', password: 'x' })).rejects.toMatchObject({ kind: 'session' })
  })

  it('discards a slow restored profile after logout and login B', async () => {
    const s = setup(session())
    const pending = deferred<CurrentUser>()
    s.getMe.mockReturnValueOnce(pending.promise)
    const work = s.coordinator.restore()
    await s.coordinator.signOut()
    s.login.mockResolvedValueOnce(loginResult('b'))
    await s.coordinator.signIn({ email: 'test@example.com', password: 'x' })
    pending.resolve(profile('a'))
    await work
    expect(s.coordinator.getSnapshot().accountId).toBe('b')
    expect(s.storage.read()).toMatchObject({ session: { accountId: 'b' } })
  })

  it('sanitizes storage read failures and locks access when cache cleanup fails', async () => {
    const s = setup()
    vi.spyOn(s.storage, 'read').mockImplementationOnce(() => { throw new ApiError({ kind: 'storage', message: 'read failed' }) })
    await s.coordinator.restore()
    expect(s.coordinator.getSnapshot()).toMatchObject({ phase: 'anonymous', error: { kind: 'storage' } })
    s.clearSessionCache.mockImplementationOnce(() => { throw new Error('private cache detail') })
    await s.coordinator.signOut()
    expect(s.coordinator.getSnapshot().cleanupError).not.toBeNull()
    expect(s.coordinator.draftAccess.read()).toBeNull()
    expect(JSON.stringify(s.coordinator.getSnapshot())).not.toContain('private cache detail')
  })
})

describe('runtime connects services, session coordinator and IndexedDB', () => {
  it('aborts a real draft transaction when the coordinator logs out', async () => {
    const db = new UploadDraftDatabase(`runtime-abort-${crypto.randomUUID()}`)
    const s = setup(session())
    const adapter: AxiosAdapter = async config => Promise.resolve(({
      config, status: 200, statusText: 'OK', headers: new AxiosHeaders(),
      data: { success: true, data: config.url?.endsWith('/users/me')
        ? { id: 'a', email: 'test@example.com', firstName: 'Test', lastName: 'User', role: 'analyst', status: 'active' }
        : { message: 'Đăng xuất thành công' } },
    }))
    const runtime = createAppRuntime({ client: { baseUrl: 'http://localhost:3000/api/v1', adapter }, database: db, storage: s.storage, clearSessionCache: vi.fn(), now: () => 10000 })
    try {
      await runtime.coordinator.restore()
      let logoutWork: ReturnType<typeof runtime.coordinator.signOut> | undefined
      db.files.hook('creating', () => { logoutWork = runtime.coordinator.signOut() })
      await expect(runtime.drafts.save({ projectId: 'p', file: new NodeFile(['a'], 'test.csv') as unknown as File }))
        .rejects.toMatchObject({ kind: 'session' })
      await logoutWork
      expect(await db.drafts.count()).toBe(0)
      expect(await db.files.count()).toBe(0)
      expect(s.storage.read()).toEqual({ status: 'empty' })
    } finally { runtime.dispose(); await db.delete() }
  })

  it('retains A draft on logout, denies B, and reopens it only after A logs in again', async () => {
    const db = new UploadDraftDatabase(`runtime-test-${crypto.randomUUID()}`)
    const base = setup()
    let account = 'a'
    const adapter = vi.fn<AxiosAdapter>(async config => {
      const data = config.url?.endsWith('/auth/login')
        ? { access_token: token(account), refresh_token: `test-refresh-${account}`, expires_in: 900,
          user: { id: account, email: 'test@example.com', firstName: 'Test', lastName: 'User', role: 'analyst' } }
        : { message: 'Đăng xuất thành công' }
      return Promise.resolve({ config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { success: true, data } })
    })
    const runtime = createAppRuntime({ client: { baseUrl: 'http://localhost:3000/api/v1', adapter }, database: db, storage: base.storage, clearSessionCache: vi.fn(), now: () => 10000 })
    try {
      await runtime.coordinator.restore()
      await expect(runtime.drafts.list()).rejects.toMatchObject({ kind: 'session' })
      await runtime.coordinator.signIn({ email: 'test@example.com', password: 'x' })
      const draft = await runtime.drafts.save({ projectId: 'p', file: new NodeFile(['a\n1'], 'draft.csv') as unknown as File })
      await runtime.coordinator.signOut()
      await expect(runtime.drafts.list()).rejects.toMatchObject({ kind: 'session' })
      expect(await db.drafts.count()).toBe(1)
      account = 'b'
      await runtime.coordinator.signIn({ email: 'test@example.com', password: 'x' })
      expect(await runtime.drafts.list()).toEqual([])
      await expect(runtime.drafts.readFile(draft.id)).rejects.toMatchObject({ code: 'DRAFT_NOT_FOUND' })
      const logoutRequests = adapter.mock.calls.filter(([config]) => config.url?.endsWith('/auth/logout'))
      expect(requireDefined(logoutRequests[0], 'session-coordinator.test.ts:425')[0].headers.get('Authorization')).toBe(`Bearer ${token('a')}`)
      await runtime.coordinator.signOut()
      account = 'a'
      await runtime.coordinator.signIn({ email: 'test@example.com', password: 'x' })
      expect(await runtime.drafts.list()).toEqual([draft])
    } finally { runtime.dispose(); await db.delete() }
  })

  it('binds renewed token to real me service before opening draft access', async () => {
    const db = new UploadDraftDatabase(`runtime-refresh-${crypto.randomUUID()}`)
    const s = setup(session('a', 5))
    const adapter = vi.fn<AxiosAdapter>(async config => {
      const data = config.url?.endsWith('/health')
        ? { status: 'ok', services: { mongodb_atlas: { status: 'connected' } } }
        : config.url?.endsWith('/auth/refresh')
          ? { access_token: token('a', 40), refresh_token: 'rotated-refresh', expires_in: 900 }
          : { id: 'a', email: 'test@example.com', firstName: 'Test', lastName: 'User', role: 'analyst', status: 'active' }
      return Promise.resolve({ config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { success: true, data } })
    })
    const runtime = createAppRuntime({ client: { baseUrl: 'http://localhost:3000/api/v1', adapter }, database: db, storage: s.storage, clearSessionCache: vi.fn(), now: () => 10000 })
    try {
      await runtime.coordinator.restore()
      expect(runtime.coordinator.draftAccess.read()).toMatchObject({ accountId: 'a' })
      await runtime.coordinator.confirmRenewal(true)
      const meRequest = adapter.mock.calls.find(([config]) => config.url?.endsWith('/users/me'))![0]
      expect(meRequest.headers.get('Authorization')).toBe(`Bearer ${token('a', 40)}`)
      expect(runtime.coordinator.draftAccess.read()).toMatchObject({ accountId: 'a', expiresAtMs: 604810000 })
    } finally { runtime.dispose(); await db.delete() }
  })
})
