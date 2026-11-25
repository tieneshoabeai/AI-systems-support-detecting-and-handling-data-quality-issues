import { ApiError, isRecord } from '../../lib/api-error'
import type { DraftAccess, DraftAccessPort } from '../../types/datasets/upload-draft.types'
import { OfflineReadDatabase } from './offline-read.database'

const maxBytes = 100 * 1024 * 1024
const maxEntryBytes = 50 * 1024 * 1024
const maxEntries = 300

export function createOfflineReadRepository(options: {
  db: OfflineReadDatabase; access: DraftAccessPort; namespace: string; now?: () => number
}) {
  const { db, access, namespace } = options
  const now = options.now ?? Date.now
  const current = (): DraftAccess => {
    const scope = access.read()
    if (!scope || scope.expiresAtMs <= now()) throw new ApiError({ kind: 'session', message: 'Cần phiên hợp lệ để đọc dữ liệu đã lưu.' })
    return { ...scope }
  }
  const check = (scope: DraftAccess) => {
    const active = current()
    if (scope.accountId !== active.accountId || scope.generation !== active.generation) {
      throw new ApiError({ kind: 'session', message: 'Phiên dữ liệu đã thay đổi.' })
    }
  }
  const transaction = async <T>(scope: DraftAccess, work: () => Promise<T>) => {
    check(scope)
    let unsubscribe: (() => void) | undefined
    try {
      return await db.transaction('rw', db.reads, async tx => {
        unsubscribe = access.subscribe(() => { try { check(scope) } catch { tx.abort() } })
        check(scope)
        const value = await work()
        check(scope)
        return value
      })
    } finally { unsubscribe?.(); check(scope) }
  }
  return {
    async read(key: string) {
      const scope = current()
      return transaction(scope, () => db.reads.get([scope.accountId, namespace, key]))
    },
    async save(key: string, payload: unknown, bytes: number) {
      const scope = current()
      if (!Number.isFinite(bytes) || bytes < 0 || bytes > maxEntryBytes) {
        throw new ApiError({ kind: 'storage', message: 'Tệp quá lớn để lưu ngoại tuyến (tối đa 50 MiB).' })
      }
      const savedAt = now()
      await transaction(scope, async () => {
        const rows = await db.reads.toArray()
        const own = rows.filter(row => row.accountId === scope.accountId && row.namespace === namespace && row.key !== key)
          .sort((a, b) => a.savedAt - b.savedAt)
        let total = own.reduce((sum, row) => sum + row.bytes, 0)
        while (own.length && (total + bytes > maxBytes || own.length >= maxEntries)) {
          const oldest = own.shift()!
          total -= oldest.bytes
          await db.reads.delete([oldest.accountId, oldest.namespace, oldest.key])
        }
        await db.reads.put({ accountId: scope.accountId, namespace, key, payload, savedAt, bytes })
      })
      return savedAt
    },
    async remove(key: string) {
      const scope = current()
      await transaction(scope, () => db.reads.delete([scope.accountId, namespace, key]))
    },
    async clear() {
      const scope = current()
      await transaction(scope, () => db.reads.where('[accountId+namespace]').equals([scope.accountId, namespace]).delete())
    },
    async list() {
      const scope = current()
      return transaction(scope, () => db.reads.where('[accountId+namespace]').equals([scope.accountId, namespace]).toArray())
    },
    async removeResource(path: string) {
      const scope = current()
      const match = path.match(/^\/(workspaces|projects|datasets|issues)\/([^/]+)$/)
      if (!match) return
      const [, kind, id] = match
      await transaction(scope, async () => {
        const rows = await db.reads.where('[accountId+namespace]').equals([scope.accountId, namespace]).toArray()
        const projects = new Set<string>(kind === 'projects' && id ? [id] : [])
        const datasets = new Set<string>(kind === 'datasets' && id ? [id] : [])
        const emptiedProjects = new Set<string>()
        const readPath = (key: string) => {
          const value: unknown = JSON.parse(key)
          return isRecord(value) && typeof value['path'] === 'string' ? value['path'] : ''
        }
        if (kind === 'workspaces') for (const row of rows) {
          if (!isRecord(row.payload)) continue
          const candidates = Array.isArray(row.payload['items']) ? row.payload['items'] : [row.payload['project']]
          for (const candidate of candidates as unknown[]) if (isRecord(candidate) && candidate['workspaceId'] === id && typeof candidate['id'] === 'string') projects.add(candidate['id'])
        }
        for (const row of rows) {
          const project = readPath(row.key).match(/^\/projects\/([^/]+)\/datasets$/)?.[1]
          if (project && projects.has(project) && isRecord(row.payload) && isRecord(row.payload['dataset']) && typeof row.payload['dataset']['id'] === 'string') datasets.add(row.payload['dataset']['id'])
          if (project && kind === 'datasets' && isRecord(row.payload) && isRecord(row.payload['dataset']) && row.payload['dataset']['id'] === id) emptiedProjects.add(project)
        }
        for (const row of rows) {
          const target = readPath(row.key)
          const project = target.match(/^\/projects\/([^/]+)/)?.[1]
          const dataset = target.match(/^\/datasets\/([^/]+)/)?.[1]
          if (project && emptiedProjects.has(project)) {
            if (target === `/projects/${project}/datasets`) {
              await db.reads.put({ ...row, payload: { dataset: null } }); continue
            }
            if (target === `/projects/${project}` && isRecord(row.payload) && isRecord(row.payload['project'])) {
              await db.reads.put({ ...row, payload: { ...row.payload, project: { ...row.payload['project'], hasDataset: false } } }); continue
            }
            if (/\/projects\/[^/]+\/(analysis|report)(\/|$)/.test(target)) {
              await db.reads.delete([scope.accountId, namespace, row.key]); continue
            }
          }
          if (target === path || target.startsWith(`${path}/`) || (project && projects.has(project)) || (dataset && datasets.has(dataset))) {
            await db.reads.delete([scope.accountId, namespace, row.key]); continue
          }
          if (isRecord(row.payload) && Array.isArray(row.payload['items'])) {
            const items = (row.payload['items'] as unknown[]).filter(item => !isRecord(item)
              || !((target === '/projects' || /^\/workspaces\/[^/]+\/projects$/.test(target)) && (projects.has(String(item['id'])) || (kind === 'workspaces' && item['workspaceId'] === id)))
                && !(target === '/workspaces' && kind === 'workspaces' && item['id'] === id)
                && !(target === '/issues' && kind === 'issues' && item['id'] === id))
              .map(item => isRecord(item) && emptiedProjects.has(String(item['id'])) ? { ...item, hasDataset: false } : item)
            await db.reads.put({ ...row, payload: { ...row.payload, items } })
          }
        }
      })
    },
    // Logout also needs cleanup after the access port has already been revoked.
    clearAccount: (accountId: string) => db.reads.where('accountId').equals(accountId).delete(),
  }
}
