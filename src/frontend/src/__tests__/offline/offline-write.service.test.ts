/// <reference types="node" />
import 'fake-indexeddb/auto'
import { File as NodeFile } from 'node:buffer'
import { afterEach, expect, it } from 'vitest'
import { ApiError } from '../../lib/api-error'
import { ApiTargetManager } from '../../lib/api-target-manager'
import { OfflineWriteDatabase } from '../../repositories/offline/offline-write.database'
import { createOfflineWriteRepository } from '../../repositories/offline/offline-write.repository'
import { UploadDraftDatabase } from '../../repositories/datasets/upload-draft.database'
import { createUploadDraftRepository } from '../../repositories/datasets/upload-draft.repository'
import { createOfflineWriteService } from '../../services/offline/offline-write.service'
import type { ApiClient, ApiRequestOptions, DraftAccess } from '../../types'

const writeDatabases: OfflineWriteDatabase[] = []
const draftDatabases: UploadDraftDatabase[] = []
const services: Array<ReturnType<typeof createOfflineWriteService>> = []
const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
const originalOnline = Object.getOwnPropertyDescriptor(navigator, 'onLine')
const originalFile = Object.getOwnPropertyDescriptor(globalThis, 'File')
const originalFormData = Object.getOwnPropertyDescriptor(globalThis, 'FormData')

afterEach(async () => {
  for (const service of services.splice(0)) service.dispose()
  for (const database of writeDatabases.splice(0)) await database.delete()
  for (const database of draftDatabases.splice(0)) await database.delete()
  if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks)
  else Reflect.deleteProperty(navigator, 'locks')
  if (originalOnline) Object.defineProperty(navigator, 'onLine', originalOnline)
  if (originalFile) Object.defineProperty(globalThis, 'File', originalFile)
  else Reflect.deleteProperty(globalThis, 'File')
  if (originalFormData) Object.defineProperty(globalThis, 'FormData', originalFormData)
  else Reflect.deleteProperty(globalThis, 'FormData')
})

const setOnline = (online: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
const access = { read: (): DraftAccess => ({ accountId: 'account-a', generation: 1, expiresAtMs: Date.now() + 60_000 }), subscribe: () => () => {} }
const mockLocks = { request: async <T,>(_name: string, _options: { mode: 'exclusive'; ifAvailable?: boolean }, callback: (lock: object | null) => Promise<T>) => callback({}) }

const fixture = async (api: ApiClient, environmentId = 'qa-main') => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: mockLocks })
  const namespace = `environment:${environmentId}`
  const writeDatabase = new OfflineWriteDatabase(`offline-write-test-${crypto.randomUUID()}`)
  const draftDatabase = new UploadDraftDatabase(`offline-draft-test-${crypto.randomUUID()}`)
  writeDatabases.push(writeDatabase)
  draftDatabases.push(draftDatabase)
  const drafts = createUploadDraftRepository({ db: draftDatabase, access, estimate: async () => ({}) })
  const repository = createOfflineWriteRepository({ db: writeDatabase, access, namespace })
  const targetManager = new ApiTargetManager({ baseUrl: 'https://old.example.test', prefix: '/api/v1', environmentId })
  const service = createOfflineWriteService({ repository, api, drafts, targetManager, namespace,
    isSessionReady: () => true, recoverSession: async () => {}, intervalMs: 60_000, confirmedRetentionMs: 100 })
  services.push(service)
  await targetManager.setSessionReady(true)
  return { service, drafts, repository, writeDatabase, draftDatabase, targetManager }
}

it('rejects writes outside the exact allowlist before touching the API', async () => {
  setOnline(false)
  const api: ApiClient = { request: async () => { throw new Error('must not send') } }
  const state = await fixture(api)
  await expect(state.service.enqueue({ path: '/workspaces', method: 'POST', auth: 'session', deferIfOffline: true, data: { name: 'new' } }))
    .rejects.toMatchObject({ code: 'OFFLINE_WRITE_NOT_ALLOWLISTED' })
  await expect(state.repository.list()).resolves.toEqual([])
})

it('reconciles a lost upload response by backend SHA-256 and cleans the queue without a duplicate POST', async () => {
  setOnline(false)
  // jsdom's File does not survive structured clone; Node's native File models the
  // durable Blob/File behavior used by browser IndexedDB.
  class TestFormData {
    private readonly values: Array<[string, File]> = []
    append(name: string, value: File) { this.values.push([name, value]) }
    entries() { return this.values[Symbol.iterator]() }
  }
  Object.defineProperty(globalThis, 'File', { configurable: true, value: NodeFile })
  Object.defineProperty(globalThis, 'FormData', { configurable: true, value: TestFormData })
  const file = new NodeFile(['id,value\n1,2'], 'sample.csv', { type: 'text/csv' }) as unknown as File
  let backendDataset: Record<string, unknown> | null = null
  let expectedHash = ''
  let postCount = 0
  const apiCalls: string[] = []
  const api: ApiClient = { request: async <T,>(request: ApiRequestOptions): Promise<T> => {
    apiCalls.push(`${request.method ?? 'GET'} ${request.path}`)
    if (request.path === '/projects/p1/datasets' && request.method !== 'POST') {
      return { dataset: backendDataset } as T
    }
    if (request.path === '/projects/p1/datasets/upload' && request.method === 'POST') {
      postCount += 1
      backendDataset = {
        id: 'dataset-1', projectId: 'p1', accountId: 'account-a', originalFileName: file.name,
        fileSizeBytes: file.size, sha256: expectedHash,
      }
      throw new ApiError({ kind: 'network', message: 'Response lost after server received upload' })
    }
    throw new Error(`Unexpected API request: ${request.method} ${request.path}`)
  } }
  const state = await fixture(api)
  const draft = await state.drafts.save({ projectId: 'p1', file })
  expectedHash = draft.fileHash ?? ''
  const form = new TestFormData()
  form.append('file', file)
  const receipt = await state.service.enqueue({ path: '/projects/p1/datasets/upload', method: 'POST', auth: 'session',
    deferIfOffline: true, deferredDraftId: draft.id, data: form as unknown as FormData })
  expect(receipt).toMatchObject({ kind: 'offline-write-receipt', state: 'queued' })
  expect(await state.drafts.list()).toMatchObject([{ id: draft.id, status: 'queued', queueId: receipt.queueId }])

  setOnline(true)
  await state.service.sync()
  await state.service.refresh()
  const queuedCommand = (await state.repository.list())[0]?.command
  expect(queuedCommand?.kind === 'upload' ? queuedCommand.file.size : -1).toBe(file.size)
  expect(postCount).toBe(1)
  expect(state.service.getSnapshot().entries).toMatchObject([{ id: receipt.queueId, state: 'uncertain', fileName: 'sample.csv' }])
  expect(await state.drafts.list()).toMatchObject([{ id: draft.id, status: 'uploading' }])

  await state.service.sync()
  await state.service.refresh()
  expect(apiCalls.filter(call => call === 'POST /projects/p1/datasets/upload')).toHaveLength(1)
  expect(postCount).toBe(1)
  expect(await state.drafts.list()).toEqual([])
  expect(state.service.getSnapshot().entries).toMatchObject([{ id: receipt.queueId, state: 'confirmed' }])
  await new Promise(resolve => setTimeout(resolve, 150))
  await state.service.refresh()
  expect(state.service.getSnapshot().entries).toEqual([])
})
