/// <reference types="node" />
import 'fake-indexeddb/auto'
import { AxiosHeaders } from 'axios'
import type { AxiosAdapter } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { createAppRuntime } from '../../app/app-runtime'
import { createSessionStorage } from '../../lib/session-storage'
import { UploadDraftDatabase } from '../../repositories/datasets/upload-draft.database'
import { OfflineReadDatabase } from '../../repositories/offline/offline-read.database'
import { OfflineWriteDatabase } from '../../repositories/offline/offline-write.database'

const databases: Array<UploadDraftDatabase | OfflineReadDatabase | OfflineWriteDatabase> = []
const runtimes: Array<ReturnType<typeof createAppRuntime>> = []
const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')

afterEach(async () => {
  for (const runtime of runtimes.splice(0)) runtime.dispose()
  for (const database of databases.splice(0)) await database.delete()
  if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks)
  else Reflect.deleteProperty(navigator, 'locks')
})

const token = (accountId: string, exp: number) => `e30.${btoa(JSON.stringify({ sub: accountId, exp })).replace(/=/g, '')}.c2ln`
const profile = { id: 'account-a', email: 'qa@example.test', firstName: 'QA', lastName: 'User', role: 'analyst', status: 'active' }
const response = (config: Parameters<AxiosAdapter>[0], status: number, value: unknown) => ({
  config, status, statusText: status === 204 ? 'No Content' : 'OK', headers: new AxiosHeaders(),
  data: status === 204 ? '' : { success: true, data: value },
})
const locks = { request: async <T,>(_name: string, _options: { mode: 'exclusive'; ifAvailable?: boolean }, callback: (lock: object | null) => Promise<T>) => callback({}) }

it('keeps the same runtime/session, refreshes through the replacement URL, then replays the persisted queue there', async () => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: locks })
  const now = 10_000
  let storedValue: string | null = JSON.stringify({
    schemaVersion: 1, accountId: 'account-a', accessToken: token('account-a', 5), refreshToken: 'refresh-old',
    refreshExpiresAtMs: now + 7 * 24 * 60 * 60 * 1000,
  })
  const storage = createSessionStorage({ now: () => now, getStorage: () => ({
    getItem: key => key === 'data-quality.auth.v1' ? storedValue : null,
    setItem: (_key, value) => { storedValue = value },
    removeItem: key => { if (key === 'data-quality.auth.v1') storedValue = null },
  }) })
  const uploadDb = new UploadDraftDatabase(`target-switch-drafts-${crypto.randomUUID()}`)
  const readsDb = new OfflineReadDatabase(`target-switch-reads-${crypto.randomUUID()}`)
  const writesDb = new OfflineWriteDatabase(`target-switch-writes-${crypto.randomUUID()}`)
  databases.push(uploadDb, readsDb, writesDb)
  const requests: Array<{ origin: string; path: string; authorization?: string }> = []
  const adapter: AxiosAdapter = async config => {
    const url = new URL(config.url ?? '', config.baseURL)
    requests.push({ origin: url.origin, path: url.pathname,
      ...(typeof config.headers.get('Authorization') === 'string' ? { authorization: config.headers.get('Authorization') as string } : {}) })
    if (url.pathname === '/health') return response(config, 200, { status: 'ok', services: { mongodb_atlas: { status: 'connected' } } })
    if (url.pathname === '/health/ready') return response(config, 200, { status: 'ok', checks: { mongodb: { status: 'ok' }, storage: { status: 'ok', mode: 'local_fallback' } } })
    if (url.pathname === '/api/v1/auth/refresh') return response(config, 200, {
      access_token: token('account-a', 40), refresh_token: 'refresh-new', expires_in: 900,
    })
    if (url.pathname === '/api/v1/users/me') return response(config, 200, profile)
    if (url.pathname === '/api/v1/datasets/dataset-a' && config.method?.toUpperCase() === 'DELETE') return response(config, 204, null)
    return response(config, 200, { items: [] })
  }
  const runtime = createAppRuntime({
    client: { baseUrl: 'https://old-tunnel.example.test/api/v1', adapter }, storage,
    database: uploadDb, offlineDatabase: readsDb, writeDatabase: writesDb, now: () => now,
    clearSessionCache: () => {},
  })
  runtimes.push(runtime)

  await runtime.coordinator.restore()
  expect(runtime.coordinator.getSnapshot().phase).toBe('awaiting-consent')
  const receipt = await runtime.offlineWrites.enqueue({ path: '/datasets/dataset-a', method: 'DELETE', auth: 'session', deferIfOffline: true })
  expect(receipt.state).toBe('queued')
  expect(requests.some(request => request.path === '/api/v1/datasets/dataset-a')).toBe(false)

  const oldTarget = runtime.apiTargetManager.getTarget()
  const switchTask = runtime.apiTargetManager.switchTarget({
    baseUrl: 'https://new-tunnel.example.test', prefix: '/api/v1', environmentId: oldTarget.environmentId,
  })
  await vi.waitFor(() => expect(requests.some(request =>
    request.origin === 'https://new-tunnel.example.test' && request.path === '/health/ready')).toBe(true))
  expect(runtime.apiTargetManager.getSnapshot().phase).toBe('switching')
  expect(runtime.coordinator.getSnapshot().phase).toBe('awaiting-consent')
  await runtime.coordinator.confirmRenewal(true)
  await switchTask

  expect(runtime.apiTargetManager.getTarget()).toMatchObject({
    baseUrl: 'https://new-tunnel.example.test', prefix: '/api/v1', environmentId: oldTarget.environmentId, revision: 1,
  })
  await vi.waitFor(async () => {
    await runtime.offlineWrites.refresh()
    expect(runtime.offlineWrites.getSnapshot().entries).toMatchObject([{ id: receipt.queueId, state: 'confirmed' }])
  })
  expect(requests.filter(request => request.path === '/api/v1/auth/refresh')).toMatchObject([{ origin: 'https://new-tunnel.example.test' }])
  expect(requests.filter(request => request.path === '/api/v1/users/me').at(-1)).toMatchObject({ origin: 'https://new-tunnel.example.test' })
  expect(requests.filter(request => request.path === '/api/v1/datasets/dataset-a')).toMatchObject([{
    origin: 'https://new-tunnel.example.test', authorization: `Bearer ${token('account-a', 40)}`,
  }])
})
