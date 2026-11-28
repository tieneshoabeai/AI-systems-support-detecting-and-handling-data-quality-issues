import { ApiError, normalizeApiError } from '../../lib/api-error'
import { readAccessToken, isAccessTokenExpired } from '../../utils'
import type { AppError } from '../../types'
import type { LoginRequestDto } from '../../types'
import type { StoredSession } from '../../types'
import type { SessionCoordinatorOptions, SessionSnapshot, SessionUser, SignOutResult } from '../../types'
import type { RefreshResult } from '../../types'
import type { DraftAccessPort } from '../../types'
import type { CurrentUser } from '../../types'
import type { ApiTarget } from '../../types'

const sessionError = (message: string) => new ApiError({ kind: 'session', message })
const refreshSessionDefaultMs = 7 * 24 * 60 * 60 * 1000
const rememberedRefreshSessionDefaultMs = 30 * 24 * 60 * 60 * 1000
const safeError = (error: unknown): Readonly<AppError> => {
  const value = normalizeApiError(error)
  // Không expose raw Error/config/token hoặc object mutable của caller qua snapshot.
  return Object.freeze({
    kind: value.kind, message: value.message,
    ...(value.status === undefined ? {} : { status: value.status }),
    ...(value.code === undefined ? {} : { code: value.code }),
  })
}
const combineSignals = (...signals: AbortSignal[]) => {
  const controller = new AbortController()
  const listeners: Array<{ signal: AbortSignal; listener: () => void }> = []
  for (const signal of signals) {
    if (signal.aborted) { controller.abort(signal.reason); break }
    const listener = () => { if (!controller.signal.aborted) controller.abort(signal.reason) }
    signal.addEventListener('abort', listener, { once: true })
    listeners.push({ signal, listener })
  }
  return {
    signal: controller.signal,
    dispose: () => listeners.forEach(({ signal, listener }) => signal.removeEventListener('abort', listener)),
  }
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
  let pendingTargetRenewal: {
    target: ApiTarget
    candidate: StoredSession
    captured: number
    signal: AbortSignal
    resolve(commit: () => void): void
    reject(reason: unknown): void
    onAbort(): void
  } | null = null
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
  const accessExpired = (value: StoredSession) => isAccessTokenExpired(infoFor(value), now())
  const refreshExpired = (value: StoredSession) => value.refreshExpiresAtMs !== undefined && now() >= value.refreshExpiresAtMs
  const withRefreshExpiry = (value: StoredSession): StoredSession => value.refreshExpiresAtMs !== undefined ? value : {
    ...value,
    refreshExpiresAtMs: now() + (value.rememberMe ? rememberedRefreshSessionDefaultMs : refreshSessionDefaultMs),
  }
  const sessionExpiryFor = (value: StoredSession, authenticated = false) => authenticated
    ? Math.min(infoFor(value).expiresAtMs, value.refreshExpiresAtMs ?? Number.MAX_SAFE_INTEGER)
    : value.refreshExpiresAtMs ?? Number.MAX_SAFE_INTEGER
  const isProfileAuthenticationFailure = (error: Readonly<AppError>) => error.kind === 'http'
    && (error.status === 401 || error.status === 403)
  const isRefreshRejected = (error: Readonly<AppError>) => error.kind === 'http'
    && (error.status === 401 || error.status === 403)
  const sessionSnapshot = (
    phase: 'checking-health' | 'awaiting-consent' | 'refreshing' | 'local-limited',
    value: StoredSession,
    error: Readonly<AppError> | null = null,
  ): SessionSnapshot => ({ phase, generation, sessionEnded, accountId: value.accountId, expiresAtMs: sessionExpiryFor(value), user: null, error, cleanupError: null })

  const clearPendingTargetRenewal = (reason?: unknown) => {
    const pending = pendingTargetRenewal
    if (!pending) return
    pendingTargetRenewal = null
    pending.signal.removeEventListener('abort', pending.onAbort)
    if (reason !== undefined) pending.reject(reason)
  }

  // Khóa runtime và notify repository trước khi động tới storage/cache.
  const endSession = (reason: Readonly<AppError> | null = null) => {
    if (session) sessionEnded = true
    clearPendingTargetRenewal(sessionError('Phiên đăng nhập đã kết thúc trước khi đổi API URL.'))
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
    if (accessExpired(value)) throw sessionError('Access token đã hết hạn.')
  }
  const requireRefreshSession = (value: StoredSession) => {
    if (refreshExpired(value)) throw sessionError('Refresh session đã hết hạn; cần đăng nhập lại.')
  }
  const validateProfile = (user: CurrentUser, value: StoredSession) => {
    if (user.id !== value.accountId || user.status !== 'active') {
      throw sessionError('Tài khoản không còn hoạt động hoặc không khớp phiên hiện tại.')
    }
  }
  const commit = (value: StoredSession, user: SessionUser, captured: number, persist: boolean) => {
    if (!isCurrent(captured)) return
    const normalized = withRefreshExpiry(value)
    requireActiveToken(normalized)
    requireRefreshSession(normalized)
    if (persist || normalized !== value) options.storage.write(normalized)
    // Storage port là synchronous; kiểm lại generation nếu adapter có invalidation.
    if (!isCurrent(captured)) return
    requireActiveToken(normalized)
    requireRefreshSession(normalized)
    session = Object.freeze({ ...normalized })
    sessionEnded = false
    const safeUser = Object.freeze({ ...user, value: Object.freeze({ ...user.value }) }) as SessionUser
    publish({ phase: 'authenticated', generation, sessionEnded, accountId: value.accountId,
      expiresAtMs: sessionExpiryFor(normalized, true), user: safeUser, error: null, cleanupError: null })
  }

  const waitForTargetRenewal = (target: ApiTarget, candidate: StoredSession, signal: AbortSignal) =>
    new Promise<() => void>((resolve, reject) => {
      if (pendingTargetRenewal) {
        reject(sessionError('Đang có một lần xác nhận phiên để đổi API URL khác.'))
        return
      }
      session = Object.freeze({ ...candidate })
      const pending = {
        target, candidate, captured: generation, signal, resolve, reject,
        onAbort: () => {},
      }
      pending.onAbort = () => {
        if (pendingTargetRenewal !== pending) return
        clearPendingTargetRenewal(new ApiError({ kind: 'cancelled', message: 'Đã hủy xác nhận phiên trên API URL mới.' }))
        if (isCurrent(pending.captured) && session) {
          publish(sessionSnapshot('local-limited', session, safeError(new ApiError({ kind: 'cancelled', message: 'Đổi API URL đã bị hủy; phiên cục bộ vẫn được giữ.' }))))
        }
      }
      pendingTargetRenewal = pending
      if (signal.aborted) pending.onAbort()
      else signal.addEventListener('abort', pending.onAbort, { once: true })
      if (pendingTargetRenewal === pending) publish(sessionSnapshot('awaiting-consent', candidate))
    })

  const verifyTargetAccount = async (target: ApiTarget, signal: AbortSignal): Promise<() => void> => {
    let candidate: StoredSession | null = session
    if (!candidate) {
      const stored = options.storage.read()
      if (stored.status === 'expired' || stored.status === 'valid') candidate = stored.session
    }
    if (!candidate) return () => {}
    if (refreshExpired(candidate)) {
      const failure = sessionError('Refresh session đã hết hạn; cần đăng nhập lại trước khi chạy queue.')
      endSession(safeError(failure))
      throw failure
    }
    if (accessExpired(candidate)) return waitForTargetRenewal(target, candidate, signal)
    const captured = generation
    let user: CurrentUser
    try {
      user = await options.bindSession(candidate.accessToken, target).getMe({ signal })
    } catch (error) {
      const normalized = safeError(error)
      if (accessExpired(candidate) && !refreshExpired(candidate)) return waitForTargetRenewal(target, candidate, signal)
      if (isProfileAuthenticationFailure(normalized)) return waitForTargetRenewal(target, candidate, signal)
      else if (session && isCurrent(captured)) publish(sessionSnapshot('local-limited', session, normalized))
      throw error
    }
    if (!isCurrent(captured)) throw sessionError('Phiên thay đổi trong lúc xác nhận tài khoản trên API mới.')
    try { validateProfile(user, candidate) } catch (error) {
      endSession(safeError(error))
      throw error
    }
    return () => {
      if (!isCurrent(captured) || (session && session.accountId !== candidate?.accountId)) {
        throw sessionError('Phiên thay đổi trước khi công bố API target mới.')
      }
      commit(candidate as StoredSession, { source: 'profile', value: user }, captured, false)
    }
  }

  const checkSession = (): Promise<void> => {
    if (disposed || !session) return Promise.resolve()
    if (refreshExpired(session)) {
      endSession(safeError(sessionError('Refresh session đã hết hạn; cần đăng nhập lại.')))
      return Promise.resolve()
    }
    if (healthTask) return healthTask
    if (renewalTask) return renewalTask
    if (snapshot.phase === 'awaiting-consent') return Promise.resolve()
    const previous = session
    const needsRecoveryCheck = snapshot.phase === 'local-limited'
    const needsRenewal = accessExpired(previous)
    if (!needsRenewal && !needsRecoveryCheck) return Promise.resolve()
    const captured = begin()
    const signal = controller.signal
    // Schedule trước publish để caller đồng thời/reentrant luôn join cùng flow.
    const task = Promise.resolve().then(async () => {
      if (!isCurrent(captured)) return
      try {
        const result = await options.health.check({ signal })
        if (!isCurrent(captured)) return
        if (!result.available) throw new ApiError({ kind: 'network', message: 'Backend chưa sẵn sàng để xác nhận phiên.' })
        requireRefreshSession(previous)
        if (accessExpired(previous)) {
          publish(sessionSnapshot('awaiting-consent', previous))
          return
        }
        const user = await options.bindSession(previous.accessToken).getMe({ signal })
        if (!isCurrent(captured)) return
        try { validateProfile(user, previous) } catch (error) {
          endSession(safeError(error))
          return
        }
        if (refreshExpired(previous)) {
          endSession(safeError(sessionError('Refresh session đã hết hạn; cần đăng nhập lại.')))
          return
        }
        if (accessExpired(previous)) publish(sessionSnapshot('awaiting-consent', previous))
        else commit(previous, { source: 'profile', value: user }, captured, false)
      } catch (error) {
        if (isCurrent(captured)) {
          const normalized = safeError(error)
          if (refreshExpired(previous)) endSession(safeError(sessionError('Refresh session đã hết hạn; cần đăng nhập lại.')))
          else if (isProfileAuthenticationFailure(normalized)) publish(sessionSnapshot('awaiting-consent', previous, normalized))
          else publish(sessionSnapshot('local-limited', previous, normalized))
        }
      }
    }).finally(() => { if (healthTask === task) healthTask = null })
    healthTask = task
    publish(sessionSnapshot('checking-health', previous))
    return task
  }

  const noteBackendOutage = (error: Readonly<AppError>): void => {
    if (disposed || !session || snapshot.phase === 'awaiting-consent' || snapshot.phase === 'refreshing'
      || snapshot.phase === 'checking-health') return
    if (refreshExpired(session)) {
      endSession(safeError(sessionError('Refresh session đã hết hạn; cần đăng nhập lại.')))
      return
    }
    publish(sessionSnapshot('local-limited', session, error))
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
        const restoredSession = withRefreshExpiry(stored.session)
        session = Object.freeze({ ...restoredSession })
        if (restoredSession !== stored.session) options.storage.write(restoredSession)
        if (refreshExpired(restoredSession)) { endSession(safeError(sessionError('Refresh session đã hết hạn; cần đăng nhập lại.'))); return }
        if (accessExpired(restoredSession)) { await checkSession(); return }
        let user: CurrentUser
        try {
          user = await options.bindSession(restoredSession.accessToken).getMe({ signal })
        } catch (error) {
          if (!isCurrent(captured)) return
          const normalized = safeError(error)
          if (isProfileAuthenticationFailure(normalized)) publish(sessionSnapshot('awaiting-consent', restoredSession, normalized))
          else publish(sessionSnapshot('local-limited', restoredSession, normalized))
          return
        }
        if (!isCurrent(captured)) return
        try { validateProfile(user, restoredSession) } catch (error) {
          endSession(safeError(error))
          return
        }
        if (refreshExpired(restoredSession)) { endSession(safeError(sessionError('Refresh session đã hết hạn; cần đăng nhập lại.'))); return }
        if (accessExpired(restoredSession)) { await checkSession(); return }
        commit(restoredSession, { source: 'profile', value: user }, captured, false)
      } catch (error) {
        if (!isCurrent(captured)) return
        const normalized = safeError(error)
        if (normalized.code === 'API_TARGET_SWITCH') {
          if (session) publish(sessionSnapshot('local-limited', session, normalized))
          return
        }
        if (session && refreshExpired(session)) endSession(safeError(sessionError('Refresh session đã hết hạn; cần đăng nhập lại.')))
        else if (session && accessExpired(session) && isProfileAuthenticationFailure(normalized)) await checkSession()
        else if (session && isProfileAuthenticationFailure(normalized)) publish(sessionSnapshot('awaiting-consent', session, normalized))
        else if (session) publish(sessionSnapshot('local-limited', session, normalized))
        else publish(emptySnapshot('anonymous', normalized))
      }
    })().finally(() => { if (restoreTask === task) restoreTask = null })
    restoreTask = task
    return task
  }

  const startSignIn = async (readSession: (signal: AbortSignal) => Promise<{ session: StoredSession; user: SessionUser }>): Promise<void> => {
    assertUsable()
    if (cleanupBlocked || snapshot.phase !== 'anonymous') {
      throw sessionError('Cần kết thúc phiên cũ và dọn phiên thành công trước khi đăng nhập.')
    }
    const captured = begin()
    const signal = controller.signal
    publish(emptySnapshot('signing-in'))
    try {
      options.clearSessionCache()
      const result = await readSession(signal)
      if (!isCurrent(captured)) return
      if (result.user.value.id !== result.session.accountId) throw sessionError('Người dùng đăng nhập không khớp phiên.')
      commit(result.session, result.user, captured, true)
    } catch (error) {
      if (!isCurrent(captured)) return
      const normalized = safeError(error)
      endSession(normalized)
      throw new ApiError(normalized)
    }
  }

  const signIn = (input: LoginRequestDto) => startSignIn(async signal => {
    const result = await options.auth.login(input, { signal })
    return { session: result.session, user: { source: 'login', value: result.user } }
  })

  const signInWithGoogle = ({ accessToken, refreshToken }: { accessToken: string; refreshToken: string }) => startSignIn(async signal => {
    const info = readAccessToken(accessToken)
    if (!info || !refreshToken) throw sessionError('Đăng nhập Google chưa hoàn tất. Vui lòng thử lại.')
    const candidate: StoredSession = { schemaVersion: 1, accessToken, refreshToken, accountId: info.accountId }
    requireActiveToken(candidate)
    const user = await options.bindSession(accessToken).getMe({ signal })
    validateProfile(user, candidate)
    return { session: candidate, user: { source: 'profile', value: user } }
  })

  const confirmRenewal = (accepted: boolean): Promise<void> => {
    assertUsable()
    if (accepted && renewalTask) return renewalTask
    if (snapshot.phase !== 'awaiting-consent' || !session) {
      return Promise.reject(sessionError('Không có yêu cầu gia hạn đang chờ lựa chọn.'))
    }
    if (!accepted) { endSession(); return Promise.resolve() }
    const captured = generation
    const previous = session
    const targetRenewal = pendingTargetRenewal
    const linked = targetRenewal
      ? combineSignals(controller.signal, targetRenewal.signal)
      : combineSignals(controller.signal)
    const signal = linked.signal
    const task = Promise.resolve().then(async () => {
      if (!isCurrent(captured)) return
      let candidate = previous
      let refreshRejected = false
      try {
        requireRefreshSession(previous)
        const request = { refresh_token: previous.refreshToken }
        let renewed: RefreshResult
        try {
          renewed = targetRenewal
            ? await options.auth.refresh(request, { signal }, targetRenewal.target)
            : await options.auth.refresh(request, { signal })
        } catch (error) {
          refreshRejected = isRefreshRejected(safeError(error))
          throw error
        }
        if (!isCurrent(captured)) return
        if (renewed.accountId !== previous.accountId) throw sessionError('Token gia hạn không khớp tài khoản.')
        candidate = {
          ...previous,
          accessToken: renewed.accessToken,
          refreshToken: renewed.refreshToken,
          ...(renewed.refreshExpiresAtMs === undefined ? {} : { refreshExpiresAtMs: renewed.refreshExpiresAtMs }),
          ...(renewed.rememberMe === undefined ? {} : { rememberMe: renewed.rememberMe }),
        }
        requireActiveToken(candidate)
        requireRefreshSession(candidate)
        // Persist token rotation before /users/me: refresh may invalidate the prior token.
        session = Object.freeze({ ...candidate })
        options.storage.write(candidate)
        if (signal.aborted) return
        const bound = targetRenewal
          ? options.bindSession(candidate.accessToken, targetRenewal.target)
          : options.bindSession(candidate.accessToken)
        const user = await bound.getMe({ signal })
        if (!isCurrent(captured)) return
        validateProfile(user, candidate)
        if (targetRenewal) {
          if (pendingTargetRenewal !== targetRenewal || signal.aborted) return
          targetRenewal.resolve(() => {
            if (pendingTargetRenewal !== targetRenewal || signal.aborted || !isCurrent(captured)) {
              throw sessionError('Phiên thay đổi trước khi công bố API URL mới.')
            }
            clearPendingTargetRenewal()
            commit(candidate, { source: 'profile', value: user }, captured, false)
          })
        } else {
          commit(candidate, { source: 'profile', value: user }, captured, false)
        }
      } catch (error) {
        if (!isCurrent(captured)) return
        const normalized = safeError(error)
        if (refreshRejected || normalized.kind === 'session') {
          endSession(normalized)
        } else if (targetRenewal && pendingTargetRenewal === targetRenewal) {
          publish(sessionSnapshot('awaiting-consent', candidate, normalized))
        } else if (isProfileAuthenticationFailure(normalized)) {
          publish(sessionSnapshot('awaiting-consent', candidate, normalized))
        } else {
          publish(sessionSnapshot('local-limited', candidate, normalized))
        }
        throw new ApiError(normalized)
      }
    }).finally(() => {
      linked.dispose()
      if (renewalTask === task) renewalTask = null
    })
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
    if (isCurrent(captured) && revokeError) {
      publish(emptySnapshot('anonymous', {
        ...revokeError,
        message: 'Chưa xác nhận được việc thu hồi phiên trên máy chủ.',
      }, cleanupError))
    }
    return { serverRevoked, revokeError, cleanupError }
  }

  const deleteAccount = async (): Promise<void> => {
    assertUsable()
    if (!session || snapshot.phase !== 'authenticated') throw sessionError('Cần đăng nhập để xóa tài khoản.')
    requireActiveToken(session)
    const bound = options.bindSession(session.accessToken)
    if (!bound.deleteMe) throw sessionError('Dịch vụ xóa tài khoản chưa khả dụng.')
    const captured = generation
    await bound.deleteMe({ signal: controller.signal })
    // Backend revokes all sessions when deleting the account.
    if (isCurrent(captured)) endSession()
  }

  const subscribe = (listener: () => void) => {
    if (disposed) return () => {}
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  const draftAccess: DraftAccessPort = Object.freeze({
    read: () => {
      if (disposed || cleanupBlocked || !session || snapshot.accountId !== session.accountId || refreshExpired(session)) return null
      // Access-token expiry blocks remote requests, not local reads. If the backend
      // omitted refresh expiry (legacy/OAuth), let the backend decide on reconnect.
      const localExpiry = session.refreshExpiresAtMs ?? Number.MAX_SAFE_INTEGER
      return { accountId: session.accountId, generation, expiresAtMs: localExpiry }
    },
    subscribe,
  })

  const dispose = () => {
    if (disposed) return
    clearPendingTargetRenewal(new ApiError({ kind: 'cancelled', message: 'Runtime phiên đã được đóng.' }))
    begin()
    disposed = true
    session = null
    publish(emptySnapshot('anonymous'))
    listeners.clear()
    // Đóng instance không phải logout: giữ credential/draft cho instance mới restore.
  }

  return { getSnapshot: () => snapshot, subscribe, restore, signIn, signInWithGoogle, signOut, deleteAccount, confirmRenewal, checkSession, verifyTargetAccount, noteBackendOutage, draftAccess, dispose }
}
