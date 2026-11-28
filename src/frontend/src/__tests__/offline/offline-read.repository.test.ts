/// <reference types="node" />
import 'fake-indexeddb/auto'
import { afterEach, expect, it } from 'vitest'
import type { DraftAccess } from '../../types/datasets/upload-draft.types'
import { OfflineReadDatabase } from '../../repositories/offline/offline-read.database'
import { createOfflineReadRepository } from '../../repositories/offline/offline-read.repository'

const databases: OfflineReadDatabase[] = []
afterEach(async () => { for (const database of databases.splice(0)) await database.delete() })

const setup = () => {
  const database = new OfflineReadDatabase(`offline-read-test-${crypto.randomUUID()}`)
  databases.push(database)
  let scope: DraftAccess | null = { accountId: 'account-a', generation: 1, expiresAtMs: Date.now() + 60_000 }
  const access = { read: () => scope, subscribe: (_listener: () => void) => () => {} }
  return {
    database,
    access,
    change: (next: DraftAccess | null) => { scope = next },
    repository: (namespace: string) => createOfflineReadRepository({ db: database, access, namespace }),
  }
}

it('persists cache across repository/runtime reopen and isolates account plus EnvironmentId', async () => {
  const state = setup()
  const qa = state.repository('environment:qa-main')
  const prod = state.repository('environment:production')
  await qa.save('workspaces', { items: ['qa'] }, 12)
  await prod.save('workspaces', { items: ['prod'] }, 14)
  state.database.close()
  await state.database.open()
  await expect(qa.read('workspaces')).resolves.toMatchObject({ payload: { items: ['qa'] } })
  state.change({ accountId: 'account-b', generation: 2, expiresAtMs: Date.now() + 60_000 })
  await expect(qa.read('workspaces')).resolves.toBeUndefined()
  await expect(qa.list()).resolves.toEqual([])
  await expect(prod.read('workspaces')).resolves.toBeUndefined()
  state.change({ accountId: 'account-a', generation: 3, expiresAtMs: Date.now() + 60_000 })
  await expect(qa.read('workspaces')).resolves.toMatchObject({ payload: { items: ['qa'] } })
  await qa.clear()
  await expect(qa.list()).resolves.toEqual([])
  await expect(prod.read('workspaces')).resolves.toMatchObject({ payload: { items: ['prod'] } })
})

it('enforces entry size and clears only the captured account after session changes', async () => {
  const state = setup()
  const qa = state.repository('environment:qa-main')
  await expect(qa.save('large', {}, 50 * 1024 * 1024 + 1)).rejects.toMatchObject({ kind: 'storage' })
  await qa.save('small', { ok: true }, 10)
  state.change(null)
  await expect(qa.clear()).rejects.toMatchObject({ kind: 'session' })
  expect(await state.database.reads.count()).toBe(1)
})
