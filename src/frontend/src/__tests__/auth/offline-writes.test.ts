/// <reference types="node" />
/* eslint-disable @typescript-eslint/require-await -- API test doubles intentionally expose asynchronous transport contracts. */
import 'fake-indexeddb/auto'
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OfflineWriteDatabase } from '../../repositories/offline/offline-write.database'
import { createOfflineWriteRepository } from '../../repositories/offline/offline-write.repository'
import { OfflineReadDatabase } from '../../repositories/offline/offline-read.database'
import { createOfflineReadRepository } from '../../repositories/offline/offline-read.repository'
import { createOfflineWriteService } from '../../services/offline/offline-write.service'
import { createOfflineDataService } from '../../services/offline/offline-data.service'
import { acceptsOfflineWrite, hashFile } from '../../services/offline/offline-write-command'
import { updateConfirmedCache } from '../../services/offline/confirmed-write-cache'
import { ApiError } from '../../lib/api-error'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'
import type { DraftAccess } from '../../types/datasets/upload-draft.types'

// jsdom's Blob/FormData lack arrayBuffer and structured cloning. Browser coverage uses the native implementations.
class TestFormData {
  values = new Map<string, unknown>()
  append(key: string, value: unknown) { this.values.set(key, value) }
  keys() { return this.values.keys() }
  get(key: string) { return this.values.get(key) }
}
const databases: (OfflineWriteDatabase | OfflineReadDatabase)[] = []
const services: { dispose(): void }[] = []
beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob); vi.stubGlobal('File', NodeFile); vi.stubGlobal('FormData', TestFormData); vi.stubGlobal('crypto', webcrypto)
})
afterEach(async () => {
  services.splice(0).forEach(service => service.dispose())
  for (const db of databases.splice(0)) await db.delete()
  vi.unstubAllGlobals()
})
const patch = (name = 'New'): ApiRequestOptions => ({ path: '/projects/p', method: 'PATCH', auth: 'session', deferIfOffline: true, data: { name, expectedVersion: 1 } })
const deletion: ApiRequestOptions = { path: '/projects/p', method: 'DELETE', auth: 'session', deferIfOffline: true }
const health = { status: 'ok', services: { mongodb_atlas: { status: 'connected' } } }
const outage = () => new ApiError({ kind: 'network', message: 'outage' })
const setup = () => {
  const db = new OfflineWriteDatabase(`writes-${crypto.randomUUID()}`)
  const readDb = new OfflineReadDatabase(`reads-${crypto.randomUUID()}`)
  databases.push(db, readDb)
  let current: DraftAccess | null = { accountId: 'a', generation: 1, expiresAtMs: 100000 }
  let now = 1000
  const listeners = new Set<() => void>()
  const access = { read: () => current, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } } }
  const change = (scope: DraftAccess | null) => { current = scope; listeners.forEach(listener => listener()) }
  const repository = createOfflineWriteRepository({ db, access, namespace: 'qa', now: () => now })
  const cache = createOfflineReadRepository({ db: readDb, access, namespace: 'qa', now: () => now })
  const request = vi.fn<(request: ApiRequestOptions) => Promise<unknown>>(async input => {
    if (input.path === '/health') return health
    if (input.method === 'PATCH') return { project: { id: 'p', name: 'New', version: 2 } }
    if (input.method === 'DELETE') return undefined
    return { project: { id: 'p', name: 'Old', version: 1 } }
  })
  let online = false
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
  const prepare = vi.fn(async () => true)
  const confirmed = vi.fn(async (row: Parameters<typeof updateConfirmedCache>[1]) => { await updateConfirmedCache(cache, row) })
  const makeService = (lock: NonNullable<Parameters<typeof createOfflineWriteService>[0]['lock']> = async (_name, work) => { await work() }) => {
    const service = createOfflineWriteService({ repository, access, namespace: 'qa', api: { request } as ApiClient,
      prepare, connected: vi.fn(), confirmed, lock, intervalMs: 20 })
    services.push(service)
    return service
  }
  const service = makeService()
  return { db, repository, cache, access, change, request, prepare, confirmed, service, makeService,
    online: () => { online = true }, setTime: (value: number) => { now = value } }
}
const upload = () => {
  const file = new File(['id,value\n1,2\n'], 'sample.csv', { type: 'text/csv' })
  const form = new FormData(); form.append('file', file)
  return { path: '/projects/p/datasets/upload', auth: 'session', method: 'POST', deferIfOffline: true, data: form } satisfies ApiRequestOptions
}

describe('persistent real API write queue', () => {
  it('requires explicit opt-in and rejects unrelated endpoints/fields', () => {
    expect(acceptsOfflineWrite(patch())).toBe(true)
    for (const input of [
      { ...patch(), deferIfOffline: false }, { ...patch(), data: { status: 'completed', expectedVersion: 1 } },
      { ...patch(), path: '/users/me/password' }, { ...deletion, path: '/projects/p/members/u' },
      { ...upload(), path: '/projects/p/analysis' },
    ]) expect(acceptsOfflineWrite(input)).toBe(false)
  })

  it('persists before network I/O, survives database reopen and replays through the real API port', async () => {
    const s = setup()
    const offline = createOfflineDataService({ cache: s.cache, access: s.access, writes: () => s.service })
    services.push(offline)
    const wrapped = offline.wrapApi({ request: s.request } as ApiClient)
    await expect(wrapped.request(patch())).rejects.toMatchObject({ code: 'OFFLINE_WRITE_QUEUED' })
    expect(s.request).not.toHaveBeenCalled()
    s.db.close(); await s.db.open()
    expect(await s.repository.list()).toHaveLength(1)
    s.online(); await s.service.sync()
    expect(s.request.mock.calls.map(([input]) => `${input.method ?? 'GET'} ${input.path}`)).toEqual(['GET /projects/p', 'PATCH /projects/p'])
    expect(await s.repository.list()).toHaveLength(0)
    expect(s.service.getSnapshot().revision).toBe(1)
  })

  it('automatically retries a backend outage while navigator remains online', async () => {
    const s = setup(); await s.service.enqueue(patch())
    s.request.mockRejectedValueOnce(outage()); s.online(); await s.service.sync()
    expect((await s.repository.list())[0]).toMatchObject({ state: 'queued', attempts: 0 })
    await vi.waitFor(async () => { expect(await s.repository.list()).toHaveLength(0) })
    expect(s.request.mock.calls.filter(([input]) => input.method === 'PATCH')).toHaveLength(1)
  })

  it('replays against real resource APIs without depending on the health endpoint', async () => {
    const s = setup(); await s.service.enqueue(patch())
    s.request.mockImplementation(async input => {
      if (input.path === '/health') throw outage()
      if (input.method === 'PATCH') return { project: { id: 'p', name: 'New', version: 2 } }
      return { project: { id: 'p', name: 'Old', version: 1 } }
    })
    s.online(); await s.service.sync()
    expect(s.request.mock.calls.map(([input]) => `${input.method ?? 'GET'} ${input.path}`)).toEqual([
      'GET /projects/p', 'PATCH /projects/p',
    ])
    expect(await s.repository.list()).toEqual([])
  })

  it('keeps a native Blob and sends multipart only when the backend returns', async () => {
    const s = setup(); await s.service.enqueue(upload())
    const command = (await s.repository.list())[0]?.command
    expect(command?.kind).toBe('upload')
    if (command?.kind !== 'upload') throw new Error('missing file')
    expect(await command.file.text()).toContain('1,2')
    s.request.mockImplementation(async input => input.path === '/health' ? health
      : input.method === 'POST' ? { dataset: { id: 'd' } } : { dataset: null })
    s.online(); await s.service.sync()
    const sent = s.request.mock.calls.find(([input]) => input.method === 'POST')?.[0].data as FormData
    expect(await (sent.get('file') as Blob).text()).toContain('1,2')
    expect(await s.repository.list()).toEqual([])
  })

  it('does not queue the same intent twice or store authorization', async () => {
    const s = setup()
    expect(await s.service.enqueue(patch())).toBe(await s.service.enqueue(patch()))
    expect(await s.repository.list()).toHaveLength(1)
    expect(JSON.stringify(await s.db.writes.toArray())).not.toMatch(/token|Authorization|Bearer/)
  })

  it('rebases consecutive edits only after acknowledgement and preserves order', async () => {
    const s = setup(); await s.service.enqueue(patch('First')); await s.service.enqueue(patch('Second'))
    let version = 1; let name = 'Old'
    s.request.mockImplementation(async input => {
      if (input.path === '/health') return health
      if (input.method === 'PATCH') {
        const body = input.data as { expectedVersion: number; name: string }
        expect(body.expectedVersion).toBe(version)
        version++; name = body.name
      }
      return { project: { id: 'p', name, version } }
    })
    s.online(); await s.service.sync()
    expect(name).toBe('Second'); expect(version).toBe(3)
    expect(await s.repository.list()).toEqual([])
  })

  it('blocks conflicting edits and never lets a following delete overtake them', async () => {
    const s = setup(); await s.service.enqueue(patch()); await s.service.enqueue(deletion)
    s.request.mockImplementation(async input => input.path === '/health' ? health : { project: { id: 'p', name: 'External', version: 3 } })
    s.online(); await s.service.sync()
    expect((await s.repository.list())[0]).toMatchObject({ state: 'blocked', attempts: 0 })
    expect(s.request.mock.calls.some(([input]) => input.method === 'PATCH' || input.method === 'DELETE')).toBe(false)
  })

  it.each([401, 403, 404, 409, 422])('holds an HTTP %s for review instead of retrying forever', async status => {
    const s = setup(); await s.service.enqueue(patch())
    s.request.mockImplementation(async input => {
      if (input.path === '/health') return health
      throw new ApiError({ kind: 'http', status, message: 'rejected' })
    })
    s.online(); await s.service.sync(); await s.service.sync()
    expect((await s.repository.list())[0]?.state).toBe('blocked')
    expect(s.request.mock.calls.filter(([input]) => input.path === '/projects/p')).toHaveLength(1)
  })

  it('reconciles a lost PATCH acknowledgement without a second mutation', async () => {
    const s = setup(); await s.service.enqueue(patch())
    let committed = false
    s.request.mockImplementation(async input => {
      if (input.path === '/health') return health
      if (input.method === 'PATCH') { committed = true; throw outage() }
      return { project: { id: 'p', name: committed ? 'New' : 'Old', version: committed ? 2 : 1 } }
    })
    s.online(); await s.service.sync()
    expect((await s.repository.list())[0]?.state).toBe('uncertain')
    await s.service.sync()
    expect(await s.repository.list()).toEqual([])
    expect(s.request.mock.calls.filter(([input]) => input.method === 'PATCH')).toHaveLength(1)
  })

  it('reconciles an already deleted object without repeating DELETE', async () => {
    const s = setup(); await s.service.enqueue(deletion, true)
    s.request.mockImplementation(async input => {
      if (input.path === '/health') return health
      throw new ApiError({ kind: 'http', status: 404, message: 'absent' })
    })
    s.online(); await s.service.sync()
    expect(await s.repository.list()).toEqual([])
    expect(s.request.mock.calls.some(([input]) => input.method === 'DELETE')).toBe(false)
  })

  it('matches a lost upload acknowledgement by file hash, never by filename alone', async () => {
    const s = setup(); await s.service.enqueue(upload(), true)
    s.request.mockImplementation(async input => input.path === '/health' ? health
      : input.responseType === 'blob' ? new Blob(['id,value\n1,2\n']) : { dataset: { id: 'd' } })
    s.online(); await s.service.sync()
    expect(await s.repository.list()).toEqual([])
    expect(s.request.mock.calls.some(([input]) => input.method === 'POST')).toBe(false)
  })

  it('does not blindly resend an ambiguous upload even after recheck', async () => {
    const s = setup(); const id = await s.service.enqueue(upload(), true)
    s.request.mockImplementation(async input => input.path === '/health' ? health : { dataset: null })
    s.online(); await s.service.sync(); await s.service.recheck(id)
    expect((await s.repository.list())[0]?.state).toBe('blocked')
    expect(s.request.mock.calls.some(([input]) => input.method === 'POST')).toBe(false)
  })

  it('recovers an interrupted sending state and retains ACK when local cleanup fails', async () => {
    const s = setup(); const id = await s.service.enqueue(patch())
    await s.repository.update(id, { state: 'sending', attempts: 1 })
    s.request.mockImplementation(async input => input.path === '/health' ? health : { project: { id: 'p', name: 'New', version: 2 } })
    s.confirmed.mockRejectedValueOnce(new Error('disk busy'))
    s.online(); await s.service.sync()
    expect((await s.repository.list())[0]?.state).toBe('confirmed')
    await s.service.sync()
    expect(await s.repository.list()).toEqual([])
    expect(s.request.mock.calls.some(([input]) => input.method === 'PATCH')).toBe(false)
  })

  it('isolates accounts and namespaces, retaining the original account queue', async () => {
    const s = setup(); await s.service.enqueue(patch())
    s.change({ accountId: 'b', generation: 2, expiresAtMs: 100000 }); s.online(); await s.service.sync()
    expect(await s.repository.list()).toEqual([])
    expect(s.request).not.toHaveBeenCalled()
    const other = createOfflineWriteRepository({ db: s.db, access: s.access, namespace: 'another', now: () => 1000 })
    s.change({ accountId: 'a', generation: 3, expiresAtMs: 100000 })
    expect(await other.list()).toEqual([])
    expect(await s.repository.list()).toHaveLength(1)
  })

  it('stops an in-flight preflight after switching accounts', async () => {
    const s = setup(); await s.service.enqueue(patch())
    let resolve!: (value: unknown) => void
    s.request.mockImplementation(async input => input.path === '/health' ? health : new Promise(done => { resolve = done }))
    s.online(); const syncing = s.service.sync()
    await vi.waitFor(() => { expect(resolve).toBeTypeOf('function') })
    s.change({ accountId: 'b', generation: 2, expiresAtMs: 100000 })
    resolve({ project: { id: 'p', name: 'Old', version: 1 } }); await syncing
    expect(s.request.mock.calls.some(([input]) => input.method === 'PATCH')).toBe(false)
  })

  it('never replays an expired session or an unvalidated session', async () => {
    const s = setup(); await s.service.enqueue(patch()); s.setTime(100001); s.online(); await s.service.sync()
    expect(s.request).not.toHaveBeenCalled()
    s.setTime(1000); s.prepare.mockResolvedValue(false); await s.service.sync()
    expect(s.request.mock.calls.some(([input]) => input.method === 'PATCH')).toBe(false)
    expect(await s.repository.list()).toHaveLength(1)
  })

  it('rejects oversized files and leaves the queue untouched', async () => {
    const s = setup()
    const file = new Blob([new Uint8Array(50 * 1024 * 1024 + 1)])
    await expect(s.repository.add({ kind: 'upload', resource: 'projects', resourceId: 'p', file, fileName: 'big.csv', mimeType: '', hash: await hashFile(new Blob(['x'])) }, 'large')).rejects.toMatchObject({ kind: 'storage' })
    expect(await s.repository.list()).toEqual([])
  })

  it('does not send or issue a pending receipt if IndexedDB cannot save the intent', async () => {
    const s = setup()
    vi.spyOn(s.repository, 'add').mockRejectedValueOnce(new ApiError({ kind: 'storage', message: 'disk full' }))
    const offline = createOfflineDataService({ cache: s.cache, access: s.access, writes: () => s.service })
    services.push(offline)
    s.online()
    await expect(offline.wrapApi({ request: s.request } as ApiClient).request(patch())).rejects.toMatchObject({ kind: 'storage' })
    expect(s.request).not.toHaveBeenCalled(); expect(await s.repository.list()).toEqual([])
  })

  it('serializes two runtime instances through the same lock without repeating a write', async () => {
    const s = setup(); s.service.dispose()
    let locked = false
    const lock = async (_name: string, work: () => Promise<void>) => {
      if (locked) return
      locked = true
      try { await work() } finally { locked = false }
    }
    const first = s.makeService(lock); const second = s.makeService(lock)
    await first.enqueue(patch()); s.online()
    await Promise.all([first.sync(), second.sync()])
    expect(s.request.mock.calls.filter(([input]) => input.method === 'PATCH')).toHaveLength(1)
    expect(await s.repository.list()).toEqual([])
  })

  it('reconciles an incomplete successful response before deleting the intent', async () => {
    const s = setup(); await s.service.enqueue(patch())
    let committed = false
    s.request.mockImplementation(async input => {
      if (input.path === '/health') return health
      if (input.method === 'PATCH') { committed = true; return {} }
      return { project: { id: 'p', name: committed ? 'New' : 'Old', version: committed ? 2 : 1 } }
    })
    s.online(); await s.service.sync()
    expect((await s.repository.list())[0]?.state).toBe('uncertain')
    await s.service.sync()
    expect(await s.repository.list()).toEqual([])
    expect(s.request.mock.calls.filter(([input]) => input.method === 'PATCH')).toHaveLength(1)
  })

  it('holds an upload when the server file has different content', async () => {
    const s = setup(); await s.service.enqueue(upload(), true)
    s.request.mockImplementation(async input => input.path === '/health' ? health
      : input.responseType === 'blob' ? new Blob(['different content']) : { dataset: { id: 'd' } })
    s.online(); await s.service.sync()
    expect((await s.repository.list())[0]?.state).toBe('blocked')
    expect(s.request.mock.calls.some(([input]) => input.method === 'POST')).toBe(false)
  })
})
