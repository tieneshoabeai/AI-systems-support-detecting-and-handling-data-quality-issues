import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { HomePreviewView } from '../../views/preview/home-2d.view'
import { WorkspacesPreviewView } from '../../views/preview/workspaces-2d.view'
import { ProjectsPreviewView } from '../../views/preview/projects-2d.view'
import { previewMockStore } from '../../services/preview/preview-mock.service'
import {
  cardByTitle, everyDisabledButtonHasVisibleReason, menuFor, menuItem,
  miniCardByTitle, renderFrame, resetPreviewStore, universeNavigator,
} from './preview-test-kit'

// Nghiệm lại bằng test đúng các quy tắc chuột nhóm trưởng chốt cho batch 2D:
//   · project  : 1 VÀ 2 click = trang Project Workspace Overview (3D nằm TRONG trang đó)
//   · workspace: 1 click = xuống Workspaces kèm phạm vi (thanh menu cũng xuống theo)
//   · chuột phải / nút ⋯ / "Thao tác ▾" : cùng MỘT menu, cùng MỘT hành vi
//   · mọi thao tác ghi: đổi bộ nhớ tab + toast có Hoàn tác; xóa thì phải xác nhận
// Trang 3D của T là một lần tải trang thật nên inject qua universeNavigator (jsdom
// không điều hướng được) — assert chính xác URL mà main.tsx của T sẽ nhận.

const cardTitles = (): string[] =>
  Array.from(document.querySelectorAll('.resource-card h3')).map(element => element.textContent ?? '')

// Thẻ đang chọn và panel chi tiết bên cạnh CÙNG có nút ⋯ với cùng một nhãn, nên phải
// giới hạn truy vấn trong thẻ — nếu not thì test bấm nhầm vào nút của panel chi tiết.
const menuButtonOf = (title: string): HTMLElement =>
  within(cardByTitle(title)).getByRole('button', { name: `Thao tác với ${title}` })

beforeEach(() => { resetPreviewStore(); window.localStorage.clear(); window.location.hash = '' })
afterEach(() => { cleanup(); window.location.hash = '' })

it('chuột phải mở menu tại con trỏ; menu project điều hướng được tới trang Project', () => {
  renderFrame(<HomePreviewView />)
  const firstRow = document.querySelector<HTMLTableRowElement>('.home-table tbody tr')!
  const rowName = firstRow.querySelector('.row-name')!.textContent!.trim()
  fireEvent.contextMenu(firstRow, { clientX: 320, clientY: 210 })

  const menu = menuFor(rowName)
  // Mở từ con trỏ thì không có trigger để neo, nên menu nằm đúng chỗ người dùng vừa bấm.
  expect(menu.getAttribute('data-trigger')).toBe('pointer')
  expect(menu.style.left).toBe('320px')
  expect(menu.style.top).toBe('210px')

  // ⋯ của project có ĐÚNG BỐN mục chủ batch 03/11 chốt (áp cho mọi ⋯ của project, không
  // riêng Home). So cả danh sách chứ không chỉ "có mặt": 'universe' · 'duplicate' · ba item
  // 'đặt trạng thái' đã rút và "Lưu trữ Project" vừa bị bỏ theo yêu cầu — một lần thêm lại âm
  // thầm là test này đỏ.
  expect(within(menu).getAllByRole('menuitem').map(item => item.textContent?.trim())).toEqual([
    'Mở Project', 'Xem thông tin', 'Đổi tên', 'Xóa Project',
  ])
})

// Thẻ "Xem thông tin" theo đúng đặc tả chủ batch: lối vào là con trỏ lia trên CHÍNH mục
// "Xem thông tin" trong menu ⋯, không phải cả dòng bảng. React không nghe 'mouseenter' trực
// tiếp (plugin EnterLeave suy ra từ mouseover/mouseout), nên test phát mouseOver/mouseOut
// đúng như browser thật.
it('lia chuột vào mục "Xem thông tin" trong ⋯ mở thẻ tóm tắt, rời mục thì thẻ tắt', () => {
  renderFrame(<HomePreviewView />)
  const row = document.querySelector<HTMLTableRowElement>('.home-table tbody tr')!
  const name = row.querySelector('.row-name')!.textContent!.trim()

  // Lia trên dòng bảng KHÔNG mở thẻ nữa — chỉ mục "Xem thông tin" mới mở.
  fireEvent.mouseOver(row)
  expect(document.querySelector('.pv-info-card')).toBeNull()
  fireEvent.mouseOut(row)

  fireEvent.click(within(row).getByRole('button', { name: `Thao tác với ${name}` }))
  // Mở menu chưa phải là mở thẻ.
  expect(document.querySelector('.pv-info-card')).toBeNull()

  const item = menuItem('Xem thông tin')
  fireEvent.mouseOver(item)
  const card = document.querySelector('.pv-info-card')
  expect(card).not.toBeNull()
  expect(card?.textContent).toContain(name)
  // Bản tóm tắt phải đủ để nhận ra project mà chưa phải màn chi tiết: workspace · chủ sở hữu ·
  // số dòng của tập dữ liệu. Thiếu một trong ba thì thẻ chỉ là cái tên viết lại.
  expect(card?.textContent).toContain('Workspace')
  expect(card?.textContent).toContain('Chủ sở hữu')
  // Thẻ là flyout CỦA menu nên menu vẫn phải còn đó — hai surface đi cùng nhau.
  expect(screen.getByRole('menu')).toBeDefined()

  fireEvent.mouseOut(item)
  expect(document.querySelector('.pv-info-card')).toBeNull()
})

it('bấm mục "Xem thông tin" thì menu đóng nhưng thẻ Ở LẠI (lối vào cho bàn phím), Esc đóng thẻ', () => {
  renderFrame(<HomePreviewView />)
  const row = document.querySelector<HTMLTableRowElement>('.home-table tbody tr')!
  const name = row.querySelector('.row-name')!.textContent!.trim()

  fireEvent.click(within(row).getByRole('button', { name: `Thao tác với ${name}` }))
  fireEvent.click(menuItem('Xem thông tin'))

  expect(screen.queryByRole('menu')).toBeNull()
  const card = document.querySelector('.pv-info-card')
  expect(card?.textContent).toContain(name)

  fireEvent.keyDown(document, { key: 'Escape' })
  expect(document.querySelector('.pv-info-card')).toBeNull()
})

it('phím Menu (chuột phải không có tọa độ) thì menu mọc từ phần tử đang focus, không phải góc màn hình', () => {
  renderFrame(<WorkspacesPreviewView />)
  // Windows/Linux phát contextmenu với clientX/clientY = -1.
  fireEvent.contextMenu(cardByTitle('Marketing'), { clientX: -1, clientY: -1 })
  const menu = menuFor('Marketing')
  expect(menu.getAttribute('data-trigger')).toBe('anchor')
  expect(menu.style.left).not.toBe('-1px')
})

it('nút ⋯ neo menu vào nút, Esc đóng menu và trả focus về đúng nút vừa bấm', () => {
  renderFrame(<WorkspacesPreviewView />)
  const trigger = menuButtonOf('Acme Corp')
  trigger.focus()
  fireEvent.click(trigger)
  const menu = menuFor('Acme Corp')
  expect(menu.getAttribute('data-trigger')).toBe('anchor')

  // Roving focus: phần tử đầu tiên còn bật nhận focus ngay, ArrowDown nhảy giữa các item.
  const items = within(menu).getAllByRole('menuitem').filter(item => !item.hasAttribute('disabled'))
  expect(document.activeElement).toBe(items[0])
  fireEvent.keyDown(menu, { key: 'ArrowDown' })
  expect(document.activeElement).toBe(items[1])

  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('menu')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

it('menu đóng khi bấm ra ngoài hoặc khi trang cuộn (surface fixed sẽ treo lạc chỗ)', () => {
  renderFrame(<ProjectsPreviewView />)
  const trigger = menuButtonOf('Sales Analytics')
  fireEvent.click(trigger)
  expect(menuFor('Sales Analytics')).toBeDefined()

  // jsdom không phải bản nào cũng có PointerEvent → phát Event thô đúng type mà hook nghe.
  act(() => { document.dispatchEvent(new Event('pointerdown')) })
  expect(screen.queryByRole('menu')).toBeNull()

  fireEvent.click(trigger)
  act(() => { window.dispatchEvent(new Event('scroll')) })
  expect(screen.queryByRole('menu')).toBeNull()
})

it('thẻ project: cả một lẫn hai click đều đáp ở trang Project Overview, không còn đường tắt sang 3D', () => {
  renderFrame(<ProjectsPreviewView />)
  const card = cardByTitle('Customer 360')

  // 1 click = điều hướng tới Project Workspace Overview (khong con panel ke ben).
  fireEvent.click(card)
  expect(window.location.pathname).toBe('/processing/projects/prj-customer')
  expect(screen.queryByRole('complementary', { name: 'Chi tiết Customer 360' })).toBeNull()
  expect(universeNavigator).not.toHaveBeenCalled()

  // 2 click = VẪN trang Overview. Đặc tả UI-UX/projects bắt mọi lối "đi vào project" đi qua
  // trang này, nên chuột kép không được nhảy thẳng sang scene của T nữa; ai thật sự muốn sang
  // 3D thì bấm nút "Mở Dataset Universe 3D" nằm ngay trong trang Overview.
  fireEvent.doubleClick(card)
  expect(window.location.pathname).toBe('/processing/projects/prj-customer')
  expect(universeNavigator).not.toHaveBeenCalled()
})

it('bàn phím đi cùng một lối với chuột: Enter trên thẻ project = mở trang Project', () => {
  renderFrame(<ProjectsPreviewView />)
  const card = cardByTitle('Finance Data')
  fireEvent.keyDown(card, { key: 'Enter' })
  expect(window.location.pathname).toBe('/processing/projects/prj-finance')
  expect(universeNavigator).not.toHaveBeenCalled()
})

it('Home: bấm workspace xuống Workspaces kèm phạm vi; bấm dòng project mở trang Project Overview', () => {
  renderFrame(<HomePreviewView />)

  fireEvent.click(miniCardByTitle('Marketing'))
  // Yêu cầu: "ấn vào thì hiện số project gần đây nhất đồng thời thanh menu cũng đi xuống workspaces".
  expect(window.location.pathname).toBe('/management/workspaces/ws-marketing')
  expect(previewMockStore.getState().selection.workspaceId).toBe('ws-marketing')

  // Bảng Project sắp theo `updatedAt`, nên lấy đúng dòng đầu + tra ws/id từ store thay vì đóng đinh tên.
  const firstRow = document.querySelector<HTMLTableRowElement>('.home-table tbody tr')
  expect(firstRow).not.toBeNull()
  const rowName = firstRow!.querySelector('.row-name')!.textContent!.trim()
  const project = previewMockStore.getState().projects.find(item => item.name === rowName)
  expect(project).toBeTruthy()

  // 1 click = mở trang Project riêng (route mang ws + id project).
  fireEvent.click(firstRow!)
  expect(window.location.pathname).toBe(`/processing/projects/${project!.id}`)

  // Chuột kép trên DÒNG PROJECT không còn là đường tắt sang 3D: đặc tả UI-UX/projects bắt mọi
  // lối vào project đi qua trang Overview. Handler dblclick đã bỏ khỏi dòng nên spy phải im lặng.
  fireEvent.doubleClick(firstRow!)
  expect(universeNavigator).not.toHaveBeenCalled()

  // Bấm kép Workspace cùng đích đến với click đơn, không mở nhầm Project của phạm vi trước.
  fireEvent.doubleClick(miniCardByTitle('Marketing'))
  expect(window.location.pathname).toBe('/management/workspaces/ws-marketing')
  expect(universeNavigator).not.toHaveBeenCalled()
})

// Đổi tên workspace KHÔNG còn là một mục của ⋯: ảnh "a_detailed_high_fidelity_ui_screenshot_of_the_sam"
// vẽ ⋯ đúng ba mục, và tên + mô tả sửa trong modal "Thông tin Workspace". Test đi qua đúng lối
// vào đó để chặn tên trùng — quy tắc backend có partial unique index "hai workspace đang hoạt
// động không được trùng tên".
it('chuột phải → "Thông tin Workspace": chặn tên trùng, lưu thì đổi dữ liệu mẫu và Hoàn tác trả lại', async () => {
  renderFrame(<WorkspacesPreviewView />)
  fireEvent.contextMenu(cardByTitle('Acme Corp'), { clientX: 100, clientY: 100 })
  fireEvent.click(menuItem('Thông tin Workspace'))

  const dialog = screen.getByRole('dialog', { name: 'Thông tin Workspace' })
  const nameField = within(dialog).getByRole('textbox', { name: 'Tên Workspace' }) as HTMLInputElement
  const send = (): HTMLElement => within(dialog).getByRole('button', { name: 'Lưu thay đổi' })

  // Gửi nguyên trạng thái → chặn tại form, không im lặng ghi xuống store.
  fireEvent.click(send())
  expect(screen.getByRole('alert').textContent).toBe('Chưa có thay đổi nào để lưu.')

  // Trùng tên một workspace KHÁC, so không phân biệt hoa thường để 'finance' không lách qua.
  fireEvent.change(nameField, { target: { value: 'FINANCE' } })
  fireEvent.click(send())
  expect(screen.getByRole('alert').textContent).toContain('trùng tên')
  expect(previewMockStore.getState().workspaces.find(item => item.id === 'ws-acme')?.name).toBe('Acme Corp')

  fireEvent.change(nameField, { target: { value: 'Acme Holdings' } })
  expect(screen.queryByRole('alert')).toBeNull()
  fireEvent.click(send())

  expect(await screen.findByText('Đã cập nhật thông tin “Acme Holdings”')).toBeDefined()
  expect(cardByTitle('Acme Holdings')).toBeDefined()
  expect(previewMockStore.getState().workspaces.find(item => item.id === 'ws-acme')?.name).toBe('Acme Holdings')
  expect(screen.queryByRole('dialog', { name: 'Thông tin Workspace' })).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }))
  expect(cardByTitle('Acme Corp')).toBeDefined()
  expect(screen.getByText('Đã hoàn tác thao tác vừa rồi.')).toBeDefined()
})

it('Esc trong dialog là hủy, không ghi gì cả', () => {
  renderFrame(<WorkspacesPreviewView />)
  fireEvent.click(menuButtonOf('Acme Corp'))
  fireEvent.click(menuItem('Thông tin Workspace'))
  fireEvent.change(screen.getByRole('textbox', { name: 'Tên Workspace' }), { target: { value: 'Sẽ không lưu' } })
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: 'Thông tin Workspace' })).toBeNull()
  expect(cardByTitle('Acme Corp')).toBeDefined()
  expect(previewMockStore.getState().workspaces.find(item => item.id === 'ws-acme')?.name).toBe('Acme Corp')
})

it('xóa phải xác nhận, và sau xác nhận vẫn Hoàn tác được', async () => {
  renderFrame(<WorkspacesPreviewView />)
  // Bộ demo phải đủ dài để Home lướt được trong khung (xem preview-fixtures.ts) → đếm từ store
  // thay vì viết tay con số, để một lần thêm bản ghi không phải sửa lại ba test cùng lúc.
  const wsTotal = previewMockStore.getState().workspaces.length
  // Trang Workspaces chỉ vẽ tối đa 28 thẻ một trang, nên từ khi bộ demo vượt ngưỡng thì ĐẾM THẺ
  // không còn là bằng chứng "danh sách đổi": xóa một bản ghi ở trang 1 thì trang 1 vẫn kéo bản
  // kế tiếp lên đủ 28. Phải đếm trong store và xem ĐÚNG BẢN GHI còn nằm trong trang hay không.
  const pageSize = cardTitles().length
  const inStore = (name: string): boolean =>
    previewMockStore.getState().workspaces.some(item => item.name === name)
  const pagerInfo = (): string | undefined => document.querySelector('.pagination-info')?.textContent
  fireEvent.contextMenu(cardByTitle('Acme Corp'), { clientX: 100, clientY: 100 })
  fireEvent.click(menuItem('Xóa Workspace'))

  const dialog = screen.getByRole('alertdialog', { name: 'Gỡ “Acme Corp” khỏi danh sách mẫu?' })
  // Không phải mọi thao tác đều cần confirm; ở đây confirm là thật vì workspace kéo theo project.
  expect(dialog.textContent).toContain('12 project')
  fireEvent.click(screen.getByRole('button', { name: 'Giữ lại' }))
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(inStore('Acme Corp')).toBe(true)
  expect(cardTitles()).toContain('Acme Corp')

  fireEvent.contextMenu(cardByTitle('Acme Corp'), { clientX: 100, clientY: 100 })
  fireEvent.click(menuItem('Xóa Workspace'))
  fireEvent.click(screen.getByRole('button', { name: 'Gỡ khỏi danh sách' }))

  expect(await screen.findByText('Đã xóa Acme Corp khỏi danh sách mẫu')).toBeDefined()
  expect(inStore('Acme Corp')).toBe(false)
  expect(cardTitles()).not.toContain('Acme Corp')
  // Dòng phân trang báo tổng SAU bộ lọc → nó tụt theo là bằng chứng duy nhất còn lại rằng phép
  // xóa thật sự chạm vào danh sách (số thẻ trên trang thì không đổi vì trang 1 vẫn đầy).
  expect(pagerInfo()).toBe(`Hiển thị 1–${pageSize} của ${wsTotal - 1} Workspaces`)

  fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }))
  expect(inStore('Acme Corp')).toBe(true)
  expect(cardTitles()).toContain('Acme Corp')
  expect(pagerInfo()).toBe(`Hiển thị 1–${pageSize} của ${wsTotal} Workspaces`)
})

// "Lưu trữ Project" đã BỎ theo chỉ đạo chủ batch 03/11: trong frame này người dùng không còn
// tự bật/tắt trạng thái đó từ ⋯. `status` vẫn là field thật của bản ghi nên tab "Đã lưu trữ" vẫn
// đếm đúng — test chốt cả hai vế: menu không đổi theo trạng thái, còn số của tab thì có nguồn.
it('⋯ của project không còn mục lưu trữ: menu giống nhau dù bản ghi đang ở trạng thái nào', () => {
  renderFrame(<ProjectsPreviewView />)
  const archived = previewMockStore.getState().projects.filter(project => project.status === 'archived')
  // Lấy một bản ĐÃ lưu trữ đang hiện trên trang đang xem — 12 project của Acme / 9 mỗi trang nên
  // không phải bản nào cũng bấm được từ đây.
  const archivedOnScreen = archived.find(project => cardTitles().includes(project.name))
  expect(archivedOnScreen).toBeDefined()
  const items = (name: string): string[] => {
    fireEvent.contextMenu(cardByTitle(name), { clientX: 100, clientY: 100 })
    const list = within(menuFor(name)).getAllByRole('menuitem').map(item => item.textContent?.trim())
    fireEvent.keyDown(document, { key: 'Escape' })
    return list
  }
  const expected = ['Mở Project', 'Xem thông tin', 'Đổi tên', 'Xóa Project']
  expect(items('Sales Analytics')).toEqual(expected)
  // Bản ĐÃ lưu trữ cũng không được có lối ra ('Bỏ lưu trữ Project') — mục đó đã bị gỡ cùng chiều.
  expect(items(archivedOnScreen!.name)).toEqual(expected)

  // Tab vẫn đếm từ dữ liệu, không phải chữ viết tay.
  fireEvent.click(screen.getByRole('tab', { name: `Đã lưu trữ (${archived.length})` }))
  expect(cardTitles()).toContain(archivedOnScreen!.name)
  expect(within(cardByTitle(archivedOnScreen!.name)).queryByRole('button', { name: /lưu trữ/i })).toBeNull()
})

it('xóa project từ ⋯: phải xác nhận, danh sách và tab cùng đổi theo, Hoàn tác gọi lại bản ghi', async () => {
  renderFrame(<ProjectsPreviewView />)
  fireEvent.contextMenu(cardByTitle('Sales Analytics'), { clientX: 100, clientY: 100 })
  fireEvent.click(menuItem('Xóa Project'))

  const dialog = screen.getByRole('alertdialog', { name: 'Gỡ “Sales Analytics” khỏi danh sách mẫu?' })
  expect(dialog.textContent).toContain('chỉ gỡ bản ghi khỏi danh sách mẫu trong bộ nhớ tab')
  fireEvent.click(screen.getByRole('button', { name: 'Gỡ khỏi danh sách' }))

  expect(await screen.findByText('Đã xóa Sales Analytics khỏi danh sách mẫu')).toBeDefined()
  expect(screen.getByRole('tab', { name: 'Tất cả (11)' })).toBeDefined()
  expect(cardTitles()).not.toContain('Sales Analytics')

  fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }))
  expect(screen.getByRole('tab', { name: 'Tất cả (12)' })).toBeDefined()
  expect(cardTitles()).toContain('Sales Analytics')
})

// ⋯ của workspace = ĐÚNG BA mục ảnh "a_detailed_high_fidelity_ui_screenshot_of_the_sam" vẽ,
// theo nguyên tắc chủ batch chốt: menu không chứa mục "cho đủ bộ". 'Nhân bản' · 'Sao chép liên
// kết' · 'Đổi tên' · 'Mở Project' của workspace đều đã bị rút — so CẢ danh sách chứ không chỉ
// "có mặt", để một lần thêm lại âm thầm là test này đỏ.
it('⋯ của workspace đúng ba mục (ảnh vẽ gì lấy nấy) và "Quản lý thành viên" mở được từ THẺ', () => {
  renderFrame(<WorkspacesPreviewView />)
  fireEvent.contextMenu(cardByTitle('Acme Corp'), { clientX: 100, clientY: 100 })
  const menu = menuFor('Acme Corp')
  expect(within(menu).getAllByRole('menuitem').map(item => item.textContent?.trim())).toEqual([
    'Thông tin Workspace', 'Quản lý thành viên', 'Xóa Workspace',
  ])

  // Hai modal của workspace là surface CẤP PHIÊN chứ không phải state cục bộ của trang chi tiết,
  // vì chính menu của THẺ ở trang danh sách cũng mở ra chúng.
  fireEvent.click(menuItem('Quản lý thành viên'))
  expect(screen.queryByRole('menu')).toBeNull()
  const dialog = screen.getByRole('dialog', { name: 'Quản lý thành viên' })
  expect(within(dialog).getByText('Trong Workspace “Acme Corp”')).toBeDefined()
})

// Khung 2 + 3 của ảnh "DataVerse Workspace Creation with Email Suggestions", với MỘT điểm khác
// ảnh theo chỉ đạo chủ batch 03/11: ô thành viên CHỈ nhận email gõ tay, không liệt kê danh bạ
// gợi ý. Test đi hết một vòng: mở dialog → chặn dữ liệu lỗi → thêm hai email (Enter và + Thêm)
// → ghi thật vào store → màn hình thành công → "Tạo Workspace khác" xóa trắng form → "Xem
// Workspace" điều hướng tới đúng bản ghi vừa tạo.
it('"Tạo Workspace" mở dialog: chặn tên trống · trùng · chặn email lỗi, thêm thành viên rồi ghi thật', async () => {
  renderFrame(<WorkspacesPreviewView />)
  const wsTotal = previewMockStore.getState().workspaces.length
  const pageSize = cardTitles().length

  // Trước khi mở dialog thì trang chỉ có MỘT nút tên này (nút đầu trang), nên query không
  // mơ hồ; bên trong dialog phải giới hạn bằng within vì nút gửi cũng mang đúng tên đó.
  fireEvent.click(screen.getByRole('button', { name: 'Tạo Workspace' }))
  const dialog = screen.getByRole('dialog', { name: 'Tạo Workspace' })
  const nameField = within(dialog).getByRole('textbox', { name: /Tên Workspace/ }) as HTMLInputElement
  const memberField = within(dialog).getByRole('textbox', { name: 'Thành viên ban đầu (tùy chọn)' }) as HTMLInputElement
  // Nút gửi phải lấy lại mỗi lần bấm: form bị gỡ khỏi DOM khi màn thành công hiện ra (rồi mounted
  // lại khi "Tạo Workspace khác"), nên giữ một node sẽ bấm vào node đã detached.
  const send = (): HTMLElement => within(dialog).getByRole('button', { name: 'Tạo Workspace' })
  const add = (): HTMLElement => within(dialog).getByRole('button', { name: 'Thêm' })

  // Tên là ô duy nhất có dấu * (ảnh khung 2) → gửi form trống phải bị chặn tại dialog.
  fireEvent.click(send())
  expect(screen.getByRole('alert').textContent).toBe('Tên Workspace không được để trống.')
  expect(previewMockStore.getState().workspaces).toHaveLength(wsTotal)

  // Trùng tên chặn ngay trong form; so không phân biệt hoa thường để 'acme corp' không lách qua
  // được 'Acme Corp'.
  fireEvent.change(nameField, { target: { value: 'acme corp' } })
  fireEvent.click(send())
  expect(screen.getByRole('alert').textContent).toContain('trùng tên')

  fireEvent.change(nameField, { target: { value: 'Product Analytics' } })
  expect(screen.queryByRole('alert')).toBeNull()

  // KHÔNG còn ô tìm người có sẵn: cả hộp thành viên chỉ có MỘT ô nhập email + một nút Thêm,
  // không có danh sách ứng viên nào bên dưới (đúng điều chủ batch 03/11 đổi so với ảnh).
  expect(within(dialog).queryAllByRole('listbox')).toHaveLength(0)
  expect(dialog.querySelectorAll('.pv-suggest-row')).toHaveLength(0)

  // Gõ tên một người có thật trong danh bạ mẫu: không có gì để chọn, và ô nói rõ vì sao.
  fireEvent.change(memberField, { target: { value: 'quang' } })
  fireEvent.keyDown(memberField, { key: 'Enter' })
  expect(screen.getByRole('alert').textContent).toContain('không phải một địa chỉ email hợp lệ')
  expect(within(dialog).queryByText('Trần Quang Huy')).toBeNull()

  // Enter thêm đúng địa chỉ đang gõ rồi dọn ô nhập để gõ tiếp người kế.
  fireEvent.change(memberField, { target: { value: 'tran.quang.huy@acmecorp.com' } })
  fireEvent.keyDown(memberField, { key: 'Enter' })
  expect(within(dialog).getByText('tran.quang.huy@acmecorp.com')).toBeDefined()
  // Ô thành viên được xóa sau khi thêm, còn tên workspace thì giữ — người dùng đang gõ dở.
  expect(memberField.value).toBe('')
  expect(nameField.value).toBe('Product Analytics')

  // Email lạ vẫn thêm được qua đúng nút "+ Thêm" mà ảnh khung 2 vẽ; email gõ tay phải GIỮ
  // NGUYÊN, không bị suy lại thành @acmecorp.com.
  fireEvent.change(memberField, { target: { value: 'bs.tung@company.com' } })
  fireEvent.click(add())
  expect(within(dialog).getByText('Bs Tung')).toBeDefined()
  expect(within(dialog).getByText('bs.tung@company.com')).toBeDefined()
  expect(document.querySelectorAll('.pv-chip')).toHaveLength(2)

  // Cùng một email thêm hai lần là một lỗi người dùng thật hay gặp → chặn và nói rõ.
  fireEvent.change(memberField, { target: { value: 'BS.TUNG@COMPANY.COM' } })
  fireEvent.click(add())
  expect(screen.getByRole('alert').textContent).toContain('đã có trong danh sách thành viên')
  fireEvent.change(memberField, { target: { value: '' } })

  fireEvent.click(send())

  expect(await screen.findByRole('heading', { name: 'Tạo Workspace thành công!' })).toBeDefined()
  // Hai thành viên + chủ sở hữu = 3, tính từ bản ghi thật chứ không phải chữ viết tay.
  expect(await screen.findByText('Đã tạo workspace “Product Analytics” với 3 thành viên (gồm chủ sở hữu)')).toBeDefined()
  expect(within(dialog).getByText(/với 3 thành viên \(gồm chủ sở hữu\)/)).toBeDefined()
  const created = previewMockStore.getState().workspaces.find(item => item.name === 'Product Analytics')
  expect(created).toBeDefined()
  expect(created?.members).toBe(3)
  expect(created?.owner.id).toBe('u-anh')
  expect(created?.projects).toBe(0)
  // Email gõ tay phải sống sót tới roster: Person mang `email` riêng thay vì bị suy lại từ tên
  // thành @acmecorp.com — nói sai email của người dùng vẫn là sai, kể cả trong bản mẫu.
  expect(created?.memberPreview.map(person => person.email).filter(Boolean)).toEqual([
    'tran.quang.huy@acmecorp.com', 'bs.tung@company.com',
  ])
  expect(previewMockStore.getState().workspaces).toHaveLength(wsTotal + 1)
  expect(document.querySelector('.pagination-info')?.textContent).toBe(`Hiển thị 1–${pageSize} của ${wsTotal + 1} Workspaces`)

  // "Tạo Workspace khác" = xóa trắng form để tạo liên tiếp, KHÔNG được nuốt bản ghi đã tạo.
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo Workspace khác' }))
  expect(screen.queryByRole('heading', { name: 'Tạo Workspace thành công!' })).toBeNull()
  // Màn thành công đã GỠ form khỏi DOM, nên phải lấy lại ô nhập: giữ biến cũ là giữ một node đã
  // detached — nó không nghe React nữa nên giá trị chỉ là ảnh chụp lúc còn mounted.
  const nameAgain = within(dialog).getByRole('textbox', { name: /Tên Workspace/ }) as HTMLInputElement
  expect(nameAgain.value).toBe('')
  expect(document.querySelectorAll('.pv-chip')).toHaveLength(0)
  expect(previewMockStore.getState().workspaces).toHaveLength(wsTotal + 1)

  // Bản thứ hai chứng minh id không trùng và "Xem Workspace" mở đúng bản ghi vừa tạo.
  fireEvent.change(nameAgain, { target: { value: 'Data Ops' } })
  fireEvent.click(send())
  await screen.findByRole('heading', { name: 'Tạo Workspace thành công!' })
  const second = previewMockStore.getState().workspaces.find(item => item.name === 'Data Ops')
  expect(second).toBeDefined()
  expect(second?.id).not.toBe(created?.id)
  // Không chọn ai → roster chỉ có chủ sở hữu, nên con số trên màn hình phải là 1.
  expect(within(dialog).getByText(/với 1 thành viên \(gồm chủ sở hữu\)/)).toBeDefined()

  fireEvent.click(within(dialog).getByRole('button', { name: /Xem Workspace/ }))
  expect(window.location.pathname).toBe(`/management/workspaces/${second?.id}`)
  expect(previewMockStore.getState().selection.workspaceId).toBe(second?.id)
  // Mở từ dialog cũng ghi mốc "truy cập gần nhất" như bấm thẻ thường — ô sắp xếp mặc định dựa
  // vào đúng mốc này, nên nó không được là bản sao của "Cập nhật gần nhất".
  expect(second?.accessedAt).toBe('vừa xong')
  // Điều hướng xong thì dialog phải ĐÓNG: `creating` là state của danh sách, để nó bật thì quay
  // về trang Workspaces là modal tự mở lại và scrim chặn hết tương tác của trang.
  expect(screen.queryByRole('dialog', { name: 'Tạo Workspace' })).toBeNull()
})

// "Sao chép liên kết" (đặc tả home dòng 5 bỏ ở ⋯ của project) và "Nhân bản" đã rút khỏi CẢ HAI
// menu, nên trong frame không còn lối vào nào cho chúng — vì vậy code clipboard cũng bị xóa theo,
// không để một cơ chế không ai bấm tới. Test khóa bằng phủ định để hai mục "cho đủ bộ" không quay
// lại, và kiểm ⋯ trên HEADER trang chi tiết mở đúng menu của THẺ: một descriptor, ba lối vào.
it('không còn "Sao chép liên kết" · "Nhân bản" ở bất kỳ menu nào; ⋯ header detail = ⋯ của thẻ', () => {
  renderFrame(<ProjectsPreviewView />)
  fireEvent.contextMenu(cardByTitle('Customer 360'), { clientX: 100, clientY: 100 })
  expect(menuFor('Customer 360').textContent).not.toContain('Sao chép liên kết')

  cleanup()
  renderFrame(<WorkspacesPreviewView />)
  fireEvent.contextMenu(cardByTitle('Acme Corp'), { clientX: 100, clientY: 100 })
  const fromCard = within(menuFor('Acme Corp')).getAllByRole('menuitem').map(item => item.textContent?.trim())
  expect(fromCard).not.toContain('Nhân bản')
  expect(fromCard).not.toContain('Sao chép liên kết')

  cleanup()
  renderFrame(<WorkspacesPreviewView workspaceId="ws-acme" />)
  fireEvent.click(screen.getByRole('button', { name: 'Thao tác với Acme Corp' }))
  expect(within(menuFor('Acme Corp')).getAllByRole('menuitem').map(item => item.textContent?.trim()))
    .toEqual(fromCard)
})

it('chuông: ô hiện bản chưa đọc; bấm một dòng mở chi tiết NGAY TRONG Ô, không đổi trang, không tự đọc', () => {
  renderFrame(<HomePreviewView />)
  fireEvent.click(screen.getByRole('button', { name: 'Thông báo · 5 chưa đọc' }))
  const popover = screen.getByRole('dialog', { name: 'Thông báo' })
  // Dropdown nhanh liệt kê bản CHƯA ĐỌC (đặc tả Shell dòng 5), fixture có đúng 5 bản chưa đọc.
  expect(within(popover).getAllByRole('listitem')).toHaveLength(5)

  fireEvent.click(within(popover).getByRole('button', { name: /^Có 12 vấn đề chất lượng dữ liệu/ }))
  // Mọi thứ chạy trong ô: không ghi hash, popover vẫn mở, khung shell đứng yên phía sau.
  expect(window.location.hash).toBe('')
  expect(screen.getByRole('dialog', { name: 'Thông báo' })).toBeDefined()
  // Màn chi tiết (Design Board 1.3) nằm trong chính ô đó, có đủ hai nút hành động.
  expect(within(popover).getByRole('button', { name: /^Mở Project/ })).toBeDefined()
  expect(within(popover).getByRole('button', { name: 'Đánh dấu đã đọc' })).toBeDefined()
  // Vào tới nơi bản ghi vẫn còn chưa đọc — "Đánh dấu đã đọc" là nút riêng, không phải tác dụng phụ của việc mở.
  expect(previewMockStore.getState().notifications.find(item => item.id === 'nt-02')!.unread).toBe(true)

  // Nút back ở chi tiết đưa về đúng nơi vừa đi (dropdown), không phải nhảy sang danh sách.
  fireEvent.click(within(popover).getByRole('button', { name: 'Chi tiết thông báo' }))
  expect(within(popover).getByRole('button', { name: 'Xem tất cả thông báo' })).toBeDefined()
})

it('chuông: "Mở Project" là một chuyến ĐI — popover khép lại, kể cả khi hash đứng nguyên', () => {
  // Đường thường: đang ở Home, bấm "Mở Project" → hash đổi → popover PHẢI khép. Surface để
  // nguyên thì người dùng thấy hai lớp nội dung chồng nhau và không biết mình đang ở đâu.
  renderFrame(<HomePreviewView />)
  fireEvent.click(screen.getByRole('button', { name: 'Thông báo · 5 chưa đọc' }))
  const popover = screen.getByRole('dialog', { name: 'Thông báo' })
  fireEvent.click(within(popover).getByRole('button', { name: /^Có 12 vấn đề chất lượng dữ liệu/ }))
  fireEvent.click(within(popover).getByRole('button', { name: /^Mở Project/ }))
  expect(window.location.pathname).toBe('/processing/projects/prj-customer')
  expect(screen.queryByRole('dialog', { name: 'Thông báo' })).toBeNull()

  // Đường KHÔNG đổi hash (lỗi thật đã bắt được khi duyệt browser): đã đứng trên đúng project
  // đó thì openSection không ghi hash, hashchange không fire → tín hiệu 'preview-navigate' là
  // thứ duy nhất khép popover. Set hash TRƯỚC khi render để listener chưa kịp nghe hashchange.
  cleanup()
  window.history.replaceState(null, '', '/processing/projects/prj-customer')
  renderFrame(<HomePreviewView />)
  fireEvent.click(screen.getByRole('button', { name: 'Thông báo · 5 chưa đọc' }))
  const again = screen.getByRole('dialog', { name: 'Thông báo' })
  fireEvent.click(within(again).getByRole('button', { name: /^Có 12 vấn đề chất lượng dữ liệu/ }))
  fireEvent.click(within(again).getByRole('button', { name: /^Mở Project/ }))
  expect(window.location.pathname).toBe('/processing/projects/prj-customer')
  expect(screen.queryByRole('dialog', { name: 'Thông báo' })).toBeNull()
})

it('chuông: "Xem tất cả" mở danh sách NGAY TRONG Ô (tab + tìm + phân trang), không ra cả trang', () => {
  renderFrame(<HomePreviewView />)
  fireEvent.click(screen.getByRole('button', { name: 'Thông báo · 5 chưa đọc' }))
  const popover = screen.getByRole('dialog', { name: 'Thông báo' })
  fireEvent.click(within(popover).getByRole('button', { name: 'Xem tất cả thông báo' }))

  // Vẫn là cùng một ô, hash không đổi — đây là điểm đảo trục so với hành vi cũ (điều hướng sang '#/preview/notifications').
  expect(window.location.hash).toBe('')
  expect(within(popover).getByRole('tab', { name: 'Tất cả (16)' })).toBeDefined()
  expect(within(popover).getByRole('tab', { name: 'Chưa đọc (5)' })).toBeDefined()
  expect(within(popover).getByRole('searchbox', { name: 'Tìm kiếm thông báo' })).toBeDefined()
  // 16 bản, 10 dòng/trang → trang đầu 10, trang hai 6 (Design Board 1.2 "Hiển thị 1-10 / 36").
  expect(within(popover).getAllByRole('listitem')).toHaveLength(10)
  // Chủ batch 03/11: bỏ dòng "Hiển thị 1–10 của 16 thông báo" TRONG Ô. Số dòng đếm vẫn còn ở
  // trang hộp thư đầy đủ (nơi người dùng đổi được số dòng mỗi trang) — xem preview-notifications.
  expect(within(popover).queryByText(/^Hiển thị \d+–\d+ của \d+ thông báo$/)).toBeNull()
  expect(within(popover).getByRole('button', { name: '1' }).getAttribute('aria-current')).toBe('page')
  fireEvent.click(within(popover).getByRole('button', { name: 'Trang sau' }))
  expect(within(popover).getAllByRole('listitem')).toHaveLength(6)

  // Chọn một dòng trong ô thì thanh thao tác hàng loạt bật lên — vẫn không rời khỏi popover.
  fireEvent.click(within(popover).getByRole('button', { name: 'Trang trước' }))
  fireEvent.click(within(popover).getByRole('checkbox', { name: 'Chọn: Phân tích dữ liệu hoàn tất' }))
  expect(within(popover).getByText('Đã chọn 1')).toBeDefined()
  expect(within(popover).getByRole('button', { name: 'Đánh dấu đã đọc' }).hasAttribute('disabled')).toBe(false)
})

it('chuông: "Đánh dấu tất cả đã đọc" trong dropdown là mutation thật có Hoàn tác', async () => {
  renderFrame(<HomePreviewView />)
  fireEvent.click(screen.getByRole('button', { name: 'Thông báo · 5 chưa đọc' }))
  fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }))
  // Đọc hết thì chuông mất badge, nhãn về 'Thông báo'; nút trong dropdown chuyển sang tắt
  // và phải còn lý do nhìn thấy (bất biến shared-ui).
  expect(screen.getByRole('button', { name: 'Thông báo' })).toBeDefined()
  const readAll = screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' })
  expect(readAll.hasAttribute('disabled')).toBe(true)
  everyDisabledButtonHasVisibleReason()

  expect(await screen.findByText('Đã đánh dấu 5 thông báo là đã đọc')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }))
  expect(screen.getByRole('button', { name: 'Thông báo · 5 chưa đọc' })).toBeDefined()
})

it('menu tài khoản: Hồ sơ/Cài đặt ĐIỀU HƯỚNG sang Settings, không còn mục tắt nào', () => {
  renderFrame(<WorkspacesPreviewView />)
  fireEvent.click(screen.getByRole('button', { name: 'Tài khoản Nguyễn Minh Anh' }))
  const popover = screen.getByRole('dialog', { name: 'Tài khoản Nguyễn Minh Anh' })
  // "Đăng xuất" đã RA KHỎI menu (chủ batch 03/11): frame này không có phiên đăng nhập thật nào để
  // kết thúc nên nó là mục bấm không làm gì — nguyên tắc mới là bỏ hẳn thay vì tắt + giải thích.
  // Vì vậy bất biến ở đây mạnh hơn các trang khác: KHÔNG có nút tắt nào trong popover.
  expect(within(popover).getAllByRole('button').filter(button => button.hasAttribute('disabled'))).toHaveLength(0)
  expect(within(popover).queryByRole('button', { name: /Đăng xuất/ })).toBeNull()
  everyDisabledButtonHasVisibleReason()

  // Hai mục đầu nay điều hướng (khác chuông/báo cáo chạy "trong ô") → hash trỏ đúng mục con Accounts.
  fireEvent.click(within(popover).getByRole('button', { name: /Hồ sơ cá nhân/ }))
  expect(window.location.pathname).toBe('/management/settings/profile')
  expect(screen.queryByRole('dialog', { name: /Tài khoản/ })).toBeNull()
})

it('menu tài khoản (4.1): ĐÚNG HAI hàng điều hướng được, "Cài đặt tài khoản" về tổng quan Settings', () => {
  renderFrame(<WorkspacesPreviewView />)
  fireEvent.click(screen.getByRole('button', { name: 'Tài khoản Nguyễn Minh Anh' }))
  const popover = screen.getByRole('dialog', { name: 'Tài khoản Nguyễn Minh Anh' })
  // Ảnh 4.1 vẽ ba hàng; "Đăng xuất" đã bỏ theo chỉ đạo 03/11 và tiện ích dev "Khôi phục dữ liệu
  // mẫu" đã bỏ để khớp ảnh (reset = F5). So CẢ danh sách hàng.
  expect(within(popover).queryAllByRole('button', { name: /Khôi phục dữ liệu mẫu/ })).toHaveLength(0)
  // Chủ batch yêu cầu BỎ chữ "Settings" đứng cạnh hai mục điều hướng: ảnh 4.1 vẽ nó như một
  // nhãn nhóm, nhưng nó lặp lại tên một trang bên cạnh hai nhãn việc làm còn đích đến thì đã
  // hiện rõ khi bấm.
  const rows = within(within(popover).getByRole('list')).getAllByRole('button')
  expect(rows.map(button => button.textContent?.trim())).toEqual(['Hồ sơ cá nhân', 'Cài đặt tài khoản'])
  expect(rows.every(button => !button.textContent?.includes('Settings'))).toBe(true)
  fireEvent.click(within(popover).getByRole('button', { name: /Cài đặt tài khoản/ }))
  // KHÔNG nhảy vào Bảo mật: hàng này đại diện cả NHÓM ba mục (Bảo mật · Đăng nhập & phiên ·
  // Thông báo), nên đích là route trần — nơi người dùng tự chọn mục. Chủ batch 03/11 hỏi đúng
  // câu "tại sao bấm đâu cũng ra Bảo mật"; hai hàng menu khác nhau nay có hai đích khác nhau.
  expect(window.location.pathname).toBe('/management/settings')
})

// Regression cho lỗi đo thật trên browser: pv-materialize mở surface bằng scale(.97), nên
// getBoundingClientRect trả kích thước NHỎ HƠN 3% ngay khung hình đầu — popover 'end' vì thế
// neo lệch mép phải (380px → lệch 11px, tràn ra ngoài viewport). sizeOf nay dùng offsetWidth
// (kích thước layout, không ăn transform). jsdom cho cả hai đường đo = 0 nên phải đặt số đo giả
// phân biệt được hai đường: layout 380, trigger sát mép phải 747.
it('popover align=end neo mép phải theo số đo layout, không theo rect đang scale của pv-materialize', () => {
  const restore = (key: 'offsetWidth' | 'offsetHeight', descriptor: PropertyDescriptor | undefined): void => {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor)
    else Reflect.deleteProperty(HTMLElement.prototype, key)
  }
  const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
  const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
  try {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 380 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 453 })
    renderFrame(<WorkspacesPreviewView />)
    const trigger = screen.getByRole('button', { name: 'Tài khoản Nguyễn Minh Anh' })
    trigger.getBoundingClientRect = () => ({ left: 674, top: 21, right: 747, bottom: 53, x: 674, y: 21, width: 73, height: 32, toJSON: () => ({}) }) as DOMRect
    fireEvent.click(trigger)

    const popover = screen.getByRole('dialog', { name: 'Tài khoản Nguyễn Minh Anh' })
    // 747 - 380 = 367. Bản cũ đo bằng rect: trên browser thật rect đang scale nên lệch 11px,
    // còn trong jsdom rect = 0 → left ra 747 (popover vượt hẳn mép phải trigger) — cả hai
    // đường đều fail assertion này, tức nó giữ được đúng cái lỗi đã đo thật.
    expect(popover.style.left).toBe('367px')
    expect(popover.getAttribute('data-side')).toBe('bottom')
    cleanup()
  } finally {
    restore('offsetWidth', originalWidth)
    restore('offsetHeight', originalHeight)
  }
})

it('combobox phạm vi và chuột phải cùng sửa một selection (một hành vi, mọi lối vào)', () => {
  renderFrame(<HomePreviewView />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Workspace' }))
  fireEvent.click(screen.getByRole('option', { name: /^Finance/ }))
  expect(previewMockStore.getState().selection.workspaceId).toBe('ws-finance')
  // Home không mang workspaceId trong URL, nên đổi phạm vi ở đây KHÔNG được đá người dùng
  // sang trang Dự án — họ vẫn đứng ở trang họ đang đọc, chỉ có phạm vi là đổi.
  expect(window.location.hash).toBe('')
  expect(screen.getByRole('button', { name: 'Thao tác với Finance' })).toBeDefined()

  // Đổi phạm vi thì menu của thẻ trong phạm vi mới phải mở ra, không phải thẻ cũ.
  fireEvent.click(screen.getByRole('button', { name: 'Thao tác với Finance' }))
  expect(menuFor('Finance')).toBeDefined()
})
