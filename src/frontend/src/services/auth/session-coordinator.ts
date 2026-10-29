import { ApiError, normalizeApiError } from '../../lib/api-error'
import { readAccessToken, isAccessTokenExpired } from '../../utils/auth/access-token'
import type { AppError } from '../../types/api/api.types'
import type { LoginRequestDto } from '../../types/auth/auth.types'
import type { StoredSession } from '../../types/auth/session.types'
import type {
  SessionCoordinatorOptions, SessionSnapshot, SessionUser, SignOutResult,
} from '../../types/auth/session-coordinator.types'
import type { DraftAccessPort } from '../../types/datasets/upload-draft.types'
import type { CurrentUser } from '../../types/users/user.types'

const sessionError = (message: string) => new ApiError({ kind: 'session', message })
const safeError = (error: unknown): Readonly<AppError> => {
  const value = normalizeApiError(error)
  // Không expose raw Error/config/token hoặc object mutable của caller qua snapshot.
  return Object.freeze({ kind: value.kind, message: value.message, status: value.status, code: value.code })
}

export const createSessionCoordinator = (options: SessionCoordinatorOptions) => {
  const now = options.now ?? Date.now
  const listeners = new Set<() => void>()
  let generation = 0
  let disposed = false
  let cleanupBlocked = false
  let sessionEnded = false
  let session: StoredSession | null = null
  let controller = new AbortController()
  let restoreTask: Promise<void> | null = null
  let healthTask: Promise<void> | null = null
  let renewalTask: Promise<void> | null = null
  let snapshot: SessionSnapshot = Object.freeze({
    phase: 'bootstrapping', generation, sessionEnded, accountId: null, user: null,
    expiresAtMs: null, error: null, cleanupError: null,
  })

  const publish = (next: SessionSnapshot) => {
    snapshot = Object.freeze(next)
    listeners.forEach(listener => listener())
  }
  const isCurrent = (captured: number) => !disposed && generation === captured
  const begin = () => {
    generation += 1
    controller.abort()
    controller = new AbortController()
    healthTask = null
    renewalTask = null
    return generation
  }
  const emptySnapshot = (
    phase: 'bootstrapping' | 'anonymous' | 'signing-in' | 'signing-out',
    error: Readonly<AppError> | null = null,
    cleanupError: Readonly<AppError> | null = null,
  ): SessionSnapshot => ({ phase, generation, sessionEnded, accountId: null, expiresAtMs: null, user: null, error, cleanupError })
  const infoFor = (value: StoredSession) => {
    const info = readAccessToken(value.accessToken)
    if (!info || info.accountId !== value.accountId) throw sessionError('Dữ liệu nhận dạng phiên không hợp lệ.')
    return info
  }
  const expired = (value: StoredSession) => isAccessTokenExpired(infoFor(value), now())
  const sessionSnapshot = (
    phase: 'checking-health' | 'awaiting-consent' | 'refreshing' | 'local-limited',
    value: StoredSession,
    error: Readonly<AppError> | null = null,
  ): SessionSnapshot => ({ phase, generation, sessionEnded, accountId: value.accountId, expiresAtMs: infoFor(value).expiresAtMs, user: null, error, cleanupError: null })

  // Khóa runtime và notify repository trước khi động tới storage/cache.
  const endSession = (reason: Readonly<AppError> | null = null) => {
    if (session) sessionEnded = true
    begin()
    session = null
    publish(emptySnapshot('signing-out'))
    let cleanupError: Readonly<AppError> | null = null
    try { options.clearSessionCache() } catch {
      cleanupError = safeError(sessionError('Không thể dọn hoàn toàn cache của phiên cũ.'))
    }
    try { options.storage.clear() } catch (error) { cleanupError = safeError(error) }
    cleanupBlocked = cleanupError !== null
    publish(emptySnapshot('anonymous', reason ?? cleanupError, cleanupError))
    return cleanupError
  }
  const assertUsable = () => {
    if (disposed) throw sessionError('Bộ điều phối phiên đã được đóng.')
  }
  const requireActiveToken = (value: StoredSession) => {
    if (expired(value)) throw sessionError('Access token đã hết hạn.')
  }
  const validateProfile = (user: CurrentUser, value: StoredSession) => {
    if (user.id !== value.accountId || user.status !== 'active') {
      throw sessionError('Tài khoản không còn hoạt động hoặc không khớp phiên hiện tại.')
    }
  }
  const commit = (value: StoredSession, user: SessionUser, captured: number, persist: boolean) => {
    if (!isCurrent(captured)) return
    requireActiveToken(value)
    if (persist) options.storage.write(value)
    // Storage port là synchronous; kiểm lại generation nếu adapter có invalidation.
    if (!isCurrent(captured)) return
    requireActiveToken(value)
    session = Object.freeze({ ...value })
    sessionEnded = false
    const safeUser = Object.freeze({ ...user, value: Object.freeze({ ...user.value }) }) as SessionUser
    publish({ phase: 'authenticated', generation, sessionEnded, accountId: value.accountId,
      expiresAtMs: infoFor(value).expiresAtMs, user: safeUser, error: null, cleanupError: null })
  }

  const checkSession = (): Promise<void> => {
    if (disposed || !session) return Promise.resolve()
    if (healthTask) return healthTask
    if (renewalTask) return renewalTask
    if (snapshot.phase === 'awaiting-consent') return Promise.resolve()
    const previous = session
    if (!expired(previous)) return Promise.resolve()
    const captured = begin()
    const signal = controller.signal
    // Schedule trước publish để caller đồng thời/reentrant luôn join cùng flow.
    const task = Promise.resolve().then(async () => {
      if (!isCurrent(captured)) return
      try {
        const result = await options.health.check({ signal })
        if (!isCurrent(captured)) return
        if (!result.available) throw sessionError('Không thể xác nhận dịch vụ khả dụng để gia hạn phiên.')
        publish(sessionSnapshot('awaiting-consent', previous))
      } catch (error) {
        if (isCurrent(captured)) endSession(safeError(error))
      }
    }).finally(() => { if (healthTask === task) healthTask = null })
    healthTask = task
    publish(sessionSnapshot('checking-health', previous))
    return task
  }

  const restore = (): Promise<void> => {
    assertUsable()
    if (restoreTask) return restoreTask
    if (snapshot.phase !== 'bootstrapping') return Promise.resolve()
    const captured = begin()
    const signal = controller.signal
    const task = (async () => {
      try {
        const stored = options.storage.read()
        if (!isCurrent(captured)) return
        if (stored.status === 'empty' || stored.status === 'invalid') {
          // Cache không được sống sót qua bootstrap anonymous.
          endSession()
          return
        }
        session = Object.freeze({ ...stored.session })
        if (expired(stored.session)) { await checkSession(); return }
        const user = await options.bindSession(stored.session.accessToken).getMe({ signal })
        if (!isCurrent(captured)) return
        validateProfile(user, stored.session)
        if (expired(stored.session)) { await checkSession(); return }
        commit(stored.session, { source: 'profile', value: user }, captured, false)
      } catch (error) {
        if (!isCurrent(captured)) return
        const normalized = safeError(error)
        const outage = normalized.kind === 'network' || normalized.kind === 'timeout'
          || (normalized.kind === 'http' && (normalized.status ?? 0) >= 500)
        if (session && outage) {
          if (expired(session)) await checkSession()
          else publish(sessionSnapshot('local-limited', session, normalized))
        } else endSession(normalized)
      }
    })().finally(() => { if (restoreTask === task) restoreTask = null })
    restoreTask = task
    return task
  }

  const signIn = async (input: LoginRequestDto): Promise<void> => {
    assertUsable()
    if (cleanupBlocked || snapshot.phase !== 'anonymous') {
      throw sessionError('Cần kết thúc phiên cũ và dọn phiên thành công trước khi đăng nhập.')
    }
    const captured = begin()
    const signal = controller.signal
    publish(emptySnapshot('signing-in'))
    try {
      options.clearSessionCache()
      const result = await options.auth.login(input, { signal })
      if (!isCurrent(captured)) return
      if (result.user.id !== result.session.accountId) throw sessionError('Người dùng đăng nhập không khớp phiên.')
      commit(result.session, { source: 'login', value: result.user }, captured, true)
    } catch (error) {
      if (!isCurrent(captured)) return
      const normalized = safeError(error)
      endSession(normalized)
      throw new ApiError(normalized)
    }
  }

  const confirmRenewal = (accepted: boolean): Promise<void> => {
    assertUsable()
    if (accepted && renewalTask) return renewalTask
    if (snapshot.phase !== 'awaiting-consent' || !session) {
      return Promise.reject(sessionError('Không có yêu cầu gia hạn đang chờ lựa chọn.'))
    }
    if (!accepted) { endSession(); return Promise.resolve() }
    const captured = generation
    const previous = session
    const signal = controller.signal
    const task = Promise.resolve().then(async () => {
      if (!isCurrent(captured)) return
      try {
        const renewed = await options.auth.refresh({ refresh_token: previous.refreshToken }, { signal })
        if (!isCurrent(captured)) return
        const candidate: StoredSession = { ...previous, accessToken: renewed.accessToken }
        if (renewed.accountId !== previous.accountId) throw sessionError('Token gia hạn không khớp tài khoản.')
        requireActiveToken(candidate)
        // Me dùng candidate token, chưa publish/persist candidate vào phiên chính.
        const user = await options.bindSession(candidate.accessToken).getMe({ signal })
        if (!isCurrent(captured)) return
        validateProfile(user, candidate)
        commit(candidate, { source: 'profile', value: user }, captured, true)
      } catch (error) {
        if (!isCurrent(captured)) return
        const normalized = safeError(error)
        endSession(normalized)
        throw new ApiError(normalized)
      }
    }).finally(() => { if (renewalTask === task) renewalTask = null })
    renewalTask = task
    publish(sessionSnapshot('refreshing', previous))
    return task
  }

  const signOut = async (): Promise<SignOutResult> => {
    assertUsable()
    sessionEnded = true
    const previous = session
    // Bind trước clear: logout A không thể lấy bearer của account B về sau.
    let revoke: (() => Promise<void>) | null = null
    let revokeError: Readonly<AppError> | null = null
    try {
      if (previous) {
        requireActiveToken(previous)
        const bound = options.bindSession(previous.accessToken)
        revoke = () => bound.logout()
      }
    } catch (error) { revokeError = safeError(error) }
    const captured = generation + 1
    const cleanupError = endSession()
    let serverRevoked = false
    if (revoke) {
      try { await revoke(); serverRevoked = true } catch (error) { revokeError = safeError(error) }
    }
    // UI có thể login B trong lúc revoke A pending: không ghi đè snapshot B.
    if (isCurrent(captured) && revokeError) publish(emptySnapshot('anonymous', revokeError, cleanupError))
    return { serverRevoked, revokeError, cleanupError }
  }

  const subscribe = (listener: () => void) => {
    if (disposed) return () => {}
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  const draftAccess: DraftAccessPort = Object.freeze({
    read: () => {
      if (disposed || cleanupBlocked || !session
        || (snapshot.phase !== 'authenticated' && snapshot.phase !== 'local-limited')
        || expired(session)) return null
      return { accountId: session.accountId, generation, expiresAtMs: infoFor(session).expiresAtMs }
    },
    subscribe,
  })

  const dispose = () => {
    if (disposed) return
    begin()
    disposed = true
    session = null
    publish(emptySnapshot('anonymous'))
    listeners.clear()
    // Đóng instance không phải logout: giữ credential/draft cho instance mới restore.
  }

  return { getSnapshot: () => snapshot, subscribe, restore, signIn, signOut, confirmRenewal, checkSession, draftAccess, dispose }
}
