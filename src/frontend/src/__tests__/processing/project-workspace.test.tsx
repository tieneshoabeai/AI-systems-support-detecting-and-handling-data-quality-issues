import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ProjectWorkspaceView } from '../../views/processing/project/project-workspace.view'
import { formatCount, formatDataSize, formatRows, previewNoteIds, projectModules } from '../../hooks/workbench/workbench-presentation'
import { previewMockStore } from '../support/management-mock-store'
import { everyDisabledButtonHasVisibleReason, menuFor, renderFrame, resetPreviewStore } from '../support/workbench-test-kit'

vi.mock('../../views/dataset-3d/dataset-3d.view', () => ({
  Dataset3DView: ({ embedded, focus, onFocusChange, onFocusComplete, colorMode }: {
    onFocusComplete: (theme: string) => void
    embedded?: boolean; focus: { theme: string } | null; colorMode: string
    onFocusChange: (focus: { theme: string } | null) => void
  }) => <div data-testid="dataset-scene" data-embedded={embedded} data-focus={focus?.theme} data-color-mode={colorMode}>
    <button onClick={() => onFocusChange({ theme: 'orange' })}>Chọn khối cam</button>
    <button onClick={() => focus && onFocusComplete(focus.theme)}>Focus hoàn tất</button>
    <button onClick={() => onFocusComplete('orange')}>Focus cam cũ hoàn tất</button>
    <button onClick={() => onFocusChange(null)}>Về góc tổng quan</button>
  </div>,
}))

beforeEach(() => { resetPreviewStore(); window.localStorage.clear(); window.location.hash = '' })
afterEach(() => { cleanup(); window.location.hash = '' })

// Nhãn bốn khối quanh tâm scene — đọc từ DOM, so với `projectModules` chứ không so với một
// mảng nhãn viết tay trong test (hai nguồn sẽ lệch nhau ngay khi ảnh đổi module).

// Trang Project Workspace Overview — ảnh UI-UX/projects/DataVerse_Project_Workspace_Overview_v1.
// Ba dải của ảnh, mọi số liệu suy từ mock store: dải đầu (tên + mô tả project | dataset + shape),
// khoang giữa (một khối tâm + bốn khối module), thanh đáy (bốn nút module).
it('trang Project: dataset+shape, scene 3D nhúng, không sidebar và bốn nút module', async () => {
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

  // Project embeds the existing scene instead of the former 2D illustration.
  expect(screen.queryByTestId('dataset-scene')).toBeNull()
  expect((await screen.findByTestId('dataset-scene')).getAttribute('data-embedded')).toBe('true')
  expect(document.querySelector('.pj-universe')).toBeNull()
  expect(screen.queryByRole('complementary', { name: 'Điều hướng chính' })).toBeNull()
  expect(screen.queryByText('Quản lý · Dữ liệu mẫu, chưa kết nối API')).toBeNull()

  // Thanh đáy: bốn NÚT bấm được (không phải bốn nhãn trang trí), và 'Tổng quan' đang bật vì
  // ảnh vẽ ô đó active.
  for (const module of projectModules.filter(item => item.id !== 'detection')) expect(screen.getByRole('button', { name: module.label })).toBeDefined()
  expect(screen.getByRole('button', { name: 'Tổng quan' }).hasAttribute('aria-current')).toBe(false)
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
it('trang Project: chọn module cập nhật nav, giữ scene và không đổi route', async () => {
  renderFrame(<ProjectWorkspaceView projectId="prj-sales" />)
  const button = screen.getByRole('button', { name: 'Data View' })
  fireEvent.click(button)

  expect(button.getAttribute('aria-current')).toBe('true')
  expect(screen.getByRole('button', { name: 'Tổng quan' }).hasAttribute('aria-current')).toBe(false)
  expect(await screen.findByTestId('dataset-scene')).toBeDefined()
  expect(screen.getByTestId('dataset-scene').getAttribute('data-focus')).toBe('blue')
  for (const [label, theme] of [['Tổng quan', 'violet'], ['Data Analysis', 'cyan']] as const) {
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(screen.getByTestId('dataset-scene').getAttribute('data-focus')).toBe(theme)
  }
  fireEvent.click(screen.getByRole('button', { name: 'Data View' }))
  fireEvent.click(screen.getByRole('button', { name: 'Chọn khối cam' }))
  expect(screen.queryByRole('button', { name: 'Detection' })).toBeNull()
  expect(screen.getByTestId('dataset-scene').getAttribute('data-focus')).toBe('blue')
  fireEvent.click(screen.getByRole('button', { name: 'Về góc tổng quan' }))
  expect(screen.getByRole('button', { name: 'Data View' }).hasAttribute('aria-current')).toBe(false)
  for (const module of projectModules.filter(item => item.id !== 'detection')) expect(screen.getByRole('button', { name: module.label }).hasAttribute('disabled')).toBe(false)

  expect(window.location.hash).toBe('')
  expect(document.getElementById(previewNoteIds.projectModules)).toBeNull()

  // Universe là không gian của Project, không còn lối mở thứ hai.
  expect(screen.queryByRole('button', { name: /Mở Dataset Universe/ })).toBeNull()
  expect(window.location.hash).toBe('')
})

it('trang Project: chỉ mở panel sau khi focus module hiện tại hoàn tất', async () => {
  renderFrame(<ProjectWorkspaceView projectId="prj-sales" />)
  expect(screen.queryByRole('button', { name: 'Quay lại' })).toBeNull()
  expect(document.querySelector('.pj-band')).toBeNull()
  expect(document.querySelector('.pj-dataset')?.parentElement?.className).toBe('pj-head-row')
  expect(screen.getByRole('link', { name: 'Trang chủ Processing' }).getAttribute('href')).toBe('/processing')
  expect((screen.getByRole<HTMLButtonElement>('button', { name: 'Tải file kết quả' })).disabled).toBe(true)
  await screen.findByText('Focus hoàn tất')
  fireEvent.click(screen.getByRole('button', { name: 'Data View' }))
  fireEvent.click(screen.getByText('Focus cam cũ hoàn tất'))
  expect(screen.queryByRole('complementary', { name: 'Data View' })).toBeNull()
  fireEvent.click(screen.getByText('Focus hoàn tất'))
  const panel = screen.getByRole('complementary', { name: 'Data View' })
  const move = within(panel).getByRole('button', { name: 'Khôi phục vị trí và kích thước mặc định', description: /mũi tên.*Shift.*Home/ })
  const edge = within(panel).getByRole('button', { name: 'Đổi chiều rộng cửa sổ', description: /mũi tên trái hoặc phải.*Shift.*Home/ })
  within(panel).getByRole('button', { name: 'Đổi chiều rộng và chiều cao cửa sổ', description: /mũi tên.*Shift.*Home/ })

  const stage = panel.parentElement
  if (!stage) throw new Error('Project panel requires a stage')
  vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 720, 480))
  vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(new DOMRect(320, 20, 360, 300))
  fireEvent.keyDown(move, { key: 'ArrowRight' })
  expect(stage.style.getPropertyValue('--project-module-right')).toBe('16px')
  fireEvent.keyDown(edge, { key: 'ArrowLeft', shiftKey: true })
  expect(stage.style.getPropertyValue('--project-module-width')).toBe('408px')
  fireEvent.keyDown(move, { key: 'Home' })
  expect(stage.style.getPropertyValue('--project-module-right')).toBe('')
  expect(stage.style.getPropertyValue('--project-module-width')).toBe('')
  fireEvent.click(screen.getByRole('button', { name: 'Đóng bảng module' }))
  expect(screen.queryByRole('complementary', { name: 'Data View' })).toBeNull()
})

it('trang Project: id không còn trong store → về danh sách, không vẽ trang trống', () => {
  renderFrame(<ProjectWorkspaceView projectId="prj-khong-ton-tai" />)
  expect(screen.getByText('Không tìm thấy project')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Về danh sách Project' }))
  expect(window.location.pathname).toBe('/management/projects')
})
