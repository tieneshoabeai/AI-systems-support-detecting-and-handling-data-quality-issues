/// <reference types="node" />
import 'fake-indexeddb/auto'
import { File as NodeFile } from 'node:buffer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UPLOAD_DRAFT_LIMITS } from '../../configs/upload-draft.config'
import { UploadDraftDatabase } from '../../repositories/datasets/upload-draft.database'
import { createUploadDraftRepository } from '../../repositories/datasets/upload-draft.repository'
import type { DraftAccess, UploadDraft } from '../../types/datasets/upload-draft.types'

const databases: UploadDraftDatabase[] = []
afterEach(async () => { for (const db of databases.splice(0)) await db.delete() })

const file = () => new NodeFile(['a,b\n1,2'], 'test.csv', { type: 'text/csv', lastModified: 10 }) as unknown as File
const setup = () => {
  const db = new UploadDraftDatabase(`draft-test-${crypto.randomUUID()}`)
  databases.push(db)
  let current: DraftAccess | null = { accountId: 'a', generation: 1, expiresAtMs: 2000 }
  const listeners = new Set<() => void>()
  const access = { read: () => current, subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } } }
  const change = (next: DraftAccess | null) => { current = next; listeners.forEach(fn => fn()) }
  const repository = createUploadDraftRepository({ db, access, now: () => 1000, estimate: async () => ({}) })
  return { db, repository, change, access }
}

const metadata = (accountId: string, sizeBytes: number): UploadDraft => ({
  id: crypto.randomUUID(), accountId, sizeBytes, projectId: 'p', fileName: 'seed.csv',
  mimeType: 'text/csv', lastModified: 0, createdAtMs: 0, status: 'pending',
})

describe('account-scoped upload drafts', () => {
  it('commits Blob and metadata and restores after reopening the database', async () => {
    const s = setup()
    const draft = await s.repository.save({ projectId: 'p', file: file() })
    expect(draft).toMatchObject({ accountId: 'a', status: 'pending', sizeBytes: 7 })
    expect(await (await s.repository.readFile(draft.id)).text()).toBe('a,b\n1,2')
    s.db.close()
    await s.db.open()
    expect(await s.repository.list()).toEqual([draft])
  })

  it('retains drafts on logout, denies public access, and isolates account B', async () => {
    const s = setup()
    const draft = await s.repository.save({ projectId: 'p', file: file() })
    s.change(null)
    await expect(s.repository.list()).rejects.toMatchObject({ kind: 'session' })
    expect(await s.db.drafts.count()).toBe(1)
    s.change({ accountId: 'b', generation: 2, expiresAtMs: 2000 })
    expect(await s.repository.list()).toEqual([])
    await expect(s.repository.readFile(draft.id)).rejects.toMatchObject({ code: 'DRAFT_NOT_FOUND' })
    await expect(s.repository.remove(draft.id)).rejects.toMatchObject({ code: 'DRAFT_NOT_FOUND' })
    s.change({ accountId: 'a', generation: 3, expiresAtMs: 2000 })
    expect(await s.repository.list()).toEqual([draft])
  })

  it('blocks exactly at expiry', async () => {
    const s = setup()
    s.change({ accountId: 'a', generation: 1, expiresAtMs: 1000 })
    await expect(s.repository.save({ projectId: 'p', file: file() })).rejects.toMatchObject({ kind: 'session' })
    expect(await s.db.drafts.count()).toBe(0)
  })

  it('rejects zero-size and oversized files before writing', async () => {
    const s = setup()
    const big = file()
    Object.defineProperty(big, 'size', { value: UPLOAD_DRAFT_LIMITS.fileBytes + 1 })
    await expect(s.repository.save({ projectId: 'p', file: big })).rejects.toMatchObject({ code: 'DRAFT_FILE_LIMIT' })
    const empty = new NodeFile([], 'empty.csv') as unknown as File
    await expect(s.repository.save({ projectId: 'p', file: empty })).rejects.toMatchObject({ code: 'DRAFT_INVALID_INPUT' })
    expect(await s.db.files.count()).toBe(0)
  })

  it('accepts the file size boundary without changing its bytes', async () => {
    const s = setup()
    const boundary = new NodeFile([new Uint8Array(UPLOAD_DRAFT_LIMITS.fileBytes)], 'boundary.csv') as unknown as File
    const saved = await s.repository.save({ projectId: 'p', file: boundary })
    expect(saved.sizeBytes).toBe(UPLOAD_DRAFT_LIMITS.fileBytes)
  })

  it('accepts account boundary and rejects the next write', async () => {
    const s = setup()
    await s.db.drafts.add(metadata('a', UPLOAD_DRAFT_LIMITS.accountBytes - file().size))
    await s.repository.save({ projectId: 'p', file: file() })
    await expect(s.repository.save({ projectId: 'p', file: file() })).rejects.toMatchObject({ code: 'DRAFT_ACCOUNT_LIMIT' })
  })

  it('enforces application total across accounts', async () => {
    const s = setup()
    await s.db.drafts.add(metadata('other', UPLOAD_DRAFT_LIMITS.totalBytes))
    await expect(s.repository.save({ projectId: 'p', file: file() })).rejects.toMatchObject({ code: 'DRAFT_TOTAL_LIMIT' })
    expect(await s.db.files.count()).toBe(0)
  })

  it('accepts the exact application cap then rejects more data', async () => {
    const s = setup()
    await s.db.drafts.add(metadata('other', UPLOAD_DRAFT_LIMITS.totalBytes - file().size))
    await s.repository.save({ projectId: 'p', file: file() })
    await expect(s.repository.save({ projectId: 'p', file: file() })).rejects.toMatchObject({ code: 'DRAFT_TOTAL_LIMIT' })
  })

  it('serializes concurrent quota checks across database connections', async () => {
    const s = setup()
    const otherDb = new UploadDraftDatabase(s.db.name)
    await s.db.drafts.add(metadata('a', UPLOAD_DRAFT_LIMITS.accountBytes - file().size))
    const other = createUploadDraftRepository({ db: otherDb, access: s.access, now: () => 1000, estimate: async () => ({}) })
    try {
      const results = await Promise.allSettled([
        s.repository.save({ projectId: 'p', file: file() }), other.save({ projectId: 'p', file: file() }),
      ])
      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
      expect(results.filter(r => r.status === 'rejected')).toHaveLength(1)
    } finally { otherDb.close() }
  })

  it('rolls back metadata when the file write fails with quota error', async () => {
    const s = setup()
    s.db.files.hook('creating', () => { throw new DOMException('full', 'QuotaExceededError') })
    await expect(s.repository.save({ projectId: 'p', file: file() })).rejects.toMatchObject({ kind: 'storage' })
    expect(await s.db.drafts.count()).toBe(0)
    expect(await s.db.files.count()).toBe(0)
  })

  it('uses estimate as preflight and still allows storage when estimate is unavailable', async () => {
    const s = setup()
    const blocked = createUploadDraftRepository({ db: s.db, access: s.access, now: () => 1000, estimate: async () => ({ quota: 5, usage: 4 }) })
    await expect(blocked.save({ projectId: 'p', file: file() })).rejects.toMatchObject({ code: 'DRAFT_DEVICE_QUOTA' })
    const unavailable = createUploadDraftRepository({ db: s.db, access: s.access, now: () => 1000, estimate: async () => { throw new Error('unsupported') } })
    await expect(unavailable.save({ projectId: 'p', file: file() })).resolves.toMatchObject({ status: 'pending' })
  })

  it('rejects a stale save if logout occurs during storage estimation', async () => {
    const s = setup()
    const stale = createUploadDraftRepository({ db: s.db, access: s.access, now: () => 1000, estimate: async () => { s.change(null); return {} } })
    await expect(stale.save({ projectId: 'p', file: file() })).rejects.toMatchObject({ kind: 'session' })
    expect(await s.db.drafts.count()).toBe(0)
  })

  it('aborts an in-flight transaction on account change', async () => {
    const s = setup()
    s.db.files.hook('creating', () => { s.change({ accountId: 'b', generation: 2, expiresAtMs: 2000 }) })
    await expect(s.repository.save({ projectId: 'p', file: file() })).rejects.toMatchObject({ kind: 'session' })
    expect(await s.db.drafts.count()).toBe(0)
  })

  it('requires matching backend confirmation before removing file and metadata', async () => {
    const s = setup()
    const draft = await s.repository.save({ projectId: 'p', file: file() })
    await expect(s.repository.confirmUploaded(draft.id, { accountId: 'b', projectId: 'p', datasetId: 'd' })).rejects.toMatchObject({ code: 'DRAFT_CONFIRMATION_MISMATCH' })
    expect(await s.repository.confirmUploaded(draft.id, { accountId: 'a', projectId: 'p', datasetId: 'd' })).toEqual({ cleaned: true })
    expect(await s.db.drafts.count()).toBe(0)
    expect(await s.db.files.count()).toBe(0)
  })

  it('retains the ACK and blocks re-upload when cleanup fails, then retries cleanup only', async () => {
    const s = setup()
    const draft = await s.repository.save({ projectId: 'p', file: file() })
    const failDelete = vi.spyOn(s.db.files, 'delete').mockRejectedValueOnce(new Error('disk failure'))
    expect(await s.repository.confirmUploaded(draft.id, { accountId: 'a', projectId: 'p', datasetId: 'd' })).toEqual({ cleaned: false })
    expect((await s.repository.list())[0]).toMatchObject({ status: 'uploaded', datasetId: 'd' })
    await expect(s.repository.readFile(draft.id)).rejects.toMatchObject({ code: 'DRAFT_ALREADY_UPLOADED' })
    failDelete.mockRestore()
    expect(await s.repository.cleanupUploaded()).toBe(1)
    expect(await s.db.files.count()).toBe(0)
    expect(await s.repository.list()).toEqual([])
  })

  it('does not delete the file when recording the backend ACK fails', async () => {
    const s = setup()
    const draft = await s.repository.save({ projectId: 'p', file: file() })
    vi.spyOn(s.db.drafts, 'put').mockRejectedValueOnce(new Error('ACK journal failure'))
    await expect(s.repository.confirmUploaded(draft.id, { accountId: 'a', projectId: 'p', datasetId: 'd' }))
      .rejects.toMatchObject({ kind: 'storage' })
    expect((await s.repository.list())[0].status).toBe('pending')
    expect(await s.db.files.get(draft.id)).toBeDefined()
  })

  it('rolls back file deletion if deleting metadata fails', async () => {
    const s = setup()
    const draft = await s.repository.save({ projectId: 'p', file: file() })
    vi.spyOn(s.db.drafts, 'delete').mockRejectedValueOnce(new Error('metadata cleanup failure'))
    expect(await s.repository.confirmUploaded(draft.id, { accountId: 'a', projectId: 'p', datasetId: 'd' }))
      .toEqual({ cleaned: false })
    expect((await s.repository.list())[0].status).toBe('uploaded')
    expect(await s.db.files.get(draft.id)).toBeDefined()
  })

  it('cleanup leaves pending files and other accounts intact', async () => {
    const s = setup()
    const pending = await s.repository.save({ projectId: 'p', file: file() })
    const own = { ...metadata('a', 1), status: 'uploaded' as const, datasetId: 'd' }
    const other = { ...metadata('b', 1), status: 'uploaded' as const, datasetId: 'e' }
    await s.db.drafts.bulkAdd([own, other])
    await s.db.files.bulkAdd([{ id: own.id, blob: file() }, { id: other.id, blob: file() }])
    expect(await s.repository.cleanupUploaded()).toBe(1)
    expect(await s.repository.list()).toEqual([pending])
    expect(await s.db.drafts.get(other.id)).toEqual(other)
    expect(await s.db.files.get(other.id)).toBeDefined()
  })
})
