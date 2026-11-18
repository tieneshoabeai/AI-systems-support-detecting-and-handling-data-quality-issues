import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext } from '../../hooks/auth/auth-context'
import { ManagementStoreContext, type ManagementStore } from '../../hooks/preview/use-preview-store'
import { createAxiosClient } from '../../lib/axios-client'
import { createSessionStorage } from '../../lib/session-storage'
import { isShoppingDemo } from '../../mocks/shopping-trends/demo-mode'
import { createManagementStore } from '../../services/management/management.store'
import type { SessionSnapshot } from '../../types/auth/session-coordinator.types'
import { readAccessToken } from '../../utils/auth/access-token'
import { normalizeApiError } from '../../lib/api-error'
import { ProcessingDataContext } from './processing-data-context'
import type { Person } from '../../types/preview/preview.types'

type LoadResult = {
  snapshot: SessionSnapshot
  projectId?: string
  store?: ManagementStore
  error?: string
  missing?: boolean
}

const sessionAccount = (snapshot: SessionSnapshot | undefined): Person => {
  const user = snapshot?.user?.value
  const name = user ? ('firstName' in user ? `${user.firstName} ${user.lastName}`.trim() || user.email : user.email) : 'Tài khoản'
  return { id: snapshot?.accountId ?? '', name, email: user?.email ?? '', role: user?.role ?? '', initials: name.slice(0, 2).toUpperCase() }
}

function SessionDataProvider({ children, projectId }: { children: ReactNode; projectId?: string }) {
  const auth = useContext(AuthContext)
  const snapshot = auth?.snapshot
  const fixture = isShoppingDemo()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<LoadResult | null>(null)
  const pendingStore = useMemo(() => projectId === undefined ? null : createManagementStore({
    request: () => Promise.reject(new Error('Dữ liệu project chưa sẵn sàng.')),
  }, sessionAccount(snapshot)).store, [projectId, snapshot])

  useEffect(() => {
    if (fixture || snapshot?.phase !== 'authenticated') return
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
          const current = storage.read()
          return current.status === 'valid' && current.session.accountId === snapshot.accountId
            ? current.session.accessToken : null
        },
      })
      const data = createManagementStore(api, sessionAccount(snapshot), {
        ...(projectId === undefined ? {} : { projectId, signal: controller.signal }), readSessionId: () => {
        const current = storage.read()
        return current.status === 'valid' && current.session.accountId === snapshot.accountId
          ? readAccessToken(current.session.accessToken)?.sessionId ?? null : null
      } })
      dispose = data.dispose
      const scope = projectId === undefined ? {} : { projectId }
      void data.load().then(() => {
        if (active) setResult({ snapshot, ...scope, store: data.store })
      }).catch((error: unknown) => {
        if (!active) return
        const failure = normalizeApiError(error)
        setResult({ snapshot, ...scope, error: error instanceof Error ? error.message : failure.message, missing: failure.status === 404 })
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không kết nối được máy chủ.'
      queueMicrotask(() => { if (active) setResult({ snapshot, ...(projectId === undefined ? {} : { projectId }), error: message }) })
    }
    return () => { active = false; controller.abort(); dispose?.() }
  }, [snapshot, attempt, fixture, projectId])

  // Isolated previews and the existing authenticated Shopping demo retain their fixture store.
  // The route guard remains responsible for admission; API failures never select fixtures.
  if (!auth || fixture) return children
  if (pendingStore) {
    const current = result?.snapshot === snapshot && result?.projectId === projectId ? result : null
    const error = snapshot?.phase === 'authenticated' ? current?.error : 'Cần phiên đăng nhập trực tuyến để mở project.'
    const status = { loading: !current?.store && !error, ...(error ? { error } : {}),
      ...(current?.missing ? { missing: true } : {}), retry: () => { setResult(null); setAttempt(value => value + 1) } }
    return <ProcessingDataContext.Provider value={status}>
      <ManagementStoreContext.Provider value={current?.store ?? pendingStore}>{children}</ManagementStoreContext.Provider>
    </ProcessingDataContext.Provider>
  }
  if (snapshot?.phase !== 'authenticated') {
    return <p role="status">Cần phiên đăng nhập trực tuyến để quản lý dữ liệu.</p>
  }
  if (result?.snapshot !== snapshot || (!result.store && !result.error)) {
    return <p role="status">Đang tải workspace và project…</p>
  }
  if (result.error) {
    return <div role="alert"><p>{result.error}</p><button type="button" onClick={() => {
      setResult(null)
      setAttempt(value => value + 1)
    }}>Thử lại</button></div>
  }
  return <ManagementStoreContext.Provider value={result.store!}>{children}</ManagementStoreContext.Provider>
}

export function ManagementDataProvider({ children }: { children: ReactNode }) {
  return <SessionDataProvider>{children}</SessionDataProvider>
}

export function ProcessingDataProvider({ children, projectId }: { children: ReactNode; projectId: string }) {
  return <SessionDataProvider projectId={projectId}>{children}</SessionDataProvider>
}
