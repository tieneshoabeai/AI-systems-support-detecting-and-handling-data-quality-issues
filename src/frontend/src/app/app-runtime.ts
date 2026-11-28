import { getApiEnvironmentId } from '../configs/api.config'
import { createAxiosClient } from '../lib/axios-client'
import { ApiTargetManager, apiTargetInputFromBaseUrl, getApiTargetManager } from '../lib/api-target-manager'
import type { ApiTarget } from '../types'
import { createSessionStorage } from '../lib/session-storage'
import { createAuthService } from '../services/auth/auth.service'
import { createHealthService } from '../services/health/health.service'
import { createUsersService } from '../services/users/users.service'
import { createSessionCoordinator } from '../services/auth/session-coordinator'
import { UploadDraftDatabase } from '../repositories/datasets/upload-draft.database'
import { createUploadDraftRepository } from '../repositories/datasets/upload-draft.repository'
import { OfflineReadDatabase } from '../repositories/offline/offline-read.database'
import { createOfflineReadRepository } from '../repositories/offline/offline-read.repository'
import { OfflineWriteDatabase } from '../repositories/offline/offline-write.database'
import { createOfflineWriteRepository } from '../repositories/offline/offline-write.repository'
import { createOfflineWriteService } from '../services/offline/offline-write.service'
import { createOfflineDataService } from '../services/offline/offline-data.service'
import { ApiError } from '../lib/api-error'

type ClientOptions = NonNullable<Parameters<typeof createAxiosClient>[0]>
type RuntimeOptions = {
  clearSessionCache(this: void): void
  client?: Omit<ClientOptions, 'readToken' | 'apiTargetManager' | 'targetOverride' | 'allowWhenSessionUnverified'>
  storage?: ReturnType<typeof createSessionStorage>
  database?: UploadDraftDatabase
  offlineDatabase?: OfflineReadDatabase
  writeDatabase?: OfflineWriteDatabase
  now?: () => number
}

// Composition root nội bộ; không tạo instance hoặc đọc config khi import module.
// AuthProvider sở hữu lifecycle của một runtime/tab qua retain/release.
export const createAppRuntime = (options: RuntimeOptions) => {
  const namespace = getApiEnvironmentId()
  const environmentId = namespace.slice('environment:'.length)
  const { baseUrl: injectedBaseUrl, ...transportOptions } = options.client ?? {}
  const apiTargetManager = injectedBaseUrl
    ? new ApiTargetManager(apiTargetInputFromBaseUrl(injectedBaseUrl, environmentId))
    : getApiTargetManager()
  if (apiTargetManager.getTarget().environmentId !== environmentId) {
    throw new ApiError({ kind: 'config', message: 'EnvironmentId của runtime không khớp với API target manager.' })
  }
  const apiClientOptions = { ...transportOptions, apiTargetManager }
  const publicApi = createAxiosClient(apiClientOptions)
  // Keep drafts from different backends isolated even when the account ID is the same.
  const database = options.database ?? new UploadDraftDatabase(`data-quality.upload-drafts.${environmentId}`)
  const storage = options.storage ?? createSessionStorage(options.now === undefined ? {} : { now: options.now })
  const publicAuth = createAuthService(publicApi)
  const coordinator = createSessionCoordinator({
    storage,
    auth: {
      login: publicAuth.login,
      refresh: (input, requestOptions, targetOverride) => {
        if (targetOverride === undefined) return publicAuth.refresh(input, requestOptions)
        const targetApi = createAxiosClient({ ...apiClientOptions, targetOverride })
        return createAuthService(targetApi).refresh(input, requestOptions)
      },
    },
    health: createHealthService(publicApi),
    clearSessionCache: options.clearSessionCache,
    ...(options.now === undefined ? {} : { now: options.now }),
    bindSession: (accessToken, targetOverride?: ApiTarget) => {
      // Mỗi bound client chỉ biết token đã capture, không đọc phiên global.
      const api = createAxiosClient({ ...apiClientOptions, readToken: () => accessToken, allowWhenSessionUnverified: true,
        ...(targetOverride === undefined ? {} : { targetOverride }) })
      const users = createUsersService(api)
      const auth = createAuthService(api)
      return { getMe: options => users.getMe(options), logout: options => auth.logout(options), deleteMe: options => users.deleteMe(options) }
    },
  })
  apiTargetManager.setVerifier(async (target, signal) => {
    const candidateApi = createAxiosClient({ ...apiClientOptions, targetOverride: target })
    const readiness = await createHealthService(candidateApi).readiness(signal)
    if (readiness.mongo !== 'ok') {
      throw new ApiError({ kind: 'network', message: 'Backend mới chưa sẵn sàng: health check không xác nhận được MongoDB.' })
    }
    return coordinator.verifyTargetAccount(target, signal)
  })
  void apiTargetManager.setSessionReady(false).catch(() => {})
  const unsubscribeBackendOutages = apiTargetManager.subscribeBackendOutages(coordinator.noteBackendOutage)
  const drafts = createUploadDraftRepository({ db: database, access: coordinator.draftAccess, ...(options.now === undefined ? {} : { now: options.now }) })
  const offlineDatabase = options.offlineDatabase ?? new OfflineReadDatabase()
  const writeDatabase = options.writeDatabase ?? new OfflineWriteDatabase()
  const offlineReads = createOfflineReadRepository({ db: offlineDatabase, access: coordinator.draftAccess, namespace,
    ...(options.now === undefined ? {} : { now: options.now }) })
  const localData = createOfflineDataService({ reads: offlineReads, ...(options.now === undefined ? {} : { now: options.now }) })
  let scopedAccountId = coordinator.getSnapshot().accountId
  const offlineWriteRepository = createOfflineWriteRepository({ db: writeDatabase, access: coordinator.draftAccess, namespace,
    ...(options.now === undefined ? {} : { now: options.now }) })
  const queueApi = createAxiosClient({ ...apiClientOptions, readToken: () => {
    const snapshot = coordinator.getSnapshot()
    const current = storage.read()
    return snapshot.phase === 'authenticated' && current.status === 'valid'
      && snapshot.accountId === current.session.accountId ? current.session.accessToken : null
  } })
  const offlineWrites = createOfflineWriteService({
    repository: offlineWriteRepository, api: queueApi, drafts, targetManager: apiTargetManager, namespace,
    isSessionReady: () => coordinator.getSnapshot().phase === 'authenticated',
    recoverSession: () => coordinator.checkSession(),
    ...(options.now === undefined ? {} : { now: options.now }),
  })
  const unsubscribeSessionGate = coordinator.subscribe(() => {
    const next = coordinator.getSnapshot()
    if (next.accountId !== scopedAccountId) {
      scopedAccountId = next.accountId
      localData.resetStatus()
    }
    void offlineWrites.refresh()
    void apiTargetManager.setSessionReady(next.phase === 'authenticated').catch(() => {})
  })
  let owners = 0
  let closed = false
  const dispose = () => {
    if (closed) return
    closed = true
    unsubscribeSessionGate()
    unsubscribeBackendOutages()
    offlineWrites.dispose()
    coordinator.dispose()
    void apiTargetManager.setSessionReady(false).catch(() => {})
    database.close()
    offlineDatabase.close()
    writeDatabase.close()
  }
  return {
    coordinator,
    apiTargetManager,
    drafts,
    offlineReads,
    localData,
    offlineWrites,
    offlineNamespace: namespace,
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
