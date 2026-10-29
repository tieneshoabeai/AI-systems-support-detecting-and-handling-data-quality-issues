import { createAxiosClient } from '../lib/axios-client'
import { createSessionStorage } from '../lib/session-storage'
import { createAuthService } from '../services/auth/auth.service'
import { createHealthService } from '../services/health/health.service'
import { createUsersService } from '../services/users/users.service'
import { createSessionCoordinator } from '../services/auth/session-coordinator'
import { UploadDraftDatabase } from '../repositories/datasets/upload-draft.database'
import { createUploadDraftRepository } from '../repositories/datasets/upload-draft.repository'
import { ApiError } from '../lib/api-error'

type ClientOptions = NonNullable<Parameters<typeof createAxiosClient>[0]>
type RuntimeOptions = {
  clearSessionCache(): void
  client?: Omit<ClientOptions, 'readToken'>
  storage?: ReturnType<typeof createSessionStorage>
  database?: UploadDraftDatabase
  now?: () => number
}

// Composition root nội bộ; không tạo instance hoặc đọc config khi import module.
// AuthProvider sở hữu lifecycle của một runtime/tab qua retain/release.
export const createAppRuntime = (options: RuntimeOptions) => {
  const publicApi = createAxiosClient(options.client)
  const database = options.database ?? new UploadDraftDatabase()
  const storage = options.storage ?? createSessionStorage({ now: options.now })
  const coordinator = createSessionCoordinator({
    storage,
    auth: createAuthService(publicApi),
    health: createHealthService(publicApi),
    clearSessionCache: options.clearSessionCache,
    now: options.now,
    bindSession: accessToken => {
      // Mỗi bound client chỉ biết token đã capture, không đọc phiên global.
      const api = createAxiosClient({ ...options.client, readToken: () => accessToken })
      const users = createUsersService(api)
      const auth = createAuthService(api)
      return { getMe: users.getMe, logout: auth.logout }
    },
  })
  const drafts = createUploadDraftRepository({ db: database, access: coordinator.draftAccess, now: options.now })
  let owners = 0
  let closed = false
  const dispose = () => {
    if (closed) return
    closed = true
    coordinator.dispose()
    database.close()
  }
  return {
    coordinator,
    drafts,
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
