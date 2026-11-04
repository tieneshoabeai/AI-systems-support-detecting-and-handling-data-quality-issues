import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NotificationsPreviewView } from '../../views/preview/notifications-2d.view'
import { notificationKindLabels } from '../../views/preview/preview-data'
import { previewMockStore } from '../../services/preview/preview-mock.service'
import { parsePreviewRoute, previewHref } from '../../services/preview/preview-route'
import { everyDisabledButtonHasVisibleReason, renderFrame, resetPreviewStore, universeNavigator } from './preview-test-kit'

// Suite riêng cho màn Thông báo (Design Board 1.2 danh sách · 1.3 chi tiết) vì hai màn
// dùng chung MỘT component: test phải đi qua cả hai nhánh thay vì giả định chúng giống nhau.
// Mọi số đếm ở đây suy từ mock store — thêm/xóa bản ghi trong fixture thì test chạy theo,
// không có con số viết tay nào để lệch.

const listScreen = () => renderFrame(<NotificationsPreviewView notificationId={null} />)
const detailScreen = (id: string): void => { renderFrame(<NotificationsPreviewView notificationId={id} />) }

const rowTitles = (): string[] =>
  Array.from(document.querySelectorAll('.notice-table tbody th'))
    .map(cell => cell.querySelector('.row-link')?.textContent ?? '')

const bulkCount = (): string => document.querySelector('.bulk-count')?.textContent ?? ''

const headCheckbox = (): HTMLInputElement =>
  screen.getByRole('checkbox', { name: 'Chọn tất cả thông báo trên trang này' }) as HTMLInputElement

const pickRow = (title: string): void => {
  fireEvent.click(screen.getByRole('checkbox', { name: `Chọn: ${title}` }))
}

// history.length là getter trên History.prototype → định nghĩa own property sẽ che nó, và
// xoá đi là trả lại nguyên trạng. Không stub thì số mục lịch sử phụ thuộc test nào chạy
// trước trong cùng file (mỗi lần ghi hash là một mục mới), nút Quay lại sẽ xanh đỏ thất thường.
const stubHistoryLength = (length: number): void => {
  Object.defineProperty(window.history, 'length', { configurable: true, value: length })
}
const clearHistoryStub = (): void => { Reflect.deleteProperty(window.history, 'length') }

beforeEach(() => { resetPreviewStore(); window.localStorage.clear(); window.location.hash = '' })
afterEach(() => { cleanup(); window.location.hash = '' })

it('fixture: context luôn khớp một project thật, và năm bản đầu là đúng năm bản chưa đọc', () => {
  const { notifications, projects } = previewMockStore.getState()
  expect(notifications).toHaveLength(16)
  for (const item of notifications) {
    const project = projects.find(entry => entry.id === item.projectId) ?? null
    // Nhãn không được bịa: hoặc bản ghi hệ thống, hoặc đúng tên project đang tồn tại.
    expect(item.context).toBe(item.projectId === null ? 'DataVerse' : `Project ${project?.name}`)
    expect(item.context).not.toContain('⚠')
    // Nhãn tương đối và mốc tuyệt đối của cùng một bản ghi phải nói cùng một thời điểm.
    expect(item.atFull).toMatch(/^\d{2}:\d{2}, \d{2}\/\d{2}\/\d{4}$/)
  }
  // Popover chuông lấy 5 bản đầu; nếu còn bản chưa đọc nằm ngoài 5 bản đó thì người dùng
  // thấy "5 chưa đọc" trên chuông nhưng mở dropdown ra lại không đủ số.
  expect(notifications.filter(item => item.unread).map(item => item.id))
    .toEqual(notifications.slice(0, 5).map(item => item.id))
})

it('hộp thư: tab lọc đếm từ store, phân trang và đổi số dòng mỗi trang', () => {
  listScreen()
  expect(screen.getByRole('tab', { name: 'Tất cả (16)' })).toBeDefined()
  expect(screen.getByRole('tab', { name: 'Chưa đọc (5)' })).toBeDefined()
  expect(screen.getByRole('tab', { name: 'Đã đọc (11)' })).toBeDefined()
  expect(document.querySelector('.page-eyebrow')!.textContent).toBe('Hộp thư · 5 chưa đọc · 16 thông báo')

  expect(rowTitles()).toHaveLength(8)
  expect(screen.getByText('Hiển thị 1–8 của 16 thông báo')).toBeDefined()

  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(rowTitles()).toHaveLength(8)
  expect(screen.getByText('Hiển thị 9–16 của 16 thông báo')).toBeDefined()

  fireEvent.change(screen.getByRole('combobox', { name: 'Số dòng mỗi trang' }), { target: { value: '16' } })
  expect(rowTitles()).toHaveLength(16)
  expect(screen.getByText('Hiển thị 1–16 của 16 thông báo')).toBeDefined()

  fireEvent.click(screen.getByRole('tab', { name: 'Chưa đọc (5)' }))
  expect(rowTitles()).toHaveLength(5)
  expect(screen.getByText('Hiển thị 1–5 của 5 thông báo')).toBeDefined()
})

// Ô tìm kiếm toàn cục ở topbar ĐÃ BỎ (chủ batch 03/11): nó tìm thứ mà trang này không liệt kê.
// Bộ lọc duy nhất còn lại của hộp thư là ba tab, nên test chuyển sang đi theo đúng đường đó —
// và nhân tiện đo luôn trạng thái "tab không còn dòng nào", thứ trước đây chỉ tới được bằng tìm
// kiếm.
it('hộp thư: không còn ô tìm kiếm; tab trống thì cất hẳn phân trang và nói lối ra nhìn thấy được', () => {
  listScreen()
  expect(screen.queryByRole('searchbox')).toBeNull()
  expect(screen.queryByRole('textbox', { name: /tìm/i })).toBeNull()
  expect(document.querySelector('.pagination')).not.toBeNull()

  // "Đánh dấu tất cả đã đọc" là mutation thật → tab "Chưa đọc" về 0 dòng.
  fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }))
  fireEvent.click(screen.getByRole('tab', { name: 'Chưa đọc (0)' }))
  expect(screen.getByText('Không có kết quả')).toBeDefined()
  expect(document.querySelector('.notice-table')).toBeNull()
  // Bảng biến mất thì dải phân trang cũng mất theo — in "Hiển thị 0–0 của 0 thông báo" cùng hai
  // nút trang là nói dối về một thứ không có.
  expect(document.querySelector('.pagination')).toBeNull()
  // Lối ra phải là chữ nhìn thấy được, không phải tooltip, và phải trỏ tới control CÓ THẬT trên
  // màn (menu tài khoản không còn mục "Khôi phục dữ liệu mẫu").
  expect(screen.getByText(/tải lại trang sẽ trả hộp thư về danh sách ban đầu/)).toBeDefined()

  // Quay lại tab có bản ghi thì phân trang trở lại, đếm đúng khoảng thật.
  fireEvent.click(screen.getByRole('tab', { name: 'Tất cả (16)' }))
  expect(document.querySelector('.pagination')).not.toBeNull()
  expect(document.querySelector('.pagination-info')!.textContent).toMatch(/^Hiển thị 1–\d+ của 16 thông báo$/)
})

it('hộp thư: ô chọn ở header có ba trạng thái, đánh dấu đã đọc hàng loạt đổi cả bộ đếm', async () => {
  listScreen()
  expect(bulkCount()).toBe('Chưa chọn thông báo nào')
  expect(headCheckbox().checked).toBe(false)
  expect(headCheckbox().indeterminate).toBe(false)

  // Một phần thì header KHÔNG được hiện ô đã tích (nói dối), mà ở trạng thái ba.
  pickRow('Phân tích dữ liệu hoàn tất')
  expect(headCheckbox().indeterminate).toBe(true)
  expect(headCheckbox().checked).toBe(false)
  expect(bulkCount()).toBe('Đã chọn 1')

  fireEvent.click(headCheckbox())
  expect(rowTitles()).toHaveLength(8)
  expect(document.querySelectorAll('.notice-table tbody input:checked')).toHaveLength(8)
  expect(headCheckbox().indeterminate).toBe(false)
  expect(bulkCount()).toBe('Đã chọn 8')

  fireEvent.click(headCheckbox())
  expect(bulkCount()).toBe('Chưa chọn thông báo nào')

  pickRow('Phân tích dữ liệu hoàn tất')
  pickRow('Có 12 vấn đề chất lượng dữ liệu')
  fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }))
  // optimistic: số trên tab và trên chuông đổi ngay ở lần click, không chờ 160ms giả định.
  expect(screen.getByRole('tab', { name: 'Chưa đọc (3)' })).toBeDefined()
  expect(screen.getByRole('tab', { name: 'Đã đọc (13)' })).toBeDefined()
  expect(screen.getByRole('button', { name: 'Thông báo · 3 chưa đọc' })).toBeDefined()

  fireEvent.click(await screen.findByRole('button', { name: 'Hoàn tác' }))
  expect(screen.getByRole('tab', { name: 'Chưa đọc (5)' })).toBeDefined()
  expect(previewMockStore.getState().notifications.find(item => item.id === 'nt-01')!.unread).toBe(true)
})

it('hộp thư: xóa hàng loạt gỡ dòng khỏi bảng, Hoàn tác trả lại đủ 16 bản', async () => {
  listScreen()
  pickRow('Phân tích dữ liệu hoàn tất')
  pickRow('Import dữ liệu thành công')
  fireEvent.click(screen.getByRole('button', { name: 'Xóa' }))

  // 14 bản còn lại vẫn xếp đủ 8 dòng ở trang đầu: phân trang tính theo danh sách đã lọc,
  // không theo số dòng bị trừ đi.
  expect(rowTitles()).toHaveLength(8)
  expect(rowTitles()).not.toContain('Import dữ liệu thành công')
  expect(screen.getByRole('tab', { name: 'Tất cả (14)' })).toBeDefined()
  expect(screen.getByText('Hiển thị 1–8 của 14 thông báo')).toBeDefined()
  // Selection phải rơi theo bản ghi đã bị xóa, nếu không thanh thao tác còn báo "Đã chọn 2".
  expect(bulkCount()).toBe('Chưa chọn thông báo nào')

  fireEvent.click(await screen.findByRole('button', { name: 'Hoàn tác' }))
  expect(screen.getByRole('tab', { name: 'Tất cả (16)' })).toBeDefined()
  expect(rowTitles()).toHaveLength(8)
})

it('hộp thư: bấm một dòng ghi URL chi tiết; route phẳng không bị hiểu nhầm thành workspace', () => {
  listScreen()
  fireEvent.click(screen.getByRole('button', { name: 'Có 12 vấn đề chất lượng dữ liệu' }))
  expect(window.location.hash).toBe('#/preview/notifications/nt-02')

  // Segment sau 'notifications' là id của CHÍNH thông báo, không phải workspace — diễn
  // giải theo phân cấp cũ thì màn chi tiết mở sai bản ghi mà không ai biết.
  expect(parsePreviewRoute('#/preview/notifications/nt-02'))
    .toEqual({ section: 'notifications', workspaceId: null, projectId: null, notificationId: 'nt-02', settingsSection: null })
  expect(parsePreviewRoute('#/preview/notifications'))
    .toEqual({ section: 'notifications', workspaceId: null, projectId: null, notificationId: null, settingsSection: null })
  expect(parsePreviewRoute('#/preview/workspaces/ws-acme/prj-sales')!.notificationId).toBeNull()
  expect(previewHref('notifications', { workspaceId: 'ws-acme', notificationId: 'nt-02' }))
    .toBe('#/preview/notifications/nt-02')
})

it('danh sách: có nút Quay lại — history còn thì back(), history trống thì về Home', () => {
  const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
  stubHistoryLength(2)
  listScreen()
  fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
  expect(back).toHaveBeenCalledTimes(1)
  back.mockRestore()
  clearHistoryStub()

  // Tab mở thẳng vào '#/preview/notifications': không có trang trước để back.
  cleanup()
  stubHistoryLength(1)
  listScreen()
  fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
  expect(window.location.hash).toBe('#/preview/home')
  clearHistoryStub()
})

it('danh sách: sidebar nói rõ đang ở Thông báo và cho lối về Home', () => {
  const { container } = listScreen()
  const context = container.querySelector('.nav-context')!
  expect(context.textContent).toContain('Đang mở')
  expect(context.textContent).toContain('Thông báo')
  fireEvent.click(screen.getByRole('button', { name: 'Về Home' }))
  expect(window.location.hash).toBe('#/preview/home')
})

it('chi tiết: meta đủ mốc tuyệt đối và nhãn loại; vào project là sang thẳng vũ trụ 3D', () => {
  detailScreen('nt-02')
  expect(screen.getByRole('heading', { level: 1, name: 'Có 12 vấn đề chất lượng dữ liệu' })).toBeDefined()
  // Khối meta là nơi duy nhất có mốc tuyệt đối + nhãn loại; truy vấn thẳng trong đó vì
  // nhãn loại còn xuất hiện lần nữa ở chip góc trang (getByText sẽ gặp hai element).
  const meta = document.querySelector('.detail-meta')!.textContent ?? ''
  expect(meta).toContain('14:10, 20/01/2025')
  expect(meta).toContain(notificationKindLabels.quality)
  expect(meta).toContain('Project Customer 360')
  expect(meta).toContain('Chưa đọc')
  expect(document.querySelector('.notice-desc')!.textContent).toContain('7 bản ghi trùng')

  // "Đi vào project" = trang Project Workspace Overview (đặc tả UI-UX/projects). Trước đây nút
  // này nhảy thẳng sang màn 3D của T; nay mọi lối vào project phải đáp ở trang đó trước, còn 3D
  // là một nút bên trong trang. Hash là bằng chứng, spy universe là bằng chứng KHÔNG đi 3D.
  fireEvent.click(screen.getByRole('button', { name: /^Mở Project/ }))
  expect(window.location.hash).toBe('#/preview/projects/ws-acme/prj-customer')
  expect(universeNavigator).not.toHaveBeenCalled()

  // Nút "Đánh dấu đã đọc" nằm ngay trong màn chi tiết (Design Board 1.3) là mutation thật.
  fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }))
  expect(screen.getByRole('button', { name: 'Thông báo · 4 chưa đọc' })).toBeDefined()
  expect(previewMockStore.getState().notifications.find(item => item.id === 'nt-02')!.unread).toBe(false)
})

it('chi tiết: nút "Đánh dấu đã đọc" bấm rồi thì tắt, và lý do đổi theo trạng thái mới', async () => {
  detailScreen('nt-01')
  const readButton = screen.getByRole('button', { name: 'Đánh dấu đã đọc' })
  expect(readButton.hasAttribute('disabled')).toBe(false)

  fireEvent.click(readButton)
  expect(await screen.findByText('Đã đánh dấu 1 thông báo là đã đọc')).toBeDefined()
  expect(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }).hasAttribute('disabled')).toBe(true)
  const note = document.getElementById('pv-notice-detail-note')!
  // Hai trạng thái tắt khác nhau phải nói hai lý do khác nhau — gộp một câu thì người đọc
  // không biết mình đang thiếu gì.
  expect(note.textContent).toContain('đã được đánh dấu là đã đọc')
  expect(note.textContent).not.toContain('không liên kết với Project')
})

it('chi tiết: thông báo hệ thống và project đã bị xóa là hai lý do "Mở Project" tắt khác nhau', () => {
  detailScreen('nt-09')
  expect(screen.getByRole('button', { name: /^Mở Project/ }).hasAttribute('disabled')).toBe(true)
  expect(document.getElementById('pv-notice-detail-note')!.textContent).toContain('không liên kết với Project')

  // Bản ghi này gắn prj-customer, nhưng project vừa bị gỡ khỏi danh sách mẫu trong tab.
  previewMockStore.remove('project', 'prj-customer')
  cleanup()
  detailScreen('nt-02')
  expect(screen.getByRole('button', { name: /^Mở Project/ }).hasAttribute('disabled')).toBe(true)
  const note = document.getElementById('pv-notice-detail-note')!
  expect(note.textContent).toContain('Project liên quan không còn tồn tại')
  expect(note.textContent).not.toContain('tải lại trang')
  expect(note.textContent).not.toContain('không liên kết với Project')
})

it('chi tiết: id không tồn tại nói rõ thay vì trang trắng, và có đường về danh sách', () => {
  detailScreen('nt-99')
  expect(screen.getByText('Không tìm thấy thông báo')).toBeDefined()
  expect(screen.getByText(/nt-99/)).toBeDefined()
  expect(document.querySelector('.panel')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Danh sách thông báo' }))
  expect(window.location.hash).toBe('#/preview/notifications')
})

it('chi tiết: không còn ô tìm kiếm ở màn chi tiết, đường về danh sách là nút thật', () => {
  detailScreen('nt-01')
  // Màn chi tiết từng có ô tìm (chụp từ topbar) nhưng gõ vào đó là một control chết; nay ô đó
  // đã bỏ khỏi topbar nên màn này cũng không còn gì để mà "tắt".
  expect(screen.queryByRole('searchbox')).toBeNull()
  expect(screen.queryByRole('textbox', { name: /tìm/i })).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Danh sách thông báo' }))
  expect(window.location.hash).toBe('#/preview/notifications')
})

it('chi tiết: bản đã đọc sẵn thì "Đánh dấu đã đọc" tắt, nhưng vẫn mở được trang Project', () => {
  detailScreen('nt-06') // bản đã đọc sẵn trong fixture
  expect(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: /^Mở Project/ }).hasAttribute('disabled')).toBe(false)
  expect(document.getElementById('pv-notice-detail-note')!.textContent).toContain('đã được đánh dấu là đã đọc')
})

it('hai màn thông báo: không còn nút im lặng, mọi nút disabled đều có lý do nhìn thấy', () => {
  listScreen()
  everyDisabledButtonHasVisibleReason()
  cleanup()
  detailScreen('nt-09')
  everyDisabledButtonHasVisibleReason()
  cleanup()
  detailScreen('nt-06')
  everyDisabledButtonHasVisibleReason()
})

// Hai test dưới đây bắt đúng hai cái bẫy đo thật trên trình duyệt khi tour toàn màn hình
// (bản cũ im lặng cho phép xóa dòng không nhìn thấy, và in một dải phân trang tự dối).
it('chọn dòng rồi đổi bộ lọc: số nằm ngoài danh sách đang hiện phải được nói thẳng', () => {
  listScreen()
  const titles = rowTitles()
  // Năm bản ĐẦU của fixture là năm bản chưa đọc → hai dòng sau đây đã đọc, nghĩa là
  // chúng biến mất khi chuyển sang tab "Chưa đọc".
  fireEvent.click(screen.getByRole('checkbox', { name: `Chọn: ${titles[5]}` }))
  fireEvent.click(screen.getByRole('checkbox', { name: `Chọn: ${titles[6]}` }))
  expect(bulkCount()).toBe('Đã chọn 2')

  fireEvent.click(screen.getByRole('tab', { name: 'Chưa đọc (5)' }))
  expect(document.querySelectorAll('.notice-table tbody tr.is-selected')).toHaveLength(0)
  // Bản cũ chỉ ghi "Đã chọn 2" trong khi 0 dòng nào được tích, và nút Xóa vẫn bật —
  // bấm là xóa hai bản ghi không còn thấy ở đâu trên màn hình.
  expect(bulkCount()).toBe('Đã chọn 2 · 2 mục nằm ngoài danh sách đang hiện')
  // Lối ra phải là nút nhìn thấy được, không phải tooltip: "Bỏ chọn" vẫn dùng được.
  expect(screen.getByRole('button', { name: 'Bỏ chọn' }).hasAttribute('disabled')).toBe(false)

  fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn' }))
  expect(bulkCount()).toBe('Chưa chọn thông báo nào')
})
