import React from 'react'
import { createRoot } from 'react-dom/client'
import { PageSkeleton } from '../components/loading'
import '../styles/tokens.css'
import '../styles/global.css'
import './style.css'
import '../views/auth/login-glass.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Không tìm thấy phần tử #root để khởi tạo ứng dụng')
}

const root = createRoot(rootElement)
root.render(<PageSkeleton pathname={window.location.pathname} message="Đang mở ứng dụng" />)

void import('./application-bootstrap').then(({ Application }) => {
  root.render(<React.StrictMode><Application /></React.StrictMode>)
}).catch(() => {
  root.render(<main className="session-wait" role="alert"><h1>Không thể khởi tạo ứng dụng</h1><p>Hãy tải lại trang hoặc kiểm tra kết nối.</p></main>)
})
