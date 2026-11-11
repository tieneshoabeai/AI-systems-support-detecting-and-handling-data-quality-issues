import { Link } from 'react-router'

export function NotFoundView({ title = 'Không tìm thấy trang' }: { title?: string }) {
  return <main className="session-wait">
    <span className="eyebrow">404</span>
    <h1 id="page-heading" tabIndex={-1}>{title}</h1>
    <p>Kiểm tra địa chỉ hoặc quay về khu vực làm việc.</p>
    <Link className="text-link" to="/management">Về Quản lý</Link>
    <Link className="text-link" to="/processing">Về Xử lý dữ liệu</Link>
  </main>
}
