import React from 'react'
import { createRoot } from 'react-dom/client'
import { is2DPreviewUrl } from '../views/preview/preview-url'
import './design-tokens.css'
import './style.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Không tìm thấy phần tử #root để khởi tạo ứng dụng')
}

const root = createRoot(rootElement)
root.render(<main className="session-wait" role="status" aria-busy="true"><span className="loading-mark" aria-hidden="true" /><h1>Đang mở ứng dụng</h1></main>)

// Build-time DEV removes these imports (including fixtures/Three) from production.
// Branch before importing auth composition: preview never constructs a session runtime.
// preview-url.ts không kéo theo CSS/fixture nên tham chiếu tĩnh an toàn.
const previewUrl = `${window.location.pathname}${window.location.hash}`
const is3DPreview = import.meta.env.DEV && window.location.pathname === '/preview/workspaces-3d'
const is2DPreview = import.meta.env.DEV && is2DPreviewUrl(previewUrl)

if (is3DPreview) {
  void import('../views/workspace-3d/workspace-3d-preview').then(({ Workspace3DPreview }) => {
    root.render(<React.StrictMode><Workspace3DPreview /></React.StrictMode>)
  }).catch(() => {
    root.render(<main className="session-wait" role="alert"><h1>Không thể mở preview 3D</h1><p>Hãy tải lại trang hoặc kiểm tra dev server.</p></main>)
  })
} else if (is2DPreview) {
  void import('../views/preview/preview-entry').then(({ Preview2DEntry }) => {
    root.render(<React.StrictMode><Preview2DEntry /></React.StrictMode>)
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
