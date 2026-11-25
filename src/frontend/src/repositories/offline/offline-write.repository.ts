import { ApiError } from '../../lib/api-error'
import type { DraftAccess, DraftAccessPort } from '../../types/datasets/upload-draft.types'
import type { OfflineWrite, OfflineWriteCommand } from '../../types/offline/offline-write.types'
import type { OfflineWriteDatabase } from './offline-write.database'

const maxBytes = 100 * 1024 * 1024
const maxEntries = 100
const resourceKey = (command: OfflineWriteCommand) => `${command.resource}/${command.resourceId}`
const fingerprint = (command: OfflineWriteCommand) => command.kind === 'upload'
  ? `${resourceKey(command)}:${command.kind}:${command.fileName}:${command.hash}`
  : JSON.stringify(command)

export function createOfflineWriteRepository(options: {
  db: OfflineWriteDatabase; access: DraftAccessPort; namespace: string; now?: () => number
}) {
  const { db, access, namespace } = options
  const now = options.now ?? Date.now
  const current = (): DraftAccess => {
    const scope = access.read()
    if (!scope || scope.expiresAtMs <= now()) throw new ApiError({ kind: 'session', message: 'Cần phiên đăng nhập hợp lệ để đồng bộ thay đổi.' })
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
    } finally { unsubscribe?.(); check(captured) }
  }
  const rows = (scope: DraftAccess) => db.writes.where('[accountId+namespace]').equals([scope.accountId, namespace]).sortBy('sequence')
  const owned = async (id: string, scope: DraftAccess) => {
    const row = await db.writes.where('id').equals(id).first()
    if (!row || row.accountId !== scope.accountId || row.namespace !== namespace) throw new ApiError({ kind: 'storage', message: 'Không tìm thấy yêu cầu trong tài khoản hiện tại.' })
    return row
  }
  return {
    scope: current,
    list: () => transact(rows),
    async add(command: OfflineWriteCommand, label: string, uncertain = false) {
      const bytes = command.kind === 'upload' ? command.file.size : new TextEncoder().encode(JSON.stringify(command)).byteLength
      if (bytes > 50 * 1024 * 1024) throw new ApiError({ kind: 'storage', message: 'Tệp chờ đồng bộ tối đa 50 MiB.' })
      return transact(async scope => {
        const pending = await rows(scope)
        const duplicate = pending.find(row => row.state !== 'confirmed' && fingerprint(row.command) === fingerprint(command))
        if (duplicate) return duplicate.id
        if (pending.some(row => row.command.kind === 'delete' && resourceKey(row.command) === resourceKey(command))) {
          throw new ApiError({ kind: 'storage', message: 'Đối tượng này đã có yêu cầu xóa đang chờ. Hãy xử lý yêu cầu đó trước.' })
        }
        const accountRows = await db.writes.where('accountId').equals(scope.accountId).toArray()
        if (accountRows.length >= maxEntries || accountRows.reduce((sum, row) => sum + row.bytes, 0) + bytes > maxBytes) {
          throw new ApiError({ kind: 'storage', message: 'Hàng đợi đã đầy (tối đa 100 yêu cầu, 100 MiB). Hãy đồng bộ hoặc bỏ yêu cầu cũ.' })
        }
        const id = crypto.randomUUID()
        await db.writes.add({ id, accountId: scope.accountId, namespace, command, label, bytes,
          state: uncertain ? 'uncertain' : 'queued', attempts: uncertain ? 1 : 0, createdAt: now() })
        return id
      })
    },
    update: (id: string, change: Partial<Pick<OfflineWrite, 'state' | 'attempts' | 'error' | 'response'>>) => transact(async scope => {
      const row = await owned(id, scope)
      await db.writes.put({ ...row, ...change })
    }),
    // Called only under the cross-tab Web Lock. A previous tab may have closed
    // after sending a write; recovery reconciles it instead of blindly resending.
    recoverSending: () => transact(async scope => {
      for (const row of await rows(scope)) if (row.state === 'sending') await db.writes.put({ ...row, state: 'uncertain' })
    }),
    confirm: (id: string, response: unknown, version?: number) => transact(async scope => {
      const row = await owned(id, scope)
      if (row.command.kind === 'patch' && version !== undefined) {
        for (const next of await rows(scope)) {
          if ((next.sequence ?? 0) > (row.sequence ?? 0) && next.state === 'queued' && next.command.kind === 'patch'
            && resourceKey(next.command) === resourceKey(row.command) && next.command.expectedVersion === row.command.expectedVersion) {
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
