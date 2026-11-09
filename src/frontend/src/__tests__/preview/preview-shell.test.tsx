import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { PreviewShell } from '../../views/preview/components/preview-shell'
import { previewNoteIds } from '../../views/preview/preview-data'
import { previewMockStore } from '../../services/preview/preview-mock.service'
import type { PreviewSectionId } from '../../types/preview/preview.types'
import { renderFrame, resetPreviewStore } from './preview-test-kit'

// Test "khung" theo UI-UX/Global Application Shell (sidebar 3 module của kiến trúc mới,
// thu/mở sidebar, tooltip · các vùng topbar). jsdom không tính CSS thực nên kiểm
// tra class/attribute/aria — phần visual do browser verify, báo riêng.
// Ô tìm kiếm toàn cục của topbar đã bỏ theo chủ batch 03/11, nên shell không còn nhận
// prop tìm kiếm nào: mọi test dưới đây gọi shell chỉ với (active, notice).

const shell = (active: PreviewSectionId, children: ReactNode = <p>Nội dung thử</p>) => renderFrame(
  <PreviewShell active={active}>{children}</PreviewShell>,
)

// jsdom của repo không cấp matchMedia → gán bản stub rồi trả lại nguyên trạng.
// Nhánh này cũng chứng minh preview-shell.tsx không crash khi thiếu matchMedia.
const originalMatchMedia = window.matchMedia

const stubNarrow = (narrow: boolean): void => {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: narrow && query === '(max-width: 820px)',
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })
}

beforeEach(() => { resetPreviewStore(); window.localStorage.clear(); window.location.hash = '' })
afterEach(() => { cleanup(); window.matchMedia = originalMatchMedia; window.location.hash = '' })

it('màn hẹp thì sidebar tự thu và không còn nút toggle sai trạng thái', () => {
  stubNarrow(true)
  const { container } = shell('home')
  expect(container.querySelector('.preview-root')!.classList.contains('is-compact')).toBe(true)
  expect(screen.queryByRole('button', { name: /thanh điều hướng/ })).toBeNull()
})

it('sidebar dựng đúng 3 module của kiến trúc mới, đúng thứ tự, và đánh dấu module đang mở', () => {
  shell('home')
  const nav = screen.getByRole('complementary', { name: 'Điều hướng chính' })
  const items = screen.getAllByRole('button')
    .filter(button => nav.contains(button) && button.classList.contains('nav-item'))
  // Hai ảnh shell đều vẽ đúng Home · Workspaces · Settings (Specification mục 1–2,
  // Design Board khung 01–04) → thêm hay bớt một mục nav là lệch thiết kế, phải bắt được.
  expect(items).toHaveLength(3)
  expect(items.map(item => item.textContent)).toEqual(['Home', 'Workspaces', 'Settings'])
  expect(screen.getByRole('button', { name: 'Home' }).getAttribute('aria-current')).toBe('page')
  expect(screen.getByRole('button', { name: 'Settings' }).hasAttribute('aria-current')).toBe(false)
})

it('màn ngoài nav (Dự án · Thông báo) có dải "Đang mở", còn màn trong nav thì không', () => {
  const { container } = shell('projects')
  const context = container.querySelector('.nav-context')!
  // Dải ngữ cảnh KHÔNG được thế chỗ một mục nav: ảnh shell vẫn chỉ vẽ ba module, nên
  // nó đứng dưới nav và nav phải còn đúng ba phần tử.
  expect(context.querySelector('.nav-item')).toBeNull()
  expect(context.textContent).toContain('Đang mở')
  expect(context.textContent).toContain('Dự án')
  // Home KHÔNG được sáng lên khi đang ở trang Dự án — đó chính là điểm người dùng báo
  // ("vào trang thông báo thì thanh bar bên trái cũng ở home"). Nav chỉ có ba module thật.
  expect(screen.getByRole('button', { name: 'Home' }).hasAttribute('aria-current')).toBe(false)

  fireEvent.click(screen.getByRole('button', { name: 'Về Home' }))
  expect(window.location.hash).toBe('#/preview/home')

  cleanup()
  // Home · Workspaces · Settings đã có mục nav sáng lên thì chính nó là câu trả lời
  // "đang ở đâu" — thêm dải ngữ cảnh chỉ lặp lại một thông tin đã hiện.
  expect(shell('workspaces').container.querySelector('.nav-context')).toBeNull()
})

it('nút navigation thu gọn sidebar, đổi nhãn và nhớ trạng thái', () => {
  const { container } = shell('home')
  const toggle = screen.getByRole('button', { name: 'Thu gọn thanh điều hướng' })
  expect(toggle.getAttribute('aria-expanded')).toBe('true')

  fireEvent.click(toggle)
  expect(container.querySelector('.preview-root')!.classList.contains('is-compact')).toBe(true)
  expect(window.localStorage.getItem('data-quality.preview.sidebar.v1')).toBe('compact')
  expect(screen.getByRole('button', { name: 'Mở rộng thanh điều hướng' }).getAttribute('aria-expanded')).toBe('false')

  fireEvent.click(screen.getByRole('button', { name: 'Mở rộng thanh điều hướng' }))
  expect(container.querySelector('.preview-root')!.classList.contains('is-compact')).toBe(false)
  expect(window.localStorage.getItem('data-quality.preview.sidebar.v1')).toBe('expanded')
})

it('cả ba module nav đều đã dựng → bấm là đổi hash (Settings giờ là màn Accounts thật)', () => {
  shell('home')
  fireEvent.click(screen.getByRole('button', { name: 'Workspaces' }))
  expect(window.location.hash).toBe('#/preview/workspaces')

  // Nhóm 04 đã dựng nhánh Accounts → Settings là mục nav THẬT, bấm phải điều hướng chứ không còn
  // báo "chưa có trong batch 2D" (toast đó giờ chỉ còn cho module ngoài 2D thật sự chưa dựng).
  window.location.hash = ''
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  expect(window.location.hash).toBe('#/preview/settings')
  expect(screen.queryByText(/chưa có trong batch 2D/)).toBeNull()
})

it('topbar KHÔNG còn ô tìm kiếm toàn cục (ô tìm nằm ở toolbar từng trang)', () => {
  const { container } = shell('workspaces')
  // Chủ batch 03/11: một ô ở đầu mọi trang tìm thứ mà trang đó không liệt kê. Kiểm cả DOM
  // chứ không chỉ role, vì searchbox giờ vẫn còn hợp lệ ở popover combobox bên trong topbar.
  expect(container.querySelector('.preview-topbar .topbar-search')).toBeNull()
  expect(container.querySelector('.preview-topbar input[type="search"], .preview-topbar .topbar-searchbox')).toBeNull()
  // Ctrl+K là lối tắt của ô đã bỏ → không còn handler nào bắt phím này.
  const before = document.activeElement
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
  expect(document.activeElement).toBe(before)
})

it('giữ nội dung trang và bỏ dải ghi chú nội bộ', () => {
  shell('projects')
  expect(screen.getByText('Nội dung thử').textContent).toBe('Nội dung thử')
  expect(document.querySelector('.preview-notice')).toBeNull()
  expect(document.getElementById(previewNoteIds.shell)).toBeNull()
})

it('topbar dựng đủ các vùng của Global Application Shell, trái sang phải', () => {
  const { container } = shell('home')
  const regions = Array.from(container.querySelectorAll<HTMLElement>('.preview-topbar > *'))
    .map(element => element.className)
  // (1) toggle · (2+3) hai combobox phạm vi · (4→6) chuông/báo cáo/tài khoản.
  // Ô tìm kiếm toàn cục của đặc tả (vùng 4 cũ) đã bỏ theo chủ batch 03/11.
  expect(regions).toEqual(['sidebar-toggle', 'topbar-chips', 'topbar-actions'])
  expect(container.querySelectorAll('.scope-select')).toHaveLength(2)
  // Ba nút hành động: chuông · "?" (báo cáo) · avatar. Đặc tả dòng 11 bỏ nút Trợ giúp riêng.
  expect(container.querySelectorAll('.topbar-actions > button')).toHaveLength(3)
  // Ô chọn trên topbar chỉ còn NHÃN + GIÁ TRỊ: đếm số ở đó làm chuỗi dài giãn cả chip
  // (phản hồi của user) mà con số đã hiện trên trang rồi.
  expect(container.querySelectorAll('.scope-meta')).toHaveLength(0)
})

it('nút "?" mở ô báo cáo ngay trong popover (không đổi hash); không còn nút Trợ giúp riêng', () => {
  shell('home')
  // Đặc tả dòng 11: topbar không có nút Trợ giúp riêng — glyph "?" CHÍNH là nút báo cáo.
  expect(screen.queryByRole('button', { name: 'Trợ giúp' })).toBeNull()
  const report = screen.getByRole('button', { name: 'Báo cáo vấn đề' })
  expect(report.hasAttribute('disabled')).toBe(false)

  fireEvent.click(report)
  // Toàn bộ vòng đời báo cáo chạy TRONG ô (khung 02): landing có hai nút vào, không điều hướng.
  const dialog = screen.getByRole('dialog', { name: 'Báo cáo vấn đề' })
  expect(within(dialog).getByRole('button', { name: /Tạo báo cáo mới/ })).toBeDefined()
  expect(within(dialog).getByRole('button', { name: /Xem các báo cáo của tôi/ })).toBeDefined()
  expect(window.location.hash).toBe('')

  // Dải lý do của shell nói điều ĐÃ LÀM được, không còn kể control nào thiếu.
  expect(document.getElementById(previewNoteIds.shell)).toBeNull()
  for (const label of ['Workspace', 'Projects']) {
    expect(screen.getByRole('combobox', { name: label }).hasAttribute('disabled')).toBe(false)
  }
  expect(screen.getByRole('button', { name: 'Thông báo · 5 chưa đọc' }).hasAttribute('disabled')).toBe(false)
})

it('combobox Workspace tìm được trong danh sách, chọn thì đổi phạm vi NGAY TẠI CHỖ', () => {
  // Bộ lọc phạm vi không được đổi màn hình (bản cũ đá người đang đọc hộp thư sang trang
  // Dự án). Trang nào mang được workspaceId trong URL — workspaces · projects — thì hash
  // vẫn cập nhật theo để F5 và "sao chép liên kết" giữ đúng phạm vi đang hiện trên chip.
  shell('workspaces')
  fireEvent.click(screen.getByRole('combobox', { name: 'Workspace' }))
  const popover = screen.getByRole('dialog', { name: 'Chọn workspace' })
  // Mọi workspace trong store + 1 mục "Tất cả Workspace". Popover có max-height + overflow nên
  // danh sách dài là chuyện của thanh cuộn, không phải của tràn màn hình.
  expect(within(popover).getAllByRole('option'))
    .toHaveLength(previewMockStore.getState().workspaces.length + 1)
  // Chưa tìm thì không có cột số đếm — nó chỉ cần lúc đang so vài dòng khớp từ khóa với nhau.
  expect(popover.querySelector('.option-meta')).toBeNull()

  fireEvent.change(within(popover).getByRole('searchbox', { name: 'Tìm trong workspace' }), { target: { value: 'research' } })
  const rows = within(popover).getAllByRole('option')
  // Tìm kiếm lọc NGAY trong popover (không phải đóng lại rồi lọc ở trang) và mỗi dòng cho
  // biết luôn có bao nhiêu project, để người dùng không chọn mò. Số đếm dùng danh từ tiếng
  // Anh như chính nhãn bộ lọc (nav · stat · thẻ đều gọi "Projects").
  expect(rows.map(row => row.textContent)).toEqual(['Research & Development1 project · ★'])

  fireEvent.click(rows[0])
  expect(window.location.hash).toBe('#/preview/workspaces/ws-rnd')
  expect(previewMockStore.getState().selection.workspaceId).toBe('ws-rnd')
  expect(screen.queryByRole('dialog', { name: 'Chọn workspace' })).toBeNull()
})

it('combobox Projects chỉ liệt kê project của workspace đang chọn', () => {
  shell('projects')
  fireEvent.click(screen.getByRole('combobox', { name: 'Workspace' }))
  fireEvent.click(screen.getByRole('option', { name: /^Marketing/ }))

  fireEvent.click(screen.getByRole('combobox', { name: 'Projects' }))
  const popover = screen.getByRole('dialog', { name: 'Chọn projects' })
  // ws-marketing chỉ có 2 project trong dữ liệu mẫu → phạm vi phải co lại theo, không còn 12.
  expect(within(popover).getAllByRole('option')).toHaveLength(3)

  fireEvent.click(within(popover).getByRole('option', { name: /^Loyalty Program/ }))
  expect(screen.getByRole('combobox', { name: 'Projects' }).textContent).toContain('Loyalty Program')
  expect(previewMockStore.getState().selection.projectId).toBe('prj-loyalty')
  expect(window.location.hash).toBe('#/preview/projects/ws-marketing/prj-loyalty')
  expect(screen.queryByRole('dialog', { name: 'Chọn projects' })).toBeNull()

  // "Tất cả Projects" phải nói thật: bấm xong thì chip hiện đúng nhãn vừa chọn và phạm vi
  // project được BỎ (trước đây nó âm thầm nhảy về project đầu tiên của danh sách).
  fireEvent.click(screen.getByRole('combobox', { name: 'Projects' }))
  fireEvent.click(screen.getByRole('option', { name: 'Tất cả Projects' }))
  expect(screen.getByRole('combobox', { name: 'Projects' }).textContent).toContain('Tất cả Projects')
  expect(previewMockStore.getState().selection.projectId).toBe('')
  expect(window.location.hash).toBe('#/preview/projects/ws-marketing')
})

it('bỏ chọn phạm vi thì combobox Workspace báo "Tất cả Workspace"', () => {
  shell('home')
  // Chọn qua mock store chứ không tự sửa DOM: store là nguồn duy nhất mà mọi combobox cùng
  // đọc, nên sửa một chỗ là cả frame đổi theo. (Dải dung lượng ở footer sidebar đã bỏ theo
  // đặc tả nhóm trưởng nên chỉ còn combobox trên topbar nói nơi người dùng đang đứng.)
  act(() => { previewMockStore.selectWorkspace('') })
  expect(screen.getByRole('combobox', { name: 'Workspace' }).textContent).toContain('Tất cả Workspace')
})
