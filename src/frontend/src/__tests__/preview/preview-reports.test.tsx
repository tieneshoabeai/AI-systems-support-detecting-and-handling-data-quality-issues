import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { ReportCenter } from '../../views/preview/components/report-center'
import { previewMockStore } from '../../services/preview/preview-mock.service'
import { renderFrame, resetPreviewStore } from './preview-test-kit'

// Suite riêng cho trung tâm báo cáo (Design Board nhóm 02–03, đặc tả Shell dòng 7). Toàn bộ
// vòng đời tạo · xem danh sách · chi tiết chạy TRONG ô popover của nút "?", nên test render
// trực tiếp <ReportCenter /> (bỏ qua lớp popover của topbar) rồi assert nội dung + trạng thái
// mock store. Hành vi "bấm ? mở ô, không đổi hash" thuộc về topbar → nằm ở preview-shell.test.tsx.
// Mọi số đếm suy từ fixture (8 bản ghi: 3 đang xử lý · 1 cần bổ sung · 4 đã xử lý), không có
// con số viết tay dễ lệch; gửi một báo cáo là mutation optimistic nên test đọc lại getState().

const openList = (): void => {
  renderFrame(<ReportCenter />)
  fireEvent.click(screen.getByRole('button', { name: /Xem các báo cáo của tôi/ }))
}
const openCreate = (): void => {
  renderFrame(<ReportCenter />)
  fireEvent.click(screen.getByRole('button', { name: /Tạo báo cáo mới/ }))
}
const rowCount = (): number => document.querySelectorAll('.report-row').length
const paginationInfo = (): string => document.querySelector('.pagination-info')?.textContent ?? ''

beforeEach(() => { resetPreviewStore(); window.localStorage.clear(); window.location.hash = '' })
afterEach(() => { cleanup(); window.location.hash = '' })

it('fixture: 8 báo cáo chia đúng bộ tab mockup và giữ nguyên mã công khai 4 dòng đầu', () => {
  const reports = previewMockStore.getState().reports
  expect(reports).toHaveLength(8)
  const by = (status: string): number => reports.filter(item => item.status === status).length
  expect(by('processing')).toBe(3)
  expect(by('needs-info')).toBe(1)
  expect(by('resolved')).toBe(4)
  expect(reports.slice(0, 4).map(item => item.code))
    .toEqual(['DV-250120-001', 'DV-250118-007', 'DV-250115-005', 'DV-250112-003'])
})

it('landing (02): hai nút vào — tạo mới · xem của tôi — là điểm khởi đầu của ô', () => {
  renderFrame(<ReportCenter />)
  expect(screen.getByText('Báo cáo vấn đề')).toBeDefined()
  expect(screen.getByRole('button', { name: /Tạo báo cáo mới/ })).toBeDefined()
  expect(screen.getByRole('button', { name: /Xem các báo cáo của tôi/ })).toBeDefined()
  // Ghi chú phạm vi của ô hiển thị ngay trong popover, không phải tooltip.
  expect(screen.getByText(/Mọi thao tác báo cáo diễn ra trong ô này/)).toBeDefined()
})

it('tạo (3.1): gửi khi thiếu trường thì báo ngay trong form, không thêm bản ghi', () => {
  openCreate()
  fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))
  expect(screen.getByRole('alert').textContent).toContain('Cần điền')
  expect(previewMockStore.getState().reports).toHaveLength(8)
})

it('tạo (3.1): chọn tệp → hiện đúng tên + cỡ đo được từ tệp', () => {
  openCreate()
  const input = screen.getByLabelText('Chọn tệp đính kèm')
  const file = new File(['x'.repeat(2048)], 'log.png', { type: 'image/png' })
  Object.defineProperty(input, 'files', { value: [file] })
  fireEvent.change(input)
  expect(screen.getByText(/log\.png/)).toBeDefined()
  expect(screen.getByText(/2 KB/)).toBeDefined()
})

it('tạo (3.1): Hủy quay về landing mà không thêm bản ghi', () => {
  openCreate()
  fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: 'nháp' } })
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
  expect(screen.getByRole('button', { name: /Xem các báo cáo của tôi/ })).toBeDefined()
  expect(screen.queryByLabelText(/Tiêu đề/)).toBeNull()
  expect(previewMockStore.getState().reports).toHaveLength(8)
})

it('tạo (3.1): điền đủ → gửi → optimistic thêm vào đầu danh sách + toast thành công', async () => {
  openCreate()
  fireEvent.change(screen.getByLabelText(/Loại vấn đề/), { target: { value: 'data' } })
  fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: 'Lỗi test tự động' } })
  fireEvent.change(screen.getByLabelText(/Mô tả chi tiết/), { target: { value: 'Mô tả dùng cho test.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))

  const reports = previewMockStore.getState().reports
  expect(reports).toHaveLength(9)
  expect(reports[0].title).toBe('Lỗi test tự động')
  expect(reports[0].issueType).toBe('data')
  expect(reports[0].status).toBe('processing')
  // Mã mới mang cùng mốc ngày mẫu nhưng không trùng mã đã vẽ trong Design Board.
  expect(reports[0].code).toMatch(/^DV-250120-\d{3}$/)
  // Sau gửi nhảy sang danh sách để thấy ngay dòng vừa thêm ở đầu.
  expect(rowCount()).toBeGreaterThan(0)
  expect(await screen.findByText(/Đã gửi báo cáo/)).toBeDefined()
})

it('danh sách (3.2): tab đếm đúng, 6 dòng/trang — TRONG Ô không còn dòng "Hiển thị…"', () => {
  openList()
  expect(screen.getByRole('tab', { name: 'Tất cả (8)' })).toBeDefined()
  expect(screen.getByRole('tab', { name: 'Đang xử lý (3)' })).toBeDefined()
  expect(screen.getByRole('tab', { name: 'Cần bổ sung (1)' })).toBeDefined()
  expect(screen.getByRole('tab', { name: 'Đã xử lý (4)' })).toBeDefined()
  expect(rowCount()).toBe(6)
  // Chủ batch 03/11 bỏ dòng đếm trong popover: ô nhỏ chỉ ~440px, mỗi dòng chữ lấy thêm một
  // hàng chiều cao trong khi danh sách đã cuộn. Trang nào thì nút số đang sáng đã trả lời đủ.
  expect(paginationInfo()).toBe('')
  expect(screen.getByRole('button', { name: '1' }).getAttribute('aria-current')).toBe('page')
})

it('danh sách (3.2): lọc theo tab chỉ giữ đúng trạng thái', () => {
  openList()
  fireEvent.click(screen.getByRole('tab', { name: 'Đang xử lý (3)' }))
  expect(rowCount()).toBe(3)
  fireEvent.click(screen.getByRole('tab', { name: 'Cần bổ sung (1)' }))
  expect(rowCount()).toBe(1)
})

it('danh sách (3.2): tìm theo mã công khai khớp đúng một dòng', () => {
  openList()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm kiếm báo cáo' }), { target: { value: 'DV-250118-007' } })
  expect(rowCount()).toBe(1)
  expect(screen.getByRole('button', { name: /Lỗi hiển thị biểu đồ/ })).toBeDefined()
})

it('danh sách (3.2): sang trang 2 hiện nốt 2 dòng còn lại', () => {
  openList()
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(rowCount()).toBe(2)
  expect(screen.getByRole('button', { name: '2' }).getAttribute('aria-current')).toBe('page')
})

it('chi tiết (3.3): bấm dòng → mã · trạng thái · loại · tệp đính kèm; back-link về danh sách', () => {
  openList()
  fireEvent.click(screen.getByRole('button', { name: /Không thể tải dữ liệu trong Project/ }))
  expect(screen.getByText('DV-250120-001')).toBeDefined()
  expect(screen.getByText('Đang xử lý')).toBeDefined()
  expect(screen.getByText('Sự cố hệ thống')).toBeDefined()
  expect(screen.getByText(/screenshot_error\.png/)).toBeDefined()
  // Quay lại từ chi tiết về danh sách (không phải về landing) — giữ mạch "xem rồi quay lại".
  fireEvent.click(screen.getByRole('button', { name: /Chi tiết báo cáo/ }))
  expect(rowCount()).toBe(6)
})
