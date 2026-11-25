import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext } from '../../hooks/auth/auth-context'
import { ManagementStoreContext, type ManagementStore } from '../../hooks/management/use-management-store'
import { ManagementLoadingContext, ManagementOverviewLoaderContext, ManagementPersonalLoadingContext, type ManagementLoading } from '../../hooks/management/management-loading-context'
import { createAxiosClient } from '../../lib/axios-client'
import { createSessionStorage } from '../../lib/session-storage'
import { createManagementStore } from '../../services/management/management.store'
import type { SessionSnapshot } from '../../types/auth/session-coordinator.types'
import { readAccessToken } from '../../utils/auth/access-token'
import { normalizeApiError } from '../../lib/api-error'
import { ProcessingDataContext } from './processing-data-context'
import type { Person } from '../../types/management/management.types'

type LoadResult = {
  snapshot: SessionSnapshot
  progressiveProjects?: boolean
  projectId?: string
  store?: ManagementStore
  error?: string
  missing?: boolean
  projectPermissionsPending?: boolean
  personalStatus?: ManagementLoading | null
  overviewLoader?: ManagementStore['getWorkspaceOverview']
}

const sessionAccount = (snapshot: SessionSnapshot | undefined): Person => {
  const user = snapshot?.user?.value
  const name = user ? ('firstName' in user ? `${user.firstName} ${user.lastName}`.trim() || user.email : user.email) : 'Tài khoản'
  return { id: snapshot?.accountId ?? '', name, email: user?.email ?? '', role: user?.role ?? '', initials: name.slice(0, 2).toUpperCase() }
}

function SessionDataProvider({ children, projectId, recent = false, progressiveProjects = false }: {
  children: ReactNode; projectId?: string; recent?: boolean; progressiveProjects?: boolean
}) {
  const auth = useContext(AuthContext)
  const snapshot = auth?.snapshot
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<LoadResult | null>(null)
  const pendingStore = useMemo(() => createManagementStore({
    request: () => Promise.reject(new Error('Dữ liệu chưa sẵn sàng.')),
  }, sessionAccount(snapshot)).store, [snapshot])

  useEffect(() => {
    if (snapshot?.phase !== 'authenticated') return
    let active = true
    let dispose: (() => void) | undefined
    const controller = new AbortController()
    try {
      const storage = createSessionStorage()
      const session = storage.read()
      if (session.status !== 'valid' || session.session.accountId !== snapshot.accountId) {
        throw new Error('Phiên đăng nhập chưa sẵn sàng. Vui lòng đăng nhập lại.')
      }
      const api = createAxiosClient({
        readToken: () => {
          if (!active || controller.signal.aborted) return null
          const current = storage.read()
          return current.status === 'valid' && current.session.accountId === snapshot.accountId
            ? current.session.accessToken : null
        },
      })
      const data = createManagementStore(api, sessionAccount(snapshot), {
        progressiveProjects,
        ...(projectId === undefined ? {} : { projectId }),
        ...(recent ? { recent } : {}),
        signal: controller.signal,
        readSessionId: () => {
        const current = storage.read()
        return current.status === 'valid' && current.session.accountId === snapshot.accountId
          ? readAccessToken(current.session.accessToken)?.sessionId ?? null : null
      } })
      dispose = data.dispose
      const scope = { ...(projectId === undefined ? {} : { projectId }), progressiveProjects }
      const overviewLoader = !recent && projectId === undefined ? data.store.getWorkspaceOverview : undefined
      if (overviewLoader) setResult({ snapshot, ...scope, overviewLoader })
      const loaded = { snapshot, ...scope, store: data.store, overviewLoader }
      void (recent ? Promise.resolve() : data.loadCore(() => {
        if (active) setResult({ ...loaded, projectPermissionsPending: true })
      })).then(() => {
        if (!active) return
        if (recent || projectId !== undefined) {
          setResult(loaded)
          return
        }
        const loadPersonal = () => {
          if (!active) return
          setResult({ ...loaded, personalStatus: { phase: 'loading' } })
          void data.loadPersonal().then(() => {
            if (active) setResult(loaded)
          }).catch((error: unknown) => {
            if (!active) return
            const message = error instanceof Error ? error.message : 'Không tải được dữ liệu cá nhân.'
            setResult({ ...loaded, personalStatus: { phase: 'error', message, retry: loadPersonal } })
          })
        }
        loadPersonal()
      }).catch((error: unknown) => {
        if (!active) return
        const failure = normalizeApiError(error)
        setResult({ snapshot, ...scope, overviewLoader, error: error instanceof Error ? error.message : failure.message, missing: failure.status === 404 })
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không kết nối được máy chủ.'
      queueMicrotask(() => { if (active) setResult({ snapshot, progressiveProjects, ...(projectId === undefined ? {} : { projectId }), error: message }) })
    }
    return () => { active = false; controller.abort(); dispose?.() }
  }, [snapshot, attempt, projectId, recent, progressiveProjects])

  // Standalone mounts can supply their own ManagementStoreContext.
  if (!auth) return children
  const current = result?.snapshot === snapshot && result?.projectId === projectId && result?.progressiveProjects === progressiveProjects ? result : null
  const retry = () => { setResult(null); setAttempt(value => value + 1) }
  if (projectId !== undefined) {
    const error = snapshot?.phase === 'authenticated' ? current?.error : 'Cần phiên đăng nhập trực tuyến để mở project.'
    const status = { loading: !current?.store && !error, permissionsPending: current?.projectPermissionsPending === true, ...(error ? { error } : {}),
      ...(current?.missing ? { missing: true } : {}), retry }
    return <ProcessingDataContext.Provider value={status}>
      <ManagementStoreContext.Provider value={current?.store ?? pendingStore}>{children}</ManagementStoreContext.Provider>
    </ProcessingDataContext.Provider>
  }
  let status: ManagementLoading | null = null
  if (snapshot?.phase !== 'authenticated') status = { phase: 'error', message: 'Cần phiên đăng nhập trực tuyến để quản lý dữ liệu.' }
  else if (current?.error) status = { phase: 'error', message: current.error, retry }
  else if (!current?.store) status = { phase: 'loading' }

  return <ManagementLoadingContext.Provider value={status}>
    <ManagementPersonalLoadingContext.Provider value={current?.personalStatus ?? null}>
      <ManagementOverviewLoaderContext.Provider value={current?.overviewLoader}>
        <ManagementStoreContext.Provider value={current?.store ?? pendingStore}>{children}</ManagementStoreContext.Provider>
      </ManagementOverviewLoaderContext.Provider>
    </ManagementPersonalLoadingContext.Provider>
  </ManagementLoadingContext.Provider>
}

export function ManagementDataProvider({ children, progressiveProjects = false }: { children: ReactNode; progressiveProjects?: boolean }) {
  return <SessionDataProvider progressiveProjects={progressiveProjects}>{children}</SessionDataProvider>
}

export function ProcessingDataProvider({ children, projectId }: { children: ReactNode; projectId?: string }) {
  return projectId === undefined
    ? <SessionDataProvider recent>{children}</SessionDataProvider>
    : <SessionDataProvider projectId={projectId}>{children}</SessionDataProvider>
}
