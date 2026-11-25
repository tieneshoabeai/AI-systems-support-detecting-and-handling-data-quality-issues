import { createAxiosClient } from '../lib/axios-client'
import { createSessionStorage } from '../lib/session-storage'
import { createAuthService } from '../services/auth/auth.service'
import { createHealthService } from '../services/health/health.service'
import { createUsersService } from '../services/users/users.service'
import { createSessionCoordinator } from '../services/auth/session-coordinator'
import { UploadDraftDatabase } from '../repositories/datasets/upload-draft.database'
import { createUploadDraftRepository } from '../repositories/datasets/upload-draft.repository'
import { ApiError } from '../lib/api-error'
import { getApiConfig, getApiEnvironmentId, getOfflineMigrationSources } from '../configs/api.config'
import { OfflineReadDatabase } from '../repositories/offline/offline-read.database'
import { createOfflineReadRepository } from '../repositories/offline/offline-read.repository'
import { createOfflineDataService } from '../services/offline/offline-data.service'
import { OfflineWriteDatabase } from '../repositories/offline/offline-write.database'
import { createOfflineWriteRepository } from '../repositories/offline/offline-write.repository'
import { createOfflineWriteService } from '../services/offline/offline-write.service'
import { updateConfirmedCache } from '../services/offline/confirmed-write-cache'
import { hashFile } from '../services/offline/offline-write-command'
import { isRecord, normalizeApiError } from '../lib/api-error'
import type { OfflineWritePort } from '../types/offline/offline-write.types'
import type { OfflineMigrationStatus } from '../types/offline/offline.types'
import { migrateOfflineNamespace } from '../services/offline/offline-namespace-migration'

type ClientOptions = NonNullable<Parameters<typeof createAxiosClient>[0]>
type RuntimeOptions = {
  clearSessionCache(this: void): void
  client?: Omit<ClientOptions, 'readToken'>
  storage?: ReturnType<typeof createSessionStorage>
  database?: UploadDraftDatabase
  offlineDatabase?: OfflineReadDatabase
  writeDatabase?: OfflineWriteDatabase
  now?: () => number
}

// Composition root nội bộ; không tạo instance hoặc đọc config khi import module.
// AuthProvider sở hữu lifecycle của một runtime/tab qua retain/release.
export const createAppRuntime = (options: RuntimeOptions) => {
  const publicApi = createAxiosClient(options.client)
  const database = options.database ?? new UploadDraftDatabase()
  const storage = options.storage ?? createSessionStorage(options.now === undefined ? {} : { now: options.now })
  const coordinator = createSessionCoordinator({
    storage,
    auth: createAuthService(publicApi),
    health: createHealthService(publicApi),
    clearSessionCache: options.clearSessionCache,
    ...(options.now === undefined ? {} : { now: options.now }),
    bindSession: accessToken => {
      // Mỗi bound client chỉ biết token đã capture, không đọc phiên global.
      const api = createAxiosClient({ ...options.client, readToken: () => accessToken })
      const users = createUsersService(api)
      const auth = createAuthService(api)
      return { getMe: options => users.getMe(options), logout: options => auth.logout(options), deleteMe: options => users.deleteMe(options) }
    },
  })
  const drafts = createUploadDraftRepository({ db: database, access: coordinator.draftAccess, ...(options.now === undefined ? {} : { now: options.now }) })
  const offlineDatabase = options.offlineDatabase ?? new OfflineReadDatabase()
  const apiBaseUrl = options.client?.baseUrl ?? getApiConfig().baseUrl
  const namespace = getApiEnvironmentId(apiBaseUrl)
  const migrationSources = getOfflineMigrationSources(apiBaseUrl)
  const cache = createOfflineReadRepository({ db: offlineDatabase, access: coordinator.draftAccess,
    namespace, ...(options.now === undefined ? {} : { now: options.now }) })
  const writeDatabase = options.writeDatabase ?? new OfflineWriteDatabase()
  const migrationTasks = new Map<string, Promise<void>>()
  let migrationSnapshot: OfflineMigrationStatus = Object.freeze({ state: 'idle', conflicts: 0, unlistedNamespaces: 0, message: null })
  const migrationListeners = new Set<() => void>()
  const publishMigration = (next: OfflineMigrationStatus) => {
    migrationSnapshot = Object.freeze(next)
    migrationListeners.forEach(listener => listener())
  }
  const migrationStatus = {
    getSnapshot: () => migrationSnapshot,
    subscribe: (listener: () => void) => { migrationListeners.add(listener); return () => { migrationListeners.delete(listener) } },
  }
  const migrateForActiveAccount = async () => {
    const scope = coordinator.draftAccess.read()
    if (!scope) return
    const taskKey = `${scope.accountId}:${scope.generation}`
    const existingTask = migrationTasks.get(taskKey)
    if (existingTask) return existingTask
    const task = migrateOfflineNamespace({ reads: offlineDatabase, writes: writeDatabase, accountId: scope.accountId,
      target: namespace, sources: migrationSources,
      lock: async (name, work) => {
        if (typeof navigator === 'undefined' || !navigator.locks) { await work(); return }
        await navigator.locks.request(name, work)
      },
      isCurrent: () => {
        const current = coordinator.draftAccess.read()
        return current?.accountId === scope.accountId && current.generation === scope.generation
      },
    }).then(result => {
      const needsAttention = result.conflicts > 0 || result.unlistedNamespaces > 0
      publishMigration({ state: needsAttention ? 'attention' : 'complete', conflicts: result.conflicts,
        unlistedNamespaces: result.unlistedNamespaces,
        message: needsAttention
          ? `Còn ${result.conflicts} cache xung đột và dữ liệu ở ${result.unlistedNamespaces} namespace chưa xác nhận. Dữ liệu này được giữ nguyên; chỉ khai báo URL cũ nếu bạn xác nhận cùng môi trường.`
          : null,
      })
    }).catch(error => {
      publishMigration({ state: 'error', conflicts: 0, unlistedNamespaces: 0,
        message: 'Không hoàn tất được chuyển dữ liệu offline. Cache và hàng đợi cũ được giữ lại; thử tải lại sau.',
      })
      throw error
    }).finally(() => { migrationTasks.delete(taskKey) })
    migrationTasks.set(taskKey, task)
    publishMigration({ state: 'migrating', conflicts: 0, unlistedNamespaces: 0, message: null })
    return task
  }
  // Session restore and new sign-in both run this migration; sync also awaits it
  // so the queue cannot replay before its explicit source URLs have been moved.
  const unsubscribeMigration = coordinator.draftAccess.subscribe(() => { void migrateForActiveAccount().catch(() => {}) })
  void migrateForActiveAccount().catch(() => {})
  const writePort: { current?: OfflineWritePort } = {}
  const offline = createOfflineDataService({ cache, access: coordinator.draftAccess, writes: () => writePort.current,
    checkConnection: async signal => {
      const wasLimited = coordinator.getSnapshot().phase === 'local-limited'
      await coordinator.checkSession()
      await migrateForActiveAccount()
      signal.throwIfAborted()
      if (coordinator.getSnapshot().phase !== 'authenticated') return false
      // checkSession has already obtained and validated a fresh profile in this case.
      if (wasLimited) return true
      try {
        if ((await createHealthService(publicApi).check({ signal })).available) return true
      } catch { /* A failed health endpoint alone does not prove all data APIs are offline. */ }
      const scope = coordinator.draftAccess.read()
      const stored = storage.read()
      if (!scope || stored.status !== 'valid' || stored.session.accountId !== scope.accountId) return false
      const boundApi = createAxiosClient({ ...options.client, readToken: () => stored.session.accessToken })
      try {
        const user = await createUsersService(boundApi).getMe({ signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) })
        if (user.id !== scope.accountId || user.status !== 'active') throw new ApiError({ kind: 'session', message: 'Tài khoản không còn hoạt động hoặc không khớp phiên hiện tại.' })
        return true
      } catch (error) {
        const failure = normalizeApiError(error)
        if ([401, 403].includes(failure.status ?? 0) || failure.kind === 'session') coordinator.rejectSession(scope, failure)
        throw error
      }
    },
  })
  const repository = createOfflineWriteRepository({ db: writeDatabase, access: coordinator.draftAccess, namespace,
    ...(options.now === undefined ? {} : { now: options.now }) })
  const replayApi = createAxiosClient({ ...options.client, readToken: () => {
    const scope = coordinator.draftAccess.read()
    const stored = storage.read()
    return scope && stored.status === 'valid' && stored.session.accountId === scope.accountId ? stored.session.accessToken : null
  } })
  const writes = createOfflineWriteService({ repository, access: coordinator.draftAccess, api: replayApi, namespace,
    prepare: async () => {
      await coordinator.checkSession()
      await migrateForActiveAccount()
      return coordinator.getSnapshot().phase === 'authenticated'
    },
    connected: offline.confirmConnection,
    confirmed: async row => {
      await updateConfirmedCache(cache, row)
      if (row.command.kind !== 'upload' || !isRecord(row.response) || !isRecord(row.response['dataset']) || typeof row.response['dataset']['id'] !== 'string') return
      const command = row.command
      for (const draft of await drafts.list()) {
        if (draft.projectId !== decodeURIComponent(command.resourceId) || draft.fileName !== command.fileName || draft.sizeBytes !== command.file.size) continue
        if (await hashFile(await drafts.readFile(draft.id)) !== command.hash) continue
        await drafts.confirmUploaded(draft.id, { accountId: row.accountId, projectId: draft.projectId, datasetId: row.response['dataset']['id'] })
      }
    },
  })
  writePort.current = writes
  const localData = { drafts, writes, migration: migrationStatus, offline: { ...offline, reconnect: () => {
    offline.reconnect(); void writes.sync()
  } }, wrapApi: offline.wrapApi }
  let owners = 0
  let closed = false
  const dispose = () => {
    if (closed) return
    closed = true
    writes.dispose()
    offline.dispose()
    unsubscribeMigration()
    migrationListeners.clear()
    coordinator.dispose()
    database.close()
    offlineDatabase.close()
    writeDatabase.close()
  }
  return {
    coordinator,
    drafts,
    localData,
    retain: () => {
      if (closed) throw new ApiError({ kind: 'session', message: 'Runtime đã được đóng.' })
      owners += 1
      let attached = true
      return () => {
        if (!attached) return
        attached = false
        owners -= 1
        // StrictMode cleanup/setup cùng turn giữ lại instance đang dùng.
        queueMicrotask(() => { if (owners === 0) dispose() })
      }
    },
    dispose, // Không delete database hoặc credential khi unmount.
  }
}

export type AppRuntime = ReturnType<typeof createAppRuntime>
