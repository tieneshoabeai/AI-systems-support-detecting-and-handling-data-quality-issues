import { useContext, useEffect, useState, type ReactNode } from 'react'
import { AuthContext } from '../../hooks/auth/auth-context'
import { ManagementStoreContext, type ManagementStore } from '../../hooks/preview/use-preview-store'
import { createAxiosClient } from '../../lib/axios-client'
import { createSessionStorage } from '../../lib/session-storage'
import { createManagementStore } from '../../services/management/management.store'

export function ManagementDataProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext)
  const snapshot = auth?.snapshot
  const generation = snapshot?.generation
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ generation?: number | undefined; store?: ManagementStore; error?: string }>({})
  useEffect(() => {
    if (!snapshot || snapshot.phase !== 'authenticated') return
    let active = true
    let dispose: (() => void) | undefined
    try {
      const session = createSessionStorage().read()
      if (session.status !== 'valid' || session.session.accountId !== snapshot.accountId) throw new Error('Phiên đăng nhập chưa sẵn sàng. Vui lòng đăng nhập lại.')
      const u = snapshot.user.value
      const name = 'firstName' in u ? `${u.firstName} ${u.lastName}`.trim() : u.email
      const data = createManagementStore(createAxiosClient({ readToken: () => { const current = createSessionStorage().read(); return current.status === 'valid' && current.session.accountId === snapshot.accountId ? current.session.accessToken : null } }), { id: snapshot.accountId, name, email: u.email, role: u.role, initials: name.slice(0, 2).toUpperCase() })
      dispose = data.dispose
      void data.load().then(() => { if (active) setResult({ generation, store: data.store }) })
        .catch(error => { if (active) setResult({ generation, error: error instanceof Error ? error.message : 'Không tải được dữ liệu.' }) })
    } catch (error) { queueMicrotask(() => { if (active) setResult({ generation, error: error instanceof Error ? error.message : 'Không kết nối được máy chủ.' }) }) }
    return () => { active = false; dispose?.() }
  }, [snapshot, generation, attempt])
  // Standalone development review keeps fixtures. Authenticated routes always use the API.
  if (!auth) return children
  if (snapshot?.phase !== 'authenticated') return <p role="status">Cần phiên đăng nhập trực tuyến để quản lý dữ liệu.</p>
  if (result.generation !== generation || (!result.store && !result.error)) return <p role="status">Đang tải workspace và project…</p>
  if (result.error) return <div role="alert"><p>{result.error}</p><button onClick={() => { setResult({}); setAttempt(n => n + 1) }}>Thử lại</button></div>
  return <ManagementStoreContext.Provider value={result.store!}>{children}</ManagementStoreContext.Provider>
}
