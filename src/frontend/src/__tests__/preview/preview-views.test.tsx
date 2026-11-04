import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { WorkspacesPreviewView } from '../../views/preview/workspaces-2d.view'
import { ProjectsPreviewView } from '../../views/preview/projects-2d.view'
import { ProjectWorkspaceView } from '../../views/preview/project-workspace-2d.view'
import { HomePreviewView } from '../../views/preview/home-2d.view'
import { byNewestFirst, formatCount, formatDataSize, formatRows, previewNoteIds, projectModules, isOwnedByMe } from '../../views/preview/preview-data'
import { previewMockStore } from '../../services/preview/preview-mock.service'
import { universePath } from '../../services/preview/preview-route'
import {
  cardByTitle, everyDisabledButtonHasVisibleReason, menuFor, menuItem, renderFrame,
  resetPreviewStore, rowByTitle, universeNavigator,
} from './preview-test-kit'

// Kiểm hành vi tương tác chuột của ba frame 2D: tab lọc, chọn thẻ, search, đổi kiểu
// hiển thị, phân trang, placeholder 3D của Home, và các số liệu phải SUY từ mock store
// (không còn hằng số viết tay) — mọi view đều cần provider vì chúng đọc usePreviewSession.

const cardCount = (): number => document.querySelectorAll('.resource-card').length

// Số trong một stat card, tra theo nhãn. Viết hàm một lần để ba test cùng dùng.
const statValue = (label: string): string =>
  Array.from(document.querySelectorAll<HTMLElement>('.stat-card'))
    .find(card => card.querySelector('.stat-label')?.textContent === label)
    ?.querySelector('.stat-value')?.textContent ?? ''

beforeEach(() => { resetPreviewStore(); window.localStorage.clear(); window.location.hash = '' })
afterEach(() => { cleanup(); window.location.hash = '' })

// Bỏ phạm vi workspace qua đúng đường mà topbar dùng (combobox 'Workspace'),
// không tự sửa selection từ test — nếu not thì đổi phạm vi thật đã hỏng mà test vẫn xanh.
const pickAllWorkspaces = (): void => {
  fireEvent.click(screen.getByRole('combobox', { name: 'Workspace' }))
  fireEvent.click(screen.getByRole('option', { name: /^Tất cả Workspace/ }))
}

const cardTitles = (): string[] =>
  Array.from(document.querySelectorAll('.resource-card h3')).map(element => element.textContent ?? '')

// Tệp CSV cho bước "Import Dataset". `arrayBuffer` được định nghĩa thẳng trên File vì jsdom
// không cung cấp bản đọc nội dung ổn định trong máy chạy test — cùng khuôn với
// __tests__/workspace-3d/local-csv-viewer.test.tsx, nơi đọc CSV đã chạy thật từ trước.
const csvFile = (name: string, content: string): File => {
  const file = new File([content], name, { type: 'text/csv' })
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new TextEncoder().encode(content).buffer })
  return file
}

// Nạp tệp vào ô "Chọn tập dữ liệu CSV" và chờ chuỗi đọc-tệp xong: số hàng/số cột hiện trên
// màn LÀ KẾT QUẢ ĐO, nên test phải chờ nó thay vì đoán một hằng số.
const attachCsv = async (dialog: HTMLElement, name: string, content: string): Promise<void> => {
  await act(async () => {
    fireEvent.change(within(dialog).getByLabelText('Chọn tập dữ liệu CSV'), { target: { files: [csvFile(name, content)] } })
  })
}

it('trang Workspaces: ba bộ lọc · tìm kiếm · phân trang 28 một trang chạy trên dữ liệu mẫu', () => {
  renderFrame(<WorkspacesPreviewView />)
  const state = previewMockStore.getState()
  const wsTotal = state.workspaces.length
  // 28 là TRẦN chủ batch nêu, không phải mặc định dễ thương: bộ demo phải VƯỢT 28 thì nút
  // lật mới tồn tại. 28 bản ghi chia đúng 28 = một trang = "chưa có chuyển trang".
  expect(wsTotal).toBeGreaterThan(28)
  expect(cardCount()).toBe(28)
  expect(screen.getByText(`Hiển thị 1–28 của ${wsTotal} Workspaces`)).toBeDefined()
  const coverVariants = new Map(Array.from(document.querySelectorAll<HTMLElement>('.resource-card .cover-art'))
    .map(cover => [cover.dataset.seed, cover.dataset.art]))
  expect(new Set(coverVariants.values()).size).toBeGreaterThan(1)

  // Tìm kiếm đứng TRONG toolbar của chính trang (chủ batch 03/11 bỏ ô toàn cục ở topbar): nó
  // là control ĐẦU hàng, trước ba bộ lọc, và chỉ tìm thứ trang này liệt kê — workspace.
  const search = () => screen.getByRole('textbox', { name: 'Tìm workspace theo tên hoặc mô tả' })
  fireEvent.change(search(), { target: { value: 'finance' } })
  expect(cardCount()).toBe(1)
  expect(cardTitles()).toEqual(['Finance'])
  const filteredCover = document.querySelector<HTMLElement>('.resource-card .cover-art')!
  expect(filteredCover.dataset.art).toBe(coverVariants.get(filteredCover.dataset.seed))

  fireEvent.change(search(), { target: { value: 'không tồn tại' } })
  expect(screen.getByText('Không có kết quả')).toBeDefined()
  expect(cardCount()).toBe(0)
  // Danh sách lọc rỗng thì phân trang PHẢI ẩn: vẽ "của 0 Workspaces" cùng hai nút trang là
  // nói dối về một thứ không có.
  expect(screen.queryByRole('navigation', { name: 'Phân trang workspace' })).toBeNull()

  fireEvent.change(search(), { target: { value: '' } })

  // Quyền sở hữu: hai giá trị cộng lại đúng tổng — không có bản ghi nào lọt ngoài hai ô.
  const owned = state.workspaces.filter(isOwnedByMe).length
  fireEvent.change(screen.getByRole('combobox', { name: 'Lọc theo quyền sở hữu' }), { target: { value: 'owned' } })
  expect(screen.getByText(`Hiển thị 1–${owned} của ${owned} Workspaces`)).toBeDefined()
  fireEvent.change(screen.getByRole('combobox', { name: 'Lọc theo quyền sở hữu' }), { target: { value: 'shared' } })
  expect(screen.getByText(`Hiển thị 1–28 của ${wsTotal - owned} Workspaces`)).toBeDefined()
  fireEvent.change(screen.getByRole('combobox', { name: 'Lọc theo quyền sở hữu' }), { target: { value: 'all' } })

  // Vai trò đọc từ roster THẬT của workspace. Admin/Viewer từng trả về 0 dòng với fixture cũ
  // → hai ô trong ảnh thành đồ chết. Fixture giờ có đúng một bản ghi mỗi loại.
  fireEvent.change(screen.getByRole('combobox', { name: 'Lọc theo vai trò' }), { target: { value: 'Admin' } })
  expect(cardTitles()).toEqual(['Finance'])
  fireEvent.change(screen.getByRole('combobox', { name: 'Lọc theo vai trò' }), { target: { value: 'Viewer' } })
  expect(cardTitles()).toEqual(['Data Engineering'])
  fireEvent.change(screen.getByRole('combobox', { name: 'Lọc theo vai trò' }), { target: { value: 'all' } })

  // Sắp xếp 'Tên A → Z' phải là thứ tự locale thật trên TOÀN BỘ danh sách đã lọc, không phải
  // chỉ trang đang hiện (nên so với chính danh sách đó sau khi sort).
  fireEvent.change(screen.getByRole('combobox', { name: 'Sắp xếp' }), { target: { value: 'name-asc' } })
  const asc = cardTitles()
  expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b, 'vi')))

  // Ô 'Số dòng' chỉ nhận các giá trị ≤ 28 — 28 là trần nên không có option nào to hơn.
  fireEvent.change(screen.getByRole('combobox', { name: 'Số dòng mỗi trang' }), { target: { value: '10' } })
  expect(cardCount()).toBe(10)
  expect(screen.getByText(`Hiển thị 1–10 của ${wsTotal} Workspaces`)).toBeDefined()
})

it('bấm một thẻ workspace mở TRANG CHI TIẾT riêng (route), không còn panel kề bên', () => {
  // Design Board "workspaces detail": chi tiết là một màn riêng, không phải aside kế bên.
  renderFrame(<WorkspacesPreviewView />)
  expect(screen.queryByRole('complementary', { name: 'Chi tiết Acme Corp' })).toBeNull()

  fireEvent.click(cardByTitle('Acme Corp'))
  expect(window.location.hash).toBe('#/preview/workspaces/ws-acme')
  expect(previewMockStore.getState().selection.workspaceId).toBe('ws-acme')
})

it('trang chi tiết workspace: header + 4 stat card + bar + donut + bảng project', () => {
  // Render thẳng màn detail bằng id route (ws-acme có 12 project trong store mẫu).
  renderFrame(<WorkspacesPreviewView workspaceId="ws-acme" />)
  expect(screen.getByRole('heading', { level: 1, name: 'Acme Corp' })).toBeDefined()
  // Bốn stat card đọc từ buckets của chính workspace, không viết tay số như ảnh.
  expect(statValue('Tổng Project')).toBe('12')
  expect(screen.getByRole('heading', { level: 2, name: 'Tiến độ Project theo thời gian' })).toBeDefined()
  expect(screen.getByRole('heading', { level: 2, name: 'Phân bố trạng thái Project' })).toBeDefined()
  // hổng donut = tổng project, khớp stat "Tổng Project" (hai biểu đồ một nguồn).
  expect(document.querySelector('.donut-hole strong')!.textContent).toBe('12')
  expect(document.querySelectorAll('.pv-bars .pv-col')).toHaveLength(5)
})

it('trang chi tiết: bấm dòng project sang đúng project, breadcrumb về danh sách', () => {
  renderFrame(<WorkspacesPreviewView workspaceId="ws-acme" />)
  // 12 project / 10 mỗi trang → 'Open Questions' có thể nằm trang 2, lọc để nó ra trang đầu.
  // Ô tìm của khung Project ĐỨNG Ở TOOLBAR TRANG CHI TIẾT (không còn ở topbar) và tìm theo TÊN,
  // đúng như nhãn "Tìm theo tên project…" nó quảng cáo.
  fireEvent.change(screen.getByRole('textbox', { name: 'Tìm project theo tên trong workspace này' }), { target: { value: 'Open Questions' } })
  fireEvent.click(rowByTitle('Open Questions'))
  expect(window.location.hash).toBe('#/preview/projects/ws-acme/prj-empty')

  // Bấm breadcrumb "Workspaces" trả về danh sách (hash không còn id). Phân biệt với nút
  // 'Workspaces' của sidebar bằng cách giới hạn trong nav breadcrumb.
  cleanup()
  renderFrame(<WorkspacesPreviewView workspaceId="ws-acme" />)
  const crumb = screen.getByRole('navigation', { name: 'Path điều hướng' })
  fireEvent.click(within(crumb).getByRole('button', { name: 'Workspaces' }))
  expect(window.location.hash).toBe('#/preview/workspaces')
})

// Ảnh "a_detailed_high_fidelity_ui_screenshot_of_the_sam" vẽ header trang chi tiết CHỈ có một
// nút ⋯, còn "Thông tin Workspace" và "Quản lý thành viên" là hai MỤC của menu đó. Hai nút rời
// đặt cạnh nhau sẽ là bản sao thứ hai của chính menu → test đi qua menu, lối vào thật.
const openWorkspacePanel = (item: 'Thông tin Workspace' | 'Quản lý thành viên'): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Thao tác với Acme Corp' }))
  fireEvent.click(menuItem(item))
}

it('modal "Thông tin Workspace": mở từ ⋯ của header detail, đổi tên rồi lưu ghi vào store + có toast', async () => {
  renderFrame(<WorkspacesPreviewView workspaceId="ws-acme" />)
  openWorkspacePanel('Thông tin Workspace')
  const dialog = screen.getByRole('dialog', { name: 'Thông tin Workspace' })
  // Form mồi bằng dữ liệu thật của workspace, không phải placeholder đẹp như ảnh.
  const nameInput = within(dialog).getByRole('textbox', { name: 'Tên Workspace' }) as HTMLInputElement
  expect(nameInput.value).toBe('Acme Corp')
  fireEvent.change(nameInput, { target: { value: 'Acme Holdings' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }))
  // Mutation optimistic nên store đổi NGAY; dialog đóng; toast tới sau 160ms (await).
  expect(previewMockStore.getState().workspaces.find(item => item.id === 'ws-acme')!.name).toBe('Acme Holdings')
  expect(screen.queryByRole('dialog', { name: 'Thông tin Workspace' })).toBeNull()
  expect(await screen.findByText('Đã cập nhật thông tin “Acme Holdings”')).toBeDefined()
})

it('modal "Quản lý thành viên": liệt kê roster thật (không bịa mặt) + tìm kiếm lọc dòng', () => {
  renderFrame(<WorkspacesPreviewView workspaceId="ws-acme" />)
  openWorkspacePanel('Quản lý thành viên')
  const dialog = screen.getByRole('dialog', { name: 'Quản lý thành viên' })
  // Acme: chủ sở hữu (Minh Anh) + 2 người trong memberPreview (Huy, Hà) = 3 dòng thật.
  const memberRows = () => dialog.querySelectorAll('.members-table tbody tr')
  expect(memberRows()).toHaveLength(3)
  expect(dialog.querySelector('.role-owner')).not.toBeNull()
  // Chủ batch 03/11 bật THẬT hai ô thao tác trên dòng: vai trò giờ là <select> ghi vào
  // `memberRoles`, không còn badge tĩnh. Badge chỉ còn trên dòng chủ sở hữu — người duy nhất
  // KHÔNG có quyền đổi vai trò, nên cũng là người duy nhất không có ô chọn.
  expect(dialog.querySelectorAll('.role-badge')).toHaveLength(1)
  expect(dialog.querySelectorAll('.members-table tbody select')).toHaveLength(2)
  // Tìm theo tên/email lọc còn đúng 1 dòng (Trần Quang Huy).
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Tìm kiếm thành viên' }), { target: { value: 'quang' } })
  expect(memberRows()).toHaveLength(1)
})

// "Thêm thành viên" từng là nút chết — chủ batch báo đúng một lần. Ảnh "Neon Workspace
// Management Panels" vẽ nó là nút THẬT, nên test phải đi hết đường: bấm → ô tìm hiện trong
// modal → chọn một người → roster đổi ngay (3 chỗ: dòng bảng, con số đếm, avatar trên thẻ)
// → toast có Hoàn tác → rút lại là về đúng số cũ.
it('"Thêm thành viên" ghi thật vào roster (dòng + con số) và Hoàn tác rút lại được', async () => {
  renderFrame(<WorkspacesPreviewView workspaceId="ws-acme" />)
  openWorkspacePanel('Quản lý thành viên')
  const dialog = screen.getByRole('dialog', { name: 'Quản lý thành viên' })
  const acme = () => previewMockStore.getState().workspaces.find(item => item.id === 'ws-acme')!
  const rows = () => dialog.querySelectorAll('.members-table tbody tr')
  expect(rows()).toHaveLength(3)
  expect(acme().members).toBe(8)

  // Nút tự nói trạng thái (aria-expanded + aria-controls trỏ đúng ô nó mở ra).
  const addToggle = within(dialog).getByRole('button', { name: /Thêm thành viên/ })
  expect(addToggle.getAttribute('aria-expanded')).toBe('false')
  expect(document.getElementById(addToggle.getAttribute('aria-controls') ?? '')).toBeNull()
  fireEvent.click(addToggle)
  expect(addToggle.getAttribute('aria-expanded')).toBe('true')

  // 'thảo vy' khớp đúng MỘT người trong danh bạ và người đó CHƯA thuộc workspace.
  const search = within(dialog).getByRole('textbox', { name: 'Tìm người để thêm vào Workspace' })
  fireEvent.change(search, { target: { value: 'thảo vy' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm' }))

  expect(rows()).toHaveLength(4)
  // Badge = chủ sở hữu; ba dòng còn lại (2 cũ + 1 mới) đều đổi vai trò bằng ô chọn trên dòng.
  expect(dialog.querySelectorAll('.members-table tbody .role-badge')).toHaveLength(1)
  expect(dialog.querySelectorAll('.members-table tbody select')).toHaveLength(3)
  expect(acme().members).toBe(9)
  // Vai trò phải là Member chứ không phải vị trí thứ tư của cycle suy theo thứ tự dòng.
  expect(acme().memberRoles?.['u-vy']).toBe('Member')
  expect(within(dialog).getByRole('textbox', { name: 'Tìm kiếm thành viên' })).toBeDefined()
  expect(await screen.findByText('Đã thêm Bùi Hồ Thảo Vy vào Acme Corp')).toBeDefined()

  fireEvent.click(await screen.findByRole('button', { name: 'Hoàn tác' }))
  expect(rows()).toHaveLength(3)
  expect(acme().members).toBe(8)
  expect(acme().memberRoles?.['u-vy']).toBeUndefined()
})

it('wizard "Tạo Project": 4 bước, bước Import bắt buộc một .csv, rồi "Xem Project" điều hướng thật', async () => {
  renderFrame(<WorkspacesPreviewView workspaceId="ws-acme" />)
  fireEvent.click(screen.getByRole('button', { name: 'Tạo Project' }))
  const dialog = screen.getByRole('dialog', { name: 'Tạo Project' })
  const next = (): void => { fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp theo' })) }

  // Bước 1 chặn tên trống: bấm Tiếp theo vẫn ở bước 1 và hiện lý do.
  next()
  expect(within(dialog).getByText('Tên project không được để trống.')).toBeDefined()
  expect(within(dialog).getByRole('textbox', { name: 'Tên Project' })).toBeDefined()

  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Tên Project' }), { target: { value: 'Đánh giá chất lượng dữ liệu' } })
  next() // → bước 2 Import Dataset

  // BƯỚC 2 THEO CHỦ BATCH 03/11: "mỗi project phải gắn liền với 1 dataset ngay từ đầu", nên KHÔNG
  // còn đường tạo project trống. Chưa có tệp thì ở lại bước này và nói rõ thiếu gì.
  next()
  expect(within(dialog).getByText('Mỗi project phải gắn với một tập dữ liệu ngay khi tạo — hãy chọn tệp .csv.')).toBeDefined()

  // Số hiện trên màn là SỐ ĐO TỪ NỘI DUNG TỆP (2 bản ghi · 3 cột), không phải hằng số viết tay.
  await attachCsv(dialog, 'orders.csv', 'order_id;amount;status\n1;20000;ok\n2;15000;pending')
  expect(within(dialog).getByText(/orders\.csv/)).toBeDefined()
  const shape = document.querySelector('.pv-import-shape')?.textContent ?? ''
  expect(shape).toContain('Số bản ghi')
  expect(shape).toContain('2')
  expect(shape).toContain('3')
  expect(within(dialog).queryByText('Mỗi project phải gắn với một tập dữ liệu ngay khi tạo — hãy chọn tệp .csv.')).toBeNull()

  next() // → bước 3 Thành viên

  // Bước 3: chỉ chọn được người ĐÃ thuộc workspace (bất biến nghiệp vụ chủ batch nhắc lại) nên
  // đây là checkbox trên dòng roster, không phải ô nhập email mời người ngoài — ô đó đã bị GỠ.
  expect(within(dialog).queryByRole('textbox', { name: 'Thêm thành viên bằng email' })).toBeNull()
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Chọn Trần Quang Huy vào project' }))
  fireEvent.change(within(dialog).getByRole('combobox', { name: 'Vai trò của Trần Quang Huy trong project' }), { target: { value: 'Admin' } })
  expect(dialog.querySelectorAll('.pv-selected-chips .pv-chip')).toHaveLength(1)
  next() // → bước 4 xác nhận

  expect(within(dialog).getByText('Đánh giá chất lượng dữ liệu')).toBeDefined()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo Project' }))

  // Màn hình thành công; project mới LUÔN mang một dataset (điều kiện của chủ batch) với đúng số
  // đo vừa đọc từ tệp, và trạng thái 'queued' vì frame này không chạy pipeline làm sạch.
  expect(within(dialog).getByText('Tạo Project thành công!')).toBeDefined()
  const created = previewMockStore.getState().projects[0]
  expect(created.name).toBe('Đánh giá chất lượng dữ liệu')
  expect(created.workspaceId).toBe('ws-acme')
  expect(created.dataset?.fileName).toBe('orders.csv')
  expect(created.dataset?.rows).toBe(2)
  expect(created.dataset?.columns).toBe(3)
  expect(created.dataset?.status).toBe('queued')
  // Vai trò chọn ở bước 3 phải đi vào bản ghi, không chỉ nằm trên chip.
  expect(created.members.map(person => `${person.name}:${person.role}`)).toEqual(['Trần Quang Huy:Admin'])
  expect(await screen.findByText('Đã tạo project “Đánh giá chất lượng dữ liệu” trong Acme Corp kèm orders.csv')).toBeDefined()

  fireEvent.click(within(dialog).getByRole('button', { name: 'Xem Project' }))
  expect(window.location.hash).toContain('#/preview/projects/ws-acme/')
})

// BẤT BIẾN NGHIỆP VỤ chủ batch nhắc lại, và nó là điều kiện ĐÚNG của hệ: chỉ thành viên đã thuộc
// workspace mới được chủ sở hữu chọn vào một project trong workspace đó. Ba gạch đầu dòng ảnh vẽ
// bên phải danh sách bước 3 nói cùng một điều. Test chứng minh bằng cả hai chiều: người NGOÀI
// roster không xuất hiện để chọn, và không có lối nào (ô email, nút thêm) để lách vào.
it('wizard bước "Thành viên": chỉ liệt kê roster của workspace, không có lối mời người ngoài', async () => {
  renderFrame(<WorkspacesPreviewView workspaceId="ws-acme" />)
  fireEvent.click(screen.getByRole('button', { name: 'Tạo Project' }))
  const dialog = screen.getByRole('dialog', { name: 'Tạo Project' })
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Tên Project' }), { target: { value: 'P' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp theo' }))
  // Bước Import Dataset là bước BẮT BUỘC (mỗi project sinh ra kèm một tệp) nên muốn sang bước
  // Thành viên thì phải đưa thật một tệp .csv.
  await attachCsv(dialog, 'p.csv', 'a;b\n1;2')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp theo' }))

  // Acme roster = chủ sở hữu (Minh Anh) + Huy + Hà. Chủ sở hữu KHÔNG hiện để chọn (ảnh ghi
  // "Chủ sở hữu luôn thuộc project"), nên đúng HAI checkbox.
  expect(within(dialog).getAllByRole('checkbox').map(box => box.getAttribute('aria-label'))).toEqual([
    'Chọn Trần Quang Huy vào project', 'Chọn Lê Thu Hà vào project',
  ])
  expect(within(dialog).queryByText('Bùi Hồ Thảo Vy')).toBeNull()

  // Tìm một người KHÔNG thuộc workspace → không có dòng nào, và lời nhắc chỉ về roster chứ không
  // mời gõ email.
  const search = within(dialog).getByRole('textbox', { name: 'Tìm kiếm thành viên trong Workspace' })
  fireEvent.change(search, { target: { value: 'thảo vy' } })
  expect(within(dialog).queryAllByRole('checkbox')).toHaveLength(0)
  expect(within(dialog).getByText('Không có thành viên nào của Workspace khớp “thảo vy”.')).toBeDefined()

  // Ba ghi chú quy tắc ảnh vẽ, đủ và không thêm quy tắc nào ảnh không nêu.
  expect(within(dialog).getByText('Chỉ có thể chọn thành viên đã thuộc Workspace này.')).toBeDefined()
  expect(within(dialog).getByText('Không thể thêm tài khoản bên ngoài Workspace.')).toBeDefined()
  expect(within(dialog).getByText('Bạn có thể thêm nhiều thành viên và phân quyền sau khi tạo Project.')).toBeDefined()
})

// Bước "Import Dataset" KHÔNG còn là hai lựa chọn (project trống / tải tệp) như bản cũ: chỉ đạo
// 03/11 là "mỗi project phải gắn liền với 1 dataset ngay từ đầu". Test chốt bằng cách đếm ký hiệu
// của lựa chọn cũ — hết radio, hết chữ "trống" — và kiểm ô nạp tệp nhận đúng .csv.
it('wizard bước "Import Dataset": bắt buộc một tệp .csv, không còn cửa tạo project trống', async () => {
  renderFrame(<WorkspacesPreviewView workspaceId="ws-acme" />)
  fireEvent.click(screen.getByRole('button', { name: 'Tạo Project' }))
  const dialog = screen.getByRole('dialog', { name: 'Tạo Project' })
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Tên Project' }), { target: { value: 'P' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp theo' }))

  expect(within(dialog).queryAllByRole('radio')).toHaveLength(0)
  expect(within(dialog).queryByText(/project trống|chưa có tập dữ liệu/i)).toBeNull()
  const input = within(dialog).getByLabelText('Chọn tập dữ liệu CSV')
  expect(input.getAttribute('accept')).toBe('.csv,text/csv')

  // Chặn ở lại bước này khi chưa có tệp, kèm lý do dài (không phải một nút chết im lặng).
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp theo' }))
  expect(within(dialog).getByRole('alert').textContent).toContain('hãy chọn tệp .csv')
  expect(within(dialog).queryByRole('checkbox')).toBeNull()

  await attachCsv(dialog, 'p.csv', 'a;b\n1;2')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp theo' }))
  expect(within(dialog).getByRole('textbox', { name: 'Tìm kiếm thành viên trong Workspace' })).toBeDefined()
  everyDisabledButtonHasVisibleReason()
})

it('nút đổi kiểu hiển thị lưới/danh sách giữ selected và aria-pressed', () => {
  renderFrame(<WorkspacesPreviewView />)
  const listButton = screen.getByRole('button', { name: 'Hiển thị dạng danh sách' })
  fireEvent.click(listButton)
  expect(listButton.getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: 'Hiển thị dạng lưới' }).getAttribute('aria-pressed')).toBe('false')
  expect(document.querySelector('.card-grid')!.classList.contains('is-list')).toBe(true)
  expect(document.querySelector('.resource-card')!.classList.contains('is-list')).toBe(true)
})

it('★ là nút thật: bỏ yêu thích đổi dữ liệu ngay lần click và Hoàn tác trả lại', async () => {
  renderFrame(<WorkspacesPreviewView />)
  const favorite = screen.getByRole('button', { name: 'Bỏ yêu thích Acme Corp' })
  expect(favorite.getAttribute('aria-pressed')).toBe('true')

  fireEvent.click(favorite)
  // Mutation áp dụng optimistic (trước khi "chờ" 160ms) nên store đổi NGAY lần click.
  // Trang này không còn tab 'Yêu thích (N)' để nhìn (ảnh không vẽ tab nào ở trang Workspaces)
  // → bằng chứng lấy thẳng từ nguồn mà mọi control cùng đọc: mock store.
  expect(previewMockStore.getState().workspaces.find(item => item.id === 'ws-acme')!.favorite).toBe(false)
  expect(screen.getByRole('button', { name: 'Yêu thích Acme Corp' }).getAttribute('aria-pressed')).toBe('false')

  fireEvent.click(await screen.findByRole('button', { name: 'Hoàn tác' }))
  expect(previewMockStore.getState().workspaces.find(item => item.id === 'ws-acme')!.favorite).toBe(true)
  expect(screen.getByText('Đã hoàn tác thao tác vừa rồi.')).toBeDefined()
})

it('home + workspaces + projects: không còn nút im lặng, mọi nút disabled đều có note', () => {
  for (const view of [<WorkspacesPreviewView key="ws" />, <ProjectsPreviewView key="prj" />, <HomePreviewView key="home" />]) {
    renderFrame(view)
    everyDisabledButtonHasVisibleReason()
    cleanup()
  }
})

it('projects: phân trang, đổi số dòng mỗi trang và sắp xếp', () => {
  renderFrame(<ProjectsPreviewView />)
  expect(cardCount()).toBe(9)
  expect(screen.getByText('Hiển thị 1–9 của 12 project')).toBeDefined()

  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(cardCount()).toBe(3)
  expect(screen.getByText('Hiển thị 10–12 của 12 project')).toBeDefined()
  expect(screen.getByRole('button', { name: 'Trang trước' }).hasAttribute('disabled')).toBe(false)

  fireEvent.change(screen.getByRole('combobox', { name: 'Số dòng mỗi trang' }), { target: { value: '12' } })
  expect(cardCount()).toBe(12)
  expect(screen.getByText('Hiển thị 1–12 của 12 project')).toBeDefined()

  fireEvent.change(screen.getByRole('combobox', { name: 'Sắp xếp' }), { target: { value: 'name' } })
  expect(document.querySelector('.resource-card h3')!.textContent).toBe('Customer 360')
})

it('projects: nhãn tab và số stat card suy ra từ dữ liệu, bấm tab ra đúng số thẻ', () => {
  renderFrame(<ProjectsPreviewView />)
  // Trước đây các số này viết tay; 8 đang-hoạt-động nhưng dữ liệu chỉ có 7 → bấm tab ra thiếu thẻ.
  expect(statValue('Tổng project')).toBe('12')
  expect(statValue('Tổng dataset')).toBe('11') // 12 project, riêng 'Open Questions' chưa nạp dataset
  expect(statValue('Đang hoạt động')).toBe('8')
  expect(statValue('Đã hoàn thành')).toBe('1')

  fireEvent.click(screen.getByRole('tab', { name: 'Đã hoàn thành (1)' }))
  expect(cardCount()).toBe(1)
  fireEvent.click(screen.getByRole('tab', { name: 'Tạm dừng (2)' }))
  expect(cardCount()).toBe(2)
  fireEvent.click(screen.getByRole('tab', { name: 'Đang hoạt động (8)' }))
  expect(cardCount()).toBe(8)
})

it('projects: phạm vi lấy theo không gian đang chọn, bỏ phạm vi thì gộp mọi workspace', () => {
  renderFrame(<ProjectsPreviewView />)
  expect(document.querySelector('.page-eyebrow')!.textContent).toContain('Dự án trong Acme Corp')

  // 18 project mẫu trải trên 6 workspace; ở phạm vi toàn cục thì trang phải thấy đủ 18.
  pickAllWorkspaces()
  expect(statValue('Tổng project')).toBe('18')
  expect(document.querySelector('.page-eyebrow')!.textContent).toContain('Dự án trong mọi không gian')
})

// Trang Projects KHÔNG còn ô tìm kiếm (chủ batch 03/11: ô tìm chỉ ở trang Workspaces và trang
// chi tiết workspace). Muốn thấy một thẻ cụ thể thì đi bằng đường thật còn lại: tab lọc, sắp
// xếp, hoặc nới số dòng mỗi trang.
it('projects: không có ô tìm; thẻ không có dataset hiện khu vực trống; bấm một thẻ mở trang Project', () => {
  renderFrame(<ProjectsPreviewView />)
  expect(screen.queryByRole('searchbox')).toBeNull()
  expect(screen.queryByRole('textbox', { name: /tìm/i })).toBeNull()
  // 12 project của Acme / 9 một trang → 'Open Questions' (thứ 12) nằm ngoài trang đang hiển thị.
  expect(cardCount()).toBe(9)
  expect(screen.queryByText('Open Questions')).toBeNull()
  fireEvent.change(screen.getByRole('combobox', { name: 'Số dòng mỗi trang' }), { target: { value: '24' } })
  expect(cardCount()).toBe(12)

  // Thân thẻ nói thẳng project chưa nạp dataset (khu vực nạp thuộc module Dataset của T).
  expect(within(cardByTitle('Open Questions')).getByText('Chưa có tập dữ liệu.')).toBeDefined()
  // 1 click = điều hướng sang trang Project riêng (không còn panel kề bên).
  fireEvent.click(cardByTitle('Open Questions'))
  expect(window.location.hash).toBe('#/preview/projects/ws-acme/prj-empty')
})

it('home: hero là placeholder 2D cho scene 3D của T + dải giá trị, bỏ hết tiện ích thừa', () => {
  renderFrame(<HomePreviewView />)
  const stage = screen.getByRole('img', { name: /Minh họa vũ trụ dữ liệu/ })
  expect(stage.querySelector('.stage-tag')).toBeNull()
  expect(screen.queryByRole('canvas')).toBeNull()
  // Ba giá trị dưới hero (ảnh home). Bản cũ kê thêm .stage-satellite / hero-card /
  // hero-module-list — trùng hàng stat bên dưới và không có trong ảnh → đã bỏ.
  expect(document.querySelectorAll('.hero-values li')).toHaveLength(3)
  expect(document.querySelector('.hero-card')).toBeNull()
  // Khong còn nhóm "Thao tác nhanh" (quick actions) bị coi là dư thừa.
  expect(screen.queryByRole('button', { name: 'Tạo dự án mới' })).toBeNull()
  // CTA hero nay chuyen trang that (khong con la nut tat).
  expect(screen.getByRole('button', { name: /Mở Dataset Universe/ }).hasAttribute('disabled')).toBe(false)
})

it('home: đúng năm khối — 3 panel tổng quan + 2 danh sách gần đây', () => {
  renderFrame(<HomePreviewView />)
  // Hàng tổng quan: Activity Overview (rộng) + Projects by Status + Projects per Workspace.
  expect(screen.getByRole('heading', { level: 2, name: 'Activity Overview' })).toBeDefined()
  expect(screen.getByRole('heading', { level: 2, name: 'Projects by Status' })).toBeDefined()
  expect(screen.getByRole('heading', { level: 2, name: 'Projects per Workspace' })).toBeDefined()
  // Hai danh sách gần đây — nhãn tiếng Việt theo yêu cầu chủ sở hữu batch (duyệt từng khung).
  expect(screen.getByRole('heading', { level: 2, name: 'Workspace gần đây' })).toBeDefined()
  expect(screen.getByRole('heading', { level: 2, name: 'Projects gần đây' })).toBeDefined()
  // Bộ chọn thời gian (nhãn tiếng Anh theo đặc tả).
  expect((screen.getByRole('combobox', { name: 'Time range' }) as HTMLSelectElement).value).toBe('30 ngày gần nhất')
})

it('home: stat, donut và bar cùng đọc một nguồn store (không bịa số)', () => {
  renderFrame(<HomePreviewView />)
  const state = previewMockStore.getState()
  // Stat 'Projects' và hổng donut đều bằng đúng số project trong store.
  expect(statValue('Projects')).toBe(String(state.projects.length))
  expect(statValue('Workspaces')).toBe(String(state.workspaces.length))
  expect(document.querySelector('.donut-hole strong')!.textContent).toBe(String(state.projects.length))
  // Bar 'Projects per Workspace' đếm project THẬT của từng workspace, không đọc trường viết tay.
  const acme = state.workspaces.find(item => item.name === 'Acme Corp')!
  const acmeExpected = state.projects.filter(item => item.workspaceId === acme.id).length
  const acmeBar = Array.from(document.querySelectorAll<HTMLElement>('.pv-bars .pv-col'))
    .find(col => col.querySelector('.pv-bar-label')?.textContent === acme.name)
  expect(acmeBar).toBeDefined()
  expect(Number(acmeBar!.querySelector('.pv-bar-value')?.textContent)).toBe(acmeExpected)
})

it('home: Workspaces là lưới tile (giữ .mini-card) và bảng Project có cột # + Data File + phân trang', () => {
  renderFrame(<HomePreviewView />)
  const wsTotal = previewMockStore.getState().workspaces.length
  const prjTotal = previewMockStore.getState().projects.length

  // Workspaces: 24 nút một trang, khung hé 12 và lướt trong khung → cả trang nằm trong DOM,
  // mỗi tile vừa là .mini-card (định vị test cũ) vừa là .ws-tile (kiểu "nút lớn" 3 cột).
  // 24 chứ không phải min(): bộ demo có 28 bản ghi nên trang 1 phải TRỌN VẸN 24 nút.
  expect(wsTotal).toBeGreaterThan(24)
  expect(document.querySelectorAll('.ws-tiles .ws-tile')).toHaveLength(24)

  // Bảng Project (nhãn cột tiếng Anh): có cột # và Data File; 10 dòng một trang, khung hé 5.
  const headers = Array.from(document.querySelectorAll('.home-table thead th')).map(th => th.textContent)
  expect(headers).toContain('#')
  expect(headers).toContain('Data File')
  const rows = document.querySelectorAll('.home-table tbody tr')
  expect(rows).toHaveLength(Math.min(10, prjTotal))
  expect(rows[0].querySelector('.row-index')?.textContent).toBe('1')

  // Hai khung tự lướt nên chân trang KHÔNG còn dòng "Hiển thị 1–12 của 12…" và ô chọn số
  // dòng mỗi trang. Khoá bằng phủ định: thêm lại một trong hai thứ là fail.
  expect(screen.queryAllByText(/Hiển thị \d/)).toHaveLength(0)
  expect(screen.queryByRole('combobox', { name: /mỗi trang/ })).toBeNull()
})

it('home: chuyển trang bảng Project tiếp tục đánh số # và không đổi tổng', () => {
  renderFrame(<HomePreviewView />)
  const prjTotal = previewMockStore.getState().projects.length
  expect(prjTotal).toBeGreaterThan(10) // nếu fixture nhỏ hơn thì không có trang 2 để kiểm

  const nav = screen.getByRole('navigation', { name: 'Projects pagination' })
  fireEvent.click(within(nav).getByRole('button', { name: 'Trang sau' }))
  // Cột # đếm theo vị trí trong danh sách đã phân trang, không reset về 1 ở trang mới
  // (10 dòng một trang nên trang 2 bắt đầu từ #11).
  expect(document.querySelector('.home-table tbody tr .row-index')?.textContent).toBe('11')
})

// Khóa chống quay lại bộ dữ liệu 12 workspace: khi đó khung "Workspace gần đây" đầy vừa khít
// (không gì để lướt) VÀ pageCount = 1 nên Pager không vẽ nút nào — chủ batch báo đúng hai triệu
// chứng đó là "chưa thấy". Bây giờ 28 bản ghi: trang 1 đủ 24, trang 2 lẻ 4.
it('home: khung Workspace gần đây có trang 2 thật và lật được (24 nút một trang)', () => {
  renderFrame(<HomePreviewView />)
  const total = previewMockStore.getState().workspaces.length
  expect(total).toBeGreaterThan(24)

  expect(document.querySelectorAll('.ws-tiles .ws-tile')).toHaveLength(24)
  const nav = screen.getByRole('navigation', { name: 'Workspaces pagination' })
  expect(within(nav).getAllByRole('button', { name: /^\d+$/ }).map(button => button.textContent)).toEqual(['1', '2'])
  // Nút '1' đang được chọn phải tự nói điều đó (aria-current), nếu không người dùng không biết
  // mình đang ở trang nào khi cả hai khung đều có phân trang.
  expect(within(nav).getByRole('button', { name: '1' }).getAttribute('aria-current')).toBe('page')

  fireEvent.click(within(nav).getByRole('button', { name: 'Trang sau' }))
  expect(document.querySelectorAll('.ws-tiles .ws-tile')).toHaveLength(total - 24)
  const after = screen.getByRole('navigation', { name: 'Workspaces pagination' })
  expect(within(after).getByRole('button', { name: '2' }).getAttribute('aria-current')).toBe('page')
  expect(within(after).getByRole('button', { name: 'Trang trước' }).hasAttribute('disabled')).toBe(false)
  expect(within(after).getByRole('button', { name: 'Trang sau' }).hasAttribute('disabled')).toBe(true)
})

it('trang Workspaces: năm thẻ số liệu đều suy từ store, hai thẻ cũ đã nhường chỗ', () => {
  renderFrame(<WorkspacesPreviewView />)
  const state = previewMockStore.getState()
  const owned = state.workspaces.filter(isOwnedByMe).length
  // Ảnh khung 1 vẽ 12 · 48 · 5 · 7 · 86 — những con số ĐÓ không có nguồn trong fixture nên
  // chỉ lấy đúng NĂM NHÃN; số là số của dữ liệu thật trên frame.
  expect(statValue('Tổng Workspace')).toBe(String(state.workspaces.length))
  // 'Tổng Project' đếm trên danh sách project, KHÔNG cộng trường `projects` viết tay trong
  // fixture — đó là loại lỗi đếm đã bắt được ở trang Projects.
  expect(statValue('Tổng Project')).toBe(String(state.projects.length))
  expect(statValue('Sở hữu')).toBe(String(owned))
  expect(statValue('Được chia sẻ')).toBe(String(state.workspaces.length - owned))
  expect(statValue('Thành viên')).toBe(String(state.workspaces.reduce((total, item) => total + item.members, 0)))
  // Hai thẻ chủ batch yêu cầu thay: 'Đang hoạt động' → Tổng Project, 'Tổng dung lượng' → bộ
  // lọc/số liệu khác trong ảnh. Khóa bằng phủ định để chúng không quay lại.
  expect(screen.queryByText('Đang hoạt động')).toBeNull()
  expect(screen.queryByText('Tổng dung lượng')).toBeNull()
})

it('shell đo chiều cao vùng cuộn và truyền --pv-viewport-h cho panel chi tiết', () => {
  renderFrame(<ProjectsPreviewView />)
  // jsdom không layout nên clientHeight = 0 → giá trị sàn 240px; điều cần khẳng định là
  // biến đã được gắn, để panel không quay lại kiểu "ghim ở đỉnh rồi cắt đáy".
  const content = document.querySelector<HTMLElement>('.preview-content')
  expect(content).not.toBeNull()
  expect(content!.style.getPropertyValue('--pv-viewport-h')).toMatch(/^\d+px$/)
})

// Nhãn bốn khối quanh tâm scene — đọc từ DOM, so với `projectModules` chứ không so với một
// mảng nhãn viết tay trong test (hai nguồn sẽ lệch nhau ngay khi ảnh đổi module).
const universeBlockLabels = (): string[] =>
  Array.from(document.querySelectorAll('.pj-block strong')).map(element => element.textContent ?? '')

// Trang Project Workspace Overview — ảnh UI-UX/projects/DataVerse_Project_Workspace_Overview_v1.
// Ba dải của ảnh, mọi số liệu suy từ mock store: dải đầu (tên + mô tả project | dataset + shape),
// khoang giữa (một khối tâm + bốn khối module), thanh đáy (bốn nút module).
it('trang Project: dải đầu dataset+shape, khoang giữa có tâm và bốn khối, thanh đáy bốn nút module', () => {
  renderFrame(<ProjectWorkspaceView projectId="prj-sales" />)
  expect(screen.getByRole('heading', { level: 1, name: /Sales Analytics/ })).toBeDefined()
  const crumb = screen.getByRole('navigation', { name: 'Path điều hướng' })
  expect(crumb.textContent).toContain('Acme Corp')
  expect(crumb.textContent).toContain('Sales Analytics')

  const dataset = previewMockStore.getState().projects.find(item => item.id === 'prj-sales')?.dataset
  expect(dataset).not.toBeNull()
  // "tên dataset và dung lượng bao gồm luôn shape()" = ba vế ảnh vẽ: kích thước | dòng | cột.
  const band = document.querySelector('.pj-dataset')?.textContent ?? ''
  expect(band).toContain(dataset!.fileName)
  expect(band).toContain(formatDataSize(dataset!.sizeMb))
  expect(band).toContain(formatRows(dataset!.rows))
  expect(band).toContain(`${formatCount(dataset!.columns)} cột`)

  // Khoang giữa: MỘT khối tâm mang tên tệp + bốn khối quanh tâm, theo đúng thứ tự ảnh vẽ.
  expect(document.querySelector('.pj-core')?.textContent).toContain(dataset!.fileName)
  expect(universeBlockLabels()).toEqual(projectModules.map(module => module.label))

  // Thanh đáy: bốn NÚT bấm được (không phải bốn nhãn trang trí), và 'Tổng quan' đang bật vì
  // ảnh vẽ ô đó active. Scene của T chưa được inject nên placeholder phải còn tại chỗ.
  for (const module of projectModules) expect(screen.getByRole('button', { name: module.label })).toBeDefined()
  expect(screen.getByRole('button', { name: 'Tổng quan' }).getAttribute('aria-current')).toBe('true')
  everyDisabledButtonHasVisibleReason()
})

// ⋯ của dataset trên dải đầu = ĐÚNG BA mục ảnh DataVerse_Project_Actions_Details_v1 (panel 1) vẽ:
// Thông tin Project · Quản lý thành viên · Xóa Project. Không phải menu năm mục của thẻ project
// trong danh sách — hai ⋯ khác ngữ cảnh, và ảnh là nguồn duy nhất cho trang này.
it('trang Project: ⋯ của dataset mở đúng ba mục của ảnh, "Quản lý thành viên" mở modal thật', () => {
  renderFrame(<ProjectWorkspaceView projectId="prj-sales" />)
  fireEvent.click(screen.getByRole('button', { name: 'Thao tác với Sales Analytics' }))
  const menu = menuFor('Sales Analytics')
  expect(within(menu).getAllByRole('menuitem').map(item => item.textContent?.trim())).toEqual([
    'Thông tin Project', 'Quản lý thành viên', 'Xóa Project',
  ])
  // Cả ba mục đều BẤM ĐƯỢC: chỉ đạo 03/11 là bật thật control làm được trên dữ liệu mẫu, chứ
  // không để một mục xám kèm dòng "chưa có API".
  for (const item of within(menu).getAllByRole('menuitem')) expect(item.hasAttribute('disabled')).toBe(false)

  fireEvent.click(within(menu).getByRole('menuitem', { name: 'Quản lý thành viên' }))
  const dialog = screen.getByRole('dialog', { name: 'Quản lý thành viên' })
  expect(dialog.textContent).toContain('Sales Analytics')
  // Lý do nằm ở CHÂN MODAL với id riêng, vì dải note đáy trang Project đã bỏ: để trùng id ở hai
  // nơi là hai phần tử cùng id trong DOM khi modal mở.
  expect(dialog.querySelector(`#${previewNoteIds.projectMembersPage}`)?.textContent)
    .toContain('Chỉ người đã thuộc Workspace')
  expect(document.querySelectorAll(`#${previewNoteIds.projectMembersPage}`)).toHaveLength(1)
  // Ràng buộc nghiệp vụ: ô thêm người chỉ duyệt roster của workspace, không có ô email tự do.
  expect(within(dialog).getByRole('button', { name: 'Thêm thành viên' })).toBeDefined()
  expect(within(dialog).queryByLabelText(/email/)).toBeNull()
  everyDisabledButtonHasVisibleReason()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng hộp thoại' }))
  expect(screen.queryByRole('dialog')).toBeNull()

  // Hai mục còn lại đi vào việc CÓ thật: thẻ thông tin (hover/click) và dialog xác nhận xóa.
  // Menu đã đóng khi modal mở (nó là surface cấp phiên, một surface mở tại một thời điểm) nên
  // mỗi mục bấm từ một lần ⋯ mới — không bấm vào menu đã bị gỡ khỏi DOM.
  cleanup()
  renderFrame(<ProjectWorkspaceView projectId="prj-sales" />)
  fireEvent.click(screen.getByRole('button', { name: 'Thao tác với Sales Analytics' }))
  fireEvent.click(within(menuFor('Sales Analytics')).getByRole('menuitem', { name: 'Thông tin Project' }))
  const card = document.querySelector('.pv-info-card')
  expect(card).not.toBeNull()
  expect(card?.textContent).toContain('Sales Analytics')

  cleanup()
  renderFrame(<ProjectWorkspaceView projectId="prj-sales" />)
  fireEvent.click(screen.getByRole('button', { name: 'Thao tác với Sales Analytics' }))
  fireEvent.click(within(menuFor('Sales Analytics')).getByRole('menuitem', { name: 'Xóa Project' }))
  // Xóa thì PHẢI qua màn xác nhận (alertdialog), không gỡ im lặng ngay từ menu.
  expect(screen.getByRole('alertdialog', { name: /Sales Analytics/ })).toBeDefined()
})

// Đặc tả UI-UX/projects/đặc tả.txt: "ấn các nút [module] cũng tương tự như ấn vào các ô khối 3d".
// Nhóm chưa chốt màn bên trong bốn module, nên điều test được là NỐI nút ↔ khối: chọn nút thì
// đúng một khối sáng, route không đổi, và lý do "chưa có trang" hiện ra nhìn thấy được.
it('trang Project: chọn nút module làm sáng đúng khối tương ứng, không đổi route', () => {
  renderFrame(<ProjectWorkspaceView projectId="prj-sales" />)
  const button = screen.getByRole('button', { name: 'Data View' })
  fireEvent.click(button)

  expect(button.getAttribute('aria-current')).toBe('true')
  expect(screen.getByRole('button', { name: 'Tổng quan' }).hasAttribute('aria-current')).toBe(false)
  const active = Array.from(document.querySelectorAll('.pj-block.is-active strong'))
    .map(element => element.textContent)
  expect(active).toEqual(['Data View'])

  expect(window.location.hash).toBe('')
  expect(document.getElementById(previewNoteIds.projectModules)).toBeNull()

  // Đường THẬT duy nhất tới scene của T: nút ở khoang giữa, điều hướng qua URL 3D (không hash).
  fireEvent.click(screen.getByRole('button', { name: /Mở Dataset Universe 3D/ }))
  expect(universeNavigator).toHaveBeenCalledWith(expect.stringContaining(`${universePath}#project=prj-sales`))
  expect(window.location.hash).toBe('')
})

it('trang Project: id không còn trong store → về danh sách, không vẽ trang trống', () => {
  renderFrame(<ProjectWorkspaceView projectId="prj-khong-ton-tai" />)
  expect(screen.getByText('Không tìm thấy project')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Về danh sách Project' }))
  expect(window.location.hash).toBe('#/preview/projects')
})

// Ba bảng "gần đây" trên Home tự hứa thứ tự theo độ mới. Bản cũ cắt theo thứ tự fixture,
// nên vừa đổi tên một project (mock store ghi 'vừa xong') là danh sách nói sai ngay
// dưới nhãn của chính nó. Test không đụng DOM/timer: thứ tự là hàm thuần của `updatedAt`.
it('bảng "gần đây" sắp theo updatedAt thật, không theo thứ tự fixture', () => {
  const state = previewMockStore.getState()
  const order = (list: readonly { updatedAt: string }[]) => [...list].sort(byNewestFirst).map(item => item.updatedAt)
  // Cùng một tập project, hai thứ tự fixture ngược nhau → đầu ra phải giống hệt nhau.
  expect(order([...state.projects].reverse())).toEqual(order(state.projects))

  // Bản nằm CUỐI danh sách: đặt nó thành 'vừa xong' thì nó phải lên đầu.
  const touched = [...state.projects]
  const lastWithDataset = touched
    .map((project, index) => ({ project, index }))
    .filter(entry => entry.project.dataset !== null)
    .at(-1)
  expect(lastWithDataset).toBeDefined()
  touched[lastWithDataset!.index] = { ...lastWithDataset!.project, updatedAt: 'vừa xong' }
  expect(order(touched)[0]).toBe('vừa xong')

  // Nhãn không giải mã được (ngày tuyệt đối) phải bị coi là CŨ NHẤT. Trả NaN thì comparator
  // hỏng và thứ tự sau sort thành không xác định — khó nhìn ra hơn nhiều so với một số to.
  expect(byNewestFirst({ updatedAt: '12/03/2024 14:32' }, { updatedAt: '2 giờ trước' })).toBeGreaterThan(0)
})
