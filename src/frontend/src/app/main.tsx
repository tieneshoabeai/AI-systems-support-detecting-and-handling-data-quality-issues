import React from 'react'
import { createRoot } from 'react-dom/client'
import { PageSkeleton } from '../components/loading/page-skeleton'
import { legacyManagementRedirect } from '../services/preview/preview-route'
import './design-tokens.css'
import './style.css'
import '../views/auth/login-glass.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Không tìm thấy phần tử #root để khởi tạo ứng dụng')
}

const root = createRoot(rootElement)
root.render(<PageSkeleton pathname={window.location.pathname} message="Đang mở ứng dụng" />)

// Development UI review bypasses runtime construction while the API is unavailable.
// Production reaches management/processing through Application and its auth guard.
// Legacy URL helpers are pure and do not load fixture/CSS modules at startup.
const is3DPreview = import.meta.env.DEV && window.location.pathname === '/preview/workspaces-3d'
const isWorkbench = import.meta.env.DEV && (
  /^\/(management|processing)(\/|$)/.test(window.location.pathname)
  || legacyManagementRedirect(window.location.pathname, window.location.hash) !== null
)

if (is3DPreview) {
  void import('../views/workspace-3d/workspace-3d-preview').then(({ Workspace3DPreview }) => {
    root.render(<React.StrictMode><Workspace3DPreview /></React.StrictMode>)
  }).catch(() => {
    root.render(<main className="session-wait" role="alert"><h1>Không thể mở preview 3D</h1><p>Hãy tải lại trang hoặc kiểm tra dev server.</p></main>)
  })
} else if (isWorkbench) {
  void import('./router/workbench-routes').then(({ WorkbenchEntry }) => {
    root.render(<React.StrictMode><WorkbenchEntry /></React.StrictMode>)
  }).catch(() => {
    root.render(<main className="session-wait" role="alert"><h1>Không thể mở preview 2D</h1><p>Hãy tải lại trang hoặc kiểm tra dev server.</p></main>)
  })
} else {
  void import('./application-bootstrap').then(({ Application }) => {
    root.render(<React.StrictMode><Application /></React.StrictMode>)
  }).catch(() => {
    root.render(<main className="session-wait" role="alert"><h1>Không thể khởi tạo ứng dụng</h1><p>Hãy tải lại trang hoặc kiểm tra kết nối.</p></main>)
  })
}
