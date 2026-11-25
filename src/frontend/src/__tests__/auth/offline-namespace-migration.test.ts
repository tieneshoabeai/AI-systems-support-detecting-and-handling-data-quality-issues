/// <reference types="node" />
import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OfflineReadDatabase } from '../../repositories/offline/offline-read.database'
import { OfflineWriteDatabase } from '../../repositories/offline/offline-write.database'
import { migrateOfflineNamespace } from '../../services/offline/offline-namespace-migration'

const databases: (OfflineReadDatabase | OfflineWriteDatabase)[] = []
beforeEach(() => { vi.stubGlobal('Blob', NodeBlob); vi.stubGlobal('crypto', webcrypto) })
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete()
  vi.unstubAllGlobals()
})

describe('offline namespace migration', () => {
  it('moves the selected account cache and ordered queue with upload Blob/state intact, idempotently', async () => {
    const reads = new OfflineReadDatabase(`migration-reads-${crypto.randomUUID()}`)
    const writes = new OfflineWriteDatabase(`migration-writes-${crypto.randomUUID()}`)
    databases.push(reads, writes)
    const file = new Blob(['csv payload'], { type: 'text/csv' })
    await reads.reads.bulkPut([
      { accountId: 'account-a', namespace: 'old-api', key: 'projects', payload: { items: ['one'] }, savedAt: 4, bytes: 20 },
      { accountId: 'account-b', namespace: 'old-api', key: 'private', payload: { items: ['other'] }, savedAt: 5, bytes: 20 },
    ])
    await writes.writes.bulkAdd([
      { id: 'first', accountId: 'account-a', namespace: 'old-api', command: { kind: 'patch', resource: 'projects', resourceId: 'p', fields: { name: 'Saved' }, expectedVersion: 2 }, state: 'queued', label: 'Edit project', createdAt: 10, bytes: 20, attempts: 0 },
      { id: 'upload', accountId: 'account-a', namespace: 'old-api', command: { kind: 'upload', resource: 'projects', resourceId: 'p', file, fileName: 'data.csv', mimeType: 'text/csv', hash: 'abc' }, state: 'uncertain', label: 'Upload data.csv', createdAt: 11, bytes: file.size, attempts: 1 },
    ])

    const options = { reads, writes, accountId: 'account-a', target: 'environment:qa-main', sources: ['old-api'], isCurrent: () => true }
    await expect(migrateOfflineNamespace(options)).resolves.toEqual({ movedReads: 1, movedWrites: 2, conflicts: 0 })
    const cache = await reads.reads.toArray()
    expect(cache).toContainEqual(expect.objectContaining({ accountId: 'account-a', namespace: 'environment:qa-main', key: 'projects' }))
    expect(cache).toContainEqual(expect.objectContaining({ accountId: 'account-b', namespace: 'old-api', key: 'private' }))
    const queue = await writes.writes.orderBy('sequence').toArray()
    expect(queue.map(row => [row.id, row.namespace, row.state])).toEqual([
      ['first', 'environment:qa-main', 'queued'], ['upload', 'environment:qa-main', 'uncertain'],
    ])
    const upload = queue[1]
    expect(upload?.command.kind).toBe('upload')
    if (upload?.command.kind === 'upload') await expect(upload.command.file.text()).resolves.toBe('csv payload')
    await expect(migrateOfflineNamespace(options)).resolves.toEqual({ movedReads: 0, movedWrites: 0, conflicts: 0 })
    expect((await writes.writes.orderBy('sequence').toArray()).map(row => row.id)).toEqual(['first', 'upload'])
  })

  it('leaves a cache conflict and all other namespaces untouched', async () => {
    const reads = new OfflineReadDatabase(`migration-reads-${crypto.randomUUID()}`)
    const writes = new OfflineWriteDatabase(`migration-writes-${crypto.randomUUID()}`)
    databases.push(reads, writes)
    await reads.reads.bulkPut([
      { accountId: 'account-a', namespace: 'old-api', key: 'projects', payload: { version: 1 }, savedAt: 1, bytes: 10 },
      { accountId: 'account-a', namespace: 'other-api', key: 'projects', payload: { version: 3 }, savedAt: 3, bytes: 10 },
      { accountId: 'account-a', namespace: 'environment:qa-main', key: 'projects', payload: { version: 2 }, savedAt: 2, bytes: 10 },
    ])
    await expect(migrateOfflineNamespace({ reads, writes, accountId: 'account-a', target: 'environment:qa-main', sources: ['old-api'], isCurrent: () => true }))
      .resolves.toEqual({ movedReads: 0, movedWrites: 0, conflicts: 1 })
    expect(await reads.reads.get(['account-a', 'old-api', 'projects'])).toBeDefined()
    expect(await reads.reads.get(['account-a', 'other-api', 'projects'])).toBeDefined()
  })
})
