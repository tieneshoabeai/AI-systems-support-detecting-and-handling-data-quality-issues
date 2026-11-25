import type { OfflineReadDatabase } from '../../repositories/offline/offline-read.database'
import type { OfflineWriteDatabase } from '../../repositories/offline/offline-write.database'

export type OfflineMigrationResult = { movedReads: number; movedWrites: number; conflicts: number; unlistedNamespaces: number }

const sameValue = (left: unknown, right: unknown) => {
  try { return JSON.stringify(left) === JSON.stringify(right) } catch { return false }
}

/** Move only this account's rows from explicitly selected URL namespaces. */
export async function migrateOfflineNamespace(options: {
  reads: OfflineReadDatabase
  writes: OfflineWriteDatabase
  accountId: string
  target: string
  sources: readonly string[]
  isCurrent: () => boolean
  lock?: (name: string, work: () => Promise<void>) => Promise<void>
}): Promise<OfflineMigrationResult> {
  const { reads, writes, accountId, target, isCurrent } = options
  let movedReads = 0
  let movedWrites = 0
  let conflicts = 0
  const knownNamespaces = new Set([target, ...options.sources])

  for (const source of new Set(options.sources)) {
    if (source === target) continue
    if (!isCurrent()) throw new Error('Phiên dữ liệu đã thay đổi trong lúc chuyển dữ liệu offline.')
    // The old frontend uses this same lock while replaying this URL namespace.
    // Wait for it before changing namespace so an in-flight write can finish.
    const lock = options.lock ?? (async (_name: string, work: () => Promise<void>) => work())
    await lock(`offline-writes:${source}:${accountId}`, async () => {
      await reads.transaction('rw', reads.reads, async () => {
        const oldRows = await reads.reads.where('[accountId+namespace]').equals([accountId, source]).toArray()
        for (const oldRow of oldRows) {
          if (!isCurrent()) throw new Error('Phiên dữ liệu đã thay đổi trong lúc chuyển dữ liệu offline.')
          const existing = await reads.reads.get([accountId, target, oldRow.key])
          if (existing) {
            if (sameValue(existing.payload, oldRow.payload)) {
              await reads.reads.delete([accountId, source, oldRow.key])
              movedReads += 1
            } else conflicts += 1
            continue
          }
          await reads.reads.put({ ...oldRow, namespace: target })
          await reads.reads.delete([accountId, source, oldRow.key])
          movedReads += 1
        }
      })

      await writes.transaction('rw', writes.writes, async () => {
        const oldRows = await writes.writes.where('[accountId+namespace]').equals([accountId, source]).toArray()
        for (const oldRow of oldRows) {
          if (!isCurrent()) throw new Error('Phiên dữ liệu đã thay đổi trong lúc chuyển dữ liệu offline.')
          const existing = await writes.writes.where('id').equals(oldRow.id).first()
          // IDs are unique in this DB. A different row with the same ID is left
          // untouched and reported; never replace pending user work silently.
          if (existing && existing.sequence !== oldRow.sequence) { conflicts += 1; continue }
          await writes.writes.put({ ...oldRow, namespace: target })
          movedWrites += 1
        }
      })
    })
  }
  const [allReads, allWrites] = await Promise.all([
    reads.reads.where('accountId').equals(accountId).toArray(),
    writes.writes.where('accountId').equals(accountId).toArray(),
  ])
  const unlisted = new Set([...allReads, ...allWrites]
    .map(row => row.namespace).filter(value => !knownNamespaces.has(value)))
  return { movedReads, movedWrites, conflicts, unlistedNamespaces: unlisted.size }
}
