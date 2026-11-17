import { useContext, useEffect, useState, type ReactNode } from 'react'
import { AuthContext } from '../../hooks/auth/auth-context'
import { ManagementStoreContext, type ManagementStore } from '../../hooks/preview/use-preview-store'
import { createAxiosClient } from '../../lib/axios-client'
import { createSessionStorage } from '../../lib/session-storage'
import { isShoppingDemo } from '../../mocks/shopping-trends/demo-mode'
import { createManagementStore } from '../../services/management/management.store'
import type { SessionSnapshot } from '../../types/auth/session-coordinator.types'

type LoadResult = {
  snapshot: SessionSnapshot
  store?: ManagementStore
  error?: string
}

export function ManagementDataProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext)
  const snapshot = auth?.snapshot
  const fixture = isShoppingDemo()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<LoadResult | null>(null)

  useEffect(() => {
    if (fixture || snapshot?.phase !== 'authenticated') return
    let active = true
    let dispose: (() => void) | undefined
    try {
      const storage = createSessionStorage()
      const session = storage.read()
      if (session.status !== 'valid' || session.session.accountId !== snapshot.accountId) {
        throw new Error('Phiên đăng nhập chưa sẵn sàng. Vui lòng đăng nhập lại.')
      }
      const user = snapshot.user.value
      const name = 'firstName' in user ? `${user.firstName} ${user.lastName}`.trim() : user.email
      const api = createAxiosClient({
        readToken: () => {
          const current = storage.read()
          return current.status === 'valid' && current.session.accountId === snapshot.accountId
            ? current.session.accessToken : null
        },
      })
      const data = createManagementStore(api, {
        id: snapshot.accountId, name, email: user.email, role: user.role,
        initials: name.slice(0, 2).toUpperCase(),
      })
      dispose = data.dispose
      void data.load().then(() => {
        if (active) setResult({ snapshot, store: data.store })
      }).catch((error: unknown) => {
        if (active) setResult({ snapshot, error: error instanceof Error ? error.message : 'Không tải được dữ liệu.' })
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không kết nối được máy chủ.'
      queueMicrotask(() => { if (active) setResult({ snapshot, error: message }) })
    }
    return () => { active = false; dispose?.() }
  }, [snapshot, attempt, fixture])

  // Isolated previews and the existing authenticated Shopping demo retain their fixture store.
  // The route guard remains responsible for admission; API failures never select fixtures.
  if (!auth || fixture) return children
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
