import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './auth-context'
import type { AppRuntime } from '../app-runtime'
import type { AppError } from '../../types/api/api.types'
import type { SessionSnapshot } from '../../types/auth/session-coordinator.types'
import { ApiError } from '../../lib/api-error'

const unavailable: SessionSnapshot = Object.freeze({
  phase: 'anonymous', generation: 0, sessionEnded: false, accountId: null, user: null,
  expiresAtMs: null, error: null, cleanupError: null,
})
const getUnavailable = () => unavailable
const noSubscription = () => () => {}

type Props = { runtime: AppRuntime | null; configurationError?: Readonly<AppError> | null; children: ReactNode }

export const AuthProvider = ({ runtime, configurationError = null, children }: Props) => {
  const coordinator = runtime?.coordinator
  const snapshot = useSyncExternalStore(coordinator?.subscribe ?? noSubscription, coordinator?.getSnapshot ?? getUnavailable, getUnavailable)

  useEffect(() => {
    if (!runtime) return
    const release = runtime.retain()
    void runtime.coordinator.restore()
    return release
  }, [runtime])

  useEffect(() => {
    if (!coordinator) return
    const onFocus = () => { void coordinator.checkSession() }
    const onVisibility = () => { if (document.visibilityState === 'visible') onFocus() }
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [coordinator])

  useEffect(() => {
    if (!coordinator || snapshot.expiresAtMs === null
      || (snapshot.phase !== 'authenticated' && snapshot.phase !== 'local-limited')) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      const delay = snapshot.expiresAtMs! - Date.now()
      if (!Number.isFinite(delay) || delay <= 0) { void coordinator.checkSession(); return }
      timer = setTimeout(schedule, Math.min(delay, 2_147_483_647))
    }
    schedule()
    return () => { clearTimeout(timer) }
  }, [coordinator, snapshot.phase, snapshot.expiresAtMs])

  const value = useMemo(() => {
    const missing = () => new ApiError(configurationError ?? { kind: 'config', message: 'Dịch vụ đăng nhập chưa khả dụng.' })
    return {
      snapshot, configurationError,
      signIn: coordinator?.signIn ?? (() => Promise.reject(missing())),
      signOut: coordinator?.signOut ?? (() => Promise.reject(missing())),
      confirmRenewal: coordinator?.confirmRenewal ?? (() => Promise.reject(missing())),
    }
  }, [snapshot, configurationError, coordinator])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
