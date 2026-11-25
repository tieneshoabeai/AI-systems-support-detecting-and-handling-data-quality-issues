import { legacyManagementRedirect } from '../services/preview/preview-route'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { PageSkeleton } from '../components/loading'
import '../styles/tokens.css'
import '../styles/global.css'
import '../styles/glass.css'
import './style.css'
import '../views/auth/login-glass.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}offline-shell.js`).catch(() => {})
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Không tìm thấy phần tử #root để khởi tạo ứng dụng')
}

const root = createRoot(rootElement)
root.render(<PageSkeleton pathname={window.location.pathname} message="Đang mở ứng dụng" />)

// The standalone Workspace 3D preview remains a separate development tool.
// Management, Processing and Dataset 3D always use the application auth runtime.
const is3DPreview = import.meta.env.DEV && window.location.pathname === '/preview/workspaces-3d'
const isWorkbench = import.meta.env.DEV && import.meta.env['VITE_MANAGEMENT_DATA_MODE'] === 'mock' && (
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
  }).catch(() => { root.render(<p role="alert">Không mở được bản xem thử.</p>) })
} else {
  void import('./application-bootstrap').then(({ Application }) => {
    root.render(<React.StrictMode><Application /></React.StrictMode>)
  }).catch(() => {
    root.render(<main className="session-wait" role="alert"><h1>Không thể khởi tạo ứng dụng</h1><p>Hãy tải lại trang hoặc kiểm tra kết nối.</p></main>)
  })
}
