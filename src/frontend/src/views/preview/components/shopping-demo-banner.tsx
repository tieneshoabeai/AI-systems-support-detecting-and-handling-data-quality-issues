import { useContext, useState } from 'react'
import { Link } from 'react-router'
import { isShoppingDemo } from '../../../mocks/shopping-trends/demo-mode'
import { clearDemoProject, getDemoStorageIssue } from '../../../mocks/shopping-trends/demo-storage'
import { previewMockStore } from '../../../services/preview/preview-mock.service'
import './shopping-demo.css'
import { AuthContext } from '../../../hooks/auth/auth-context'
export function ShoppingDemoBanner() {
  const [error, setError] = useState<string | null>(null)
  const auth = useContext(AuthContext)
  if (!isShoppingDemo()) return null
  const reset = () => {
    try { clearDemoProject(); previewMockStore.reset(); window.location.assign('/processing/projects/shopping-trends') }
    catch { setError('Không reset được demo. Hãy cho phép sessionStorage rồi thử lại.') }
  }
  return <aside className="shopping-demo-banner" aria-label="Chế độ demo">
    <strong>Demo — không kết nối backend</strong>
    <Link to="/processing/projects/shopping-trends">Mở Shopping Trends</Link>
    <button onClick={reset}>Reset demo</button>
    {auth && <button onClick={() => { void auth.signOut().then(() => window.location.assign('/auth/login')).catch(() => setError('Không đăng xuất được phiên demo.')) }}>Đăng xuất demo</button>}
    {(error || getDemoStorageIssue()) && <span role="alert">{error || getDemoStorageIssue()}</span>}
  </aside>
}
