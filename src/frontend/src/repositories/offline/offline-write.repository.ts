import { ApiError } from '../../lib/api-error'
import type { DraftAccess, DraftAccessPort } from '../../types/datasets/upload-draft.types'
import type { OfflineWrite, OfflineWriteCommand } from '../../types/offline/offline-write.types'
import type { OfflineWriteDatabase } from './offline-write.database'

const maxBytes = 100 * 1024 * 1024
const maxEntries = 100
const maxFileBytes = 50 * 1024 * 1024
const resourceKey = (command: OfflineWriteCommand) => `${command.resource}/${command.resourceId}`
const fingerprint = (command: OfflineWriteCommand) => command.kind === 'upload'
  ? `${resourceKey(command)}:${command.kind}:${command.fileName}:${command.hash}:${command.draftId}`
  : JSON.stringify(command)

export function createOfflineWriteRepository(options: {
  db: OfflineWriteDatabase
  access: DraftAccessPort
  namespace: string
  now?: () => number
}) {
  const { db, access, namespace } = options
  const now = options.now ?? Date.now
  const current = (): DraftAccess => {
    const scope = access.read()
    if (!scope || scope.expiresAtMs <= now()) {
      throw new ApiError({ kind: 'session', message: 'Cần phiên đăng nhập hợp lệ để đồng bộ thay đổi.' })
    }
    return { ...scope }
  }
  const check = (captured: DraftAccess) => {
    const scope = current()
    if (scope.accountId !== captured.accountId || scope.generation !== captured.generation) {
      throw new ApiError({ kind: 'session', message: 'Tài khoản hoặc phiên đồng bộ đã thay đổi.' })
    }
  }
  const transact = async <T>(work: (scope: DraftAccess) => Promise<T>): Promise<T> => {
    const captured = current()
    let unsubscribe: (() => void) | undefined
    try {
      return await db.transaction('rw', db.writes, async tx => {
        unsubscribe = access.subscribe(() => { try { check(captured) } catch { tx.abort() } })
        check(captured)
        const value = await work(captured)
        check(captured)
        return value
      })
    } finally {
      unsubscribe?.()
      check(captured)
    }
  }
  const rows = (scope: DraftAccess) => db.writes.where('[accountId+namespace]').equals([scope.accountId, namespace]).sortBy('sequence')
  const isDuplicate = (row: OfflineWrite, command: OfflineWriteCommand) => fingerprint(row.command) === fingerprint(command)
    && (row.state !== 'confirmed' || (command.kind === 'upload' && row.command.kind === 'upload'))
  const owned = async (id: string, scope: DraftAccess) => {
    const row = await db.writes.where('id').equals(id).first()
    if (!row || row.accountId !== scope.accountId || row.namespace !== namespace) {
      throw new ApiError({ kind: 'storage', message: 'Không tìm thấy yêu cầu trong tài khoản hiện tại.' })
    }
    return row
  }

  return {
    scope: current,
    list: () => transact(rows),
    findDuplicate: (command: OfflineWriteCommand) => transact(async scope =>
      (await rows(scope)).find(row => isDuplicate(row, command))?.id ?? null),

    async add(command: OfflineWriteCommand, label: string, uncertain = false, requestedId?: string) {
      const bytes = command.kind === 'upload'
        ? command.file.size
        : new TextEncoder().encode(JSON.stringify(command)).byteLength
      if (!Number.isFinite(bytes) || bytes < 0 || bytes > maxFileBytes) {
        throw new ApiError({ kind: 'storage', message: 'Tệp chờ đồng bộ tối đa 50 MiB.' })
      }
      return transact(async scope => {
        const pending = await rows(scope)
        const duplicate = pending.find(row => isDuplicate(row, command))
        if (duplicate) return duplicate.id
        if (pending.some(row => row.command.kind === 'delete' && resourceKey(row.command) === resourceKey(command))) {
          throw new ApiError({ kind: 'storage', message: 'Đối tượng này đã có yêu cầu xóa đang chờ. Hãy xử lý yêu cầu đó trước.' })
        }
        const accountRows = await db.writes.where('accountId').equals(scope.accountId).toArray()
        const accountBytes = accountRows.reduce((sum, row) => sum + row.bytes, 0)
        if (accountRows.length >= maxEntries || accountBytes + bytes > maxBytes) {
          throw new ApiError({ kind: 'storage', message: 'Hàng đợi đã đầy (tối đa 100 yêu cầu, 100 MiB). Hãy đồng bộ hoặc bỏ yêu cầu cũ.' })
        }
        const id = requestedId ?? crypto.randomUUID()
        await db.writes.add({
          id,
          accountId: scope.accountId,
          namespace,
          command,
          label,
          bytes,
          state: uncertain ? 'uncertain' : 'queued',
          attempts: uncertain ? 1 : 0,
          createdAt: now(),
        })
        return id
      })
    },

    update: (id: string, change: Partial<Pick<OfflineWrite, 'state' | 'attempts' | 'response'>> & { error?: string | undefined }) =>
      transact(async scope => {
        const row = await owned(id, scope)
        const { error, ...fields } = change
        const next: OfflineWrite = { ...row, ...fields }
        if (error === undefined) delete next.error
        else next.error = error
        await db.writes.put(next)
      }),

    // Call under the cross-tab Web Lock before replaying persisted writes.
    recoverSending: () => transact(async scope => {
      for (const row of await rows(scope)) {
        if (row.state === 'sending') await db.writes.put({ ...row, state: 'uncertain' })
      }
    }),

    confirm: (id: string, response: unknown, version?: number) => transact(async scope => {
      const row = await owned(id, scope)
      if (row.command.kind === 'patch' && version !== undefined) {
        for (const next of await rows(scope)) {
          if ((next.sequence ?? 0) > (row.sequence ?? 0) && next.state === 'queued'
            && next.command.kind === 'patch' && resourceKey(next.command) === resourceKey(row.command)
            && next.command.expectedVersion === row.command.expectedVersion) {
            await db.writes.put({ ...next, command: { ...next.command, expectedVersion: version } })
          }
        }
      }
      delete row.error
      await db.writes.put({ ...row, state: 'confirmed', response })
    }),

    remove: (id: string) => transact(async scope => {
      const row = await owned(id, scope)
      if (row.sequence !== undefined) await db.writes.delete(row.sequence)
    }),
  }
}
