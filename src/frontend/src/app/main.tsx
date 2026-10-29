import React from 'react'
import { createRoot } from 'react-dom/client'
import './design-tokens.css'
import './style.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Không tìm thấy phần tử #root để khởi tạo ứng dụng')
}

const root = createRoot(rootElement)
root.render(<main className="session-wait" role="status" aria-busy="true"><span className="loading-mark" aria-hidden="true" /><h1>Đang mở ứng dụng</h1></main>)

// Build-time DEV removes this import (including fixtures/Three) from production.
// Branch before importing auth composition: preview never constructs a session runtime.
if (import.meta.env.DEV && window.location.pathname === '/preview/workspaces-3d') {
  void import('../views/workspace-3d/workspace-3d-preview').then(({ Workspace3DPreview }) => {
    root.render(<React.StrictMode><Workspace3DPreview /></React.StrictMode>)
  }).catch(() => {
    root.render(<main className="session-wait" role="alert"><h1>Không thể mở preview 3D</h1><p>Hãy tải lại trang hoặc kiểm tra dev server.</p></main>)
  })
} else {
  void import('./application-bootstrap').then(({ Application }) => {
    root.render(<React.StrictMode><Application /></React.StrictMode>)
  }).catch(() => {
    root.render(<main className="session-wait" role="alert"><h1>Không thể khởi tạo ứng dụng</h1><p>Hãy tải lại trang hoặc kiểm tra kết nối.</p></main>)
  })
}
