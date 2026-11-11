import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { SettingsPreviewView } from '../../views/preview/settings-2d.view'
import { settingsSections } from '../../views/preview/preview-data'
import { previewMockStore } from '../../services/preview/preview-mock.service'
import type { SettingsSectionId } from '../../types/preview/preview.types'
import { disabledButtons, renderFrame, resetPreviewStore } from './preview-test-kit'

// Màn Settings (Design Board nhóm 04, đặc tả Shell dòng 9) = NHÁNH ACCOUNTS thật, khác chuông
// + báo cáo chạy "trong ô": nó có hash riêng '#/preview/settings/<mục>'. Ảnh TÁCH HAI MÀN:
// 4.2 "Hồ sơ cá nhân" (màn riêng, không sidebar) và 4.3–4.5 "Cài đặt tài khoản" (sidebar phụ
// ĐÚNG BA mục: Bảo mật · Đăng nhập & phiên · Thông báo). Mọi ghi ở đây là mutation optimistic
// trên dữ liệu mẫu (chưa có Users/Auth API) nên mỗi test phải reset store.

const open = (section: SettingsSectionId | null = null): void => { renderFrame(<SettingsPreviewView section={section} />) }

beforeEach(() => { resetPreviewStore(); window.localStorage.clear(); window.location.hash = '' })
afterEach(() => { cleanup(); window.location.hash = '' })

// '#/preview/settings' TRẦN không còn tự mở Bảo mật: hằng số `defaultSection = 'security'` khiến
// "Settings" trên sidebar và "Cài đặt tài khoản" trong menu cá nhân cùng rơi về MỘT đích, nên
// người dùng thấy "bấm đâu cũng ra Bảo mật". Route trần nay là màn tổng quan.
it('Settings chỉ hiện Accounts và System, chưa mở các mục con', () => {
  open(null)
  expect(screen.getByRole('heading', { level: 1, name: 'Cài đặt' })).toBeDefined()
  expect(screen.getByRole('heading', { level: 2, name: 'Chuyên mục' })).toBeDefined()
  expect(screen.getByText('Chọn một mục ở thanh bên để bắt đầu.')).toBeDefined()
  // Không màn nào được vẽ "hộ": ba mục thật đều phải im lặng cho tới khi người dùng chọn.
  expect(screen.queryByRole('heading', { level: 2, name: 'Bảo mật tài khoản' })).toBeNull()
  expect(screen.queryByRole('heading', { level: 2, name: 'Thông tin cá nhân' })).toBeNull()
  expect(screen.queryAllByRole('switch')).toHaveLength(0)

  expect(settingsSections).toHaveLength(2)
  const nav = screen.getByRole('navigation', { name: 'Chuyên mục Cài đặt' })
  expect(within(nav).getAllByRole('button').map(item => item.textContent))
    .toEqual(['Accounts', 'System'])
  expect(within(nav).getByRole('button', { name: 'Accounts' }).getAttribute('aria-expanded')).toBe('false')
  expect(within(nav).getByRole('button', { name: 'System' }).getAttribute('aria-expanded')).toBe('false')
  const chosen = within(nav).getAllByRole('button').filter(item => item.getAttribute('aria-current') === 'page')
  expect(chosen).toHaveLength(0)

  // Ảnh 4.4: "Đăng xuất tất cả các phiên khác" CHỈ ở màn Phiên.
  expect(screen.queryByRole('button', { name: 'Đăng xuất tất cả các phiên khác' })).toBeNull()
})

it('ấn nhóm "Cài đặt tài khoản" trên rail CHỈ gập/mở — không đổi hash, không chọn màn hộ ai', () => {
  open(null)
  const nav = screen.getByRole('navigation', { name: 'Chuyên mục Cài đặt' })
  fireEvent.click(within(nav).getByRole('button', { name: 'Accounts' }))
  const group = within(nav).getByRole('button', { name: 'Cài đặt tài khoản' })
  // Trước đây nút này điều hướng thẳng '#/preview/settings/security'. Một nhóm ba mục mà bấm là
  // nhảy vào một mục thì mục đó luôn là "màn" người dùng thấy, dù họ chỉ muốn xem có gì bên
  // trong → nay hash phải đứng yên ('' vì test render trực tiếp, không qua route).
  expect(group.getAttribute('aria-expanded')).toBe('false')
  expect(within(nav).queryByRole('button', { name: 'Bảo mật' })).toBeNull()
  expect(window.location.hash).toBe('')
  fireEvent.click(group)
  expect(group.getAttribute('aria-expanded')).toBe('true')
  expect(within(nav).getByRole('button', { name: 'Bảo mật' })).toBeDefined()
  expect(window.location.hash).toBe('')
  fireEvent.click(group)
  expect(within(nav).queryByRole('button', { name: 'Bảo mật' })).toBeNull()
})

it('chính lá "Bảo mật" trong rail mới là lối vào #/preview/settings/security', () => {
  open(null)
  const nav = screen.getByRole('navigation', { name: 'Chuyên mục Cài đặt' })
  fireEvent.click(within(nav).getByRole('button', { name: 'Accounts' }))
  fireEvent.click(within(nav).getByRole('button', { name: 'Cài đặt tài khoản' }))
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Chuyên mục Cài đặt' }))
    .getByRole('button', { name: 'Bảo mật' }))
  expect(window.location.pathname).toBe('/management/settings/security')

  // Route đã mang mục con → rail giữ nguyên sáu nút, lá "Bảo mật" đang đứng (aria-current) và
  // đầu màn đổi thành "Cài đặt tài khoản".
  cleanup()
  open('security')
  const accountNav = screen.getByRole('navigation', { name: 'Chuyên mục Cài đặt' })
  expect(within(accountNav).getAllByRole('button').map(item => item.textContent))
    .toEqual(['Accounts', 'Hồ sơ cá nhân', 'Cài đặt tài khoản', ...settingsSections.map(item => item.label), 'System'])
  expect(within(accountNav).getByRole('button', { name: 'Bảo mật' }).getAttribute('aria-current')).toBe('page')
  expect(screen.getByRole('heading', { level: 1, name: 'Cài đặt tài khoản' })).toBeDefined()
})

it('rail Accounts gập/mở: ấn "Accounts" ẩn hai nút con, ấn lại hiện lại (đặc tả dòng 9)', () => {
  open('security')
  const nav = screen.getByRole('navigation', { name: 'Chuyên mục Cài đặt' })
  const toggle = within(nav).getByRole('button', { name: 'Accounts' })
  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(within(nav).queryByRole('button', { name: 'Hồ sơ cá nhân' })).toBeNull()
  expect(within(nav).queryByRole('button', { name: 'Cài đặt tài khoản' })).toBeNull()
  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  expect(within(nav).getByRole('button', { name: 'Cài đặt tài khoản' })).toBeDefined()
})

it('Hồ sơ (4.2) hiện trong rail Accounts: đầu "Hồ sơ cá nhân", email + chức vụ khóa', () => {
  open('profile')
  expect(screen.getByRole('heading', { level: 1, name: 'Hồ sơ cá nhân' })).toBeDefined()
  // Đặc tả dòng 9: Hồ sơ nằm trong nhánh "Accounts" → rail hiện trên cả màn Hồ sơ.
  expect(screen.getByRole('navigation', { name: 'Chuyên mục Cài đặt' })).toBeDefined()
  expect(screen.getByRole('heading', { level: 2, name: 'Thông tin cá nhân' })).toBeDefined()
  expect((screen.getByRole('textbox', { name: 'Họ và tên' }) as HTMLInputElement).value).toBe('Nguyễn Minh Anh')
  // Email + Chức vụ CHỈ ĐỌC theo đặc tả dòng 9 → readOnly + aria-readonly, không tự sửa được.
  expect(screen.getByRole('textbox', { name: 'Email (không đổi được)' }).hasAttribute('readonly')).toBe(true)
  expect(screen.getByRole('textbox', { name: 'Chức vụ (không đổi được)' }).getAttribute('aria-readonly')).toBe('true')
  // Đơn vị SỬA ĐƯỢC (đặc tả dòng 9 liệt kê "sửa ... đơn vị ..." dù ảnh 4.2 vẽ ổ khóa).
  expect(screen.getByRole('textbox', { name: 'Đơn vị' }).hasAttribute('readonly')).toBe(false)
})

it('lưu hồ sơ là mutation có Hoàn tác; thiếu tên thì form báo lỗi ngay chứ không tắt nút', async () => {
  open('profile')
  const name = screen.getByRole('textbox', { name: 'Họ và tên' })

  // Nút "Lưu" luôn bật; bấm với tên trống → .form-error nói trong form (không có control chết im lặng).
  fireEvent.change(name, { target: { value: '   ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  expect(screen.getByRole('alert').textContent).toBe('Họ và tên không được để trống.')

  fireEvent.change(name, { target: { value: 'Nguyễn Minh Anh Test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  // Optimistic: khối nhận dạng (đọc từ store) đổi ngay, chưa chờ 160ms.
  expect(document.querySelector('.profile-id strong')!.textContent).toBe('Nguyễn Minh Anh Test')
  // Store cũng đã mang giá trị mới (nguồn duy nhất), không chỉ state cục bộ của input.
  expect(previewMockStore.getState().profile.name).toBe('Nguyễn Minh Anh Test')

  fireEvent.click(await screen.findByRole('button', { name: 'Hoàn tác' }))
  expect(await screen.findByText('Đã hoàn tác thao tác vừa rồi.')).toBeDefined()
  expect(previewMockStore.getState().profile.name).toBe('Nguyễn Minh Anh')
  // Draft phải đồng bộ lại theo store sau Hoàn tác: ô nhập không còn giữ giá trị đã bị rút lại.
  expect((screen.getByRole('textbox', { name: 'Họ và tên' }) as HTMLInputElement).value).toBe('Nguyễn Minh Anh')
})

it('"Hủy" ở màn Hồ sơ đưa về trang chính (đặc tả dòng 9: "hủy thì về trang chính")', () => {
  open('profile')
  fireEvent.change(screen.getByRole('textbox', { name: 'Họ và tên' }), { target: { value: 'Tên chưa lưu' } })
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
  // Đặc tả dòng 9 nói rõ Hủy → về Home (không chỉ xóa nháp tại chỗ).
  expect(window.location.pathname).toBe('/management')
})

it('Bảo mật: bỏ 2FA theo đặc tả, chỉ còn "Đổi mật khẩu" — validate trong form rồi báo toast', async () => {
  open('security')
  // Đặc tả dòng 9: "xác thực 2 bước trong ảnh bỏ nha" → không có control 2FA nào trên màn.
  expect(screen.queryByText(/2FA|xác thực hai bước/i)).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: /Đổi mật khẩu/ }))
  // type="password" KHÔNG phải role "textbox" theo aria-query → tra cứu theo nhãn.
  expect(screen.getByLabelText('Mật khẩu hiện tại')).toBeDefined()

  // Nút gửi luôn bật; bấm khi trống → lỗi nói ngay, form KHÔNG gửi.
  fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))
  expect(screen.getByRole('alert').textContent).toContain('Cần điền đủ')

  fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'matkhucuu' } })
  fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'matkhuoimoi123' } })
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: 'matkhuoimoi123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))
  // Chưa có API Auth → chỉ toast xác thực biểu mẫu, nói rõ không ghi lại ở đâu.
  expect(await screen.findByText(/Đã đổi mật khẩu/)).toBeDefined()
})

it('Phiên: đếm theo danh sách, đăng xuất phiên khác có Hoàn tác, không tự cắt phiên hiện tại', async () => {
  open('sessions')
  expect(screen.getByRole('heading', { level: 2, name: 'Các phiên đang hoạt động (2)' })).toBeDefined()
  expect(screen.getByText('Phiên hiện tại')).toBeDefined()

  const mobile = screen.getByRole('button', { name: 'Tùy chọn phiên iPhone · Safari' })
  fireEvent.click(mobile)
  fireEvent.click(within(screen.getByRole('menu', { name: 'Tùy chọn phiên iPhone' }))
    .getByRole('menuitem', { name: 'Đăng xuất phiên này' }))
  expect(previewMockStore.getState().sessions.map(item => item.id)).toEqual(['ses-current'])

  expect(await screen.findByRole('heading', { level: 2, name: 'Các phiên đang hoạt động (1)' })).toBeDefined()
  // Toast thành công tới sau delay 160ms (KHÔNG đồng bộ với re-render của heading) → phải
  // findByRole (poll tới khi toast xuất hiện) chứ không getByRole.
  fireEvent.click(await screen.findByRole('button', { name: 'Hoàn tác' }))
  expect(await screen.findByRole('heading', { level: 2, name: 'Các phiên đang hoạt động (2)' })).toBeDefined()

  // Ảnh 4.4: phiên HIỆN TẠI KHÔNG có nút ⋮ nào (đang xem preview mà tự đăng xuất là tự cắt lối
  // vào; đăng xuất thật thuộc trang auth của bạn T). "Phiên hiện tại" chỉ là chữ inline.
  expect(screen.queryByRole('button', { name: 'Tùy chọn phiên Windows · Chrome' })).toBeNull()
})

it('"Đăng xuất tất cả các phiên khác" giữ đúng phiên hiện tại và có Hoàn tác', async () => {
  open('sessions')
  fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất tất cả các phiên khác' }))
  expect(await screen.findByText('Đã đăng xuất 1 phiên khác (giữ phiên hiện tại)')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }))
  expect(await screen.findByRole('heading', { level: 2, name: 'Các phiên đang hoạt động (2)' })).toBeDefined()
})

it('"Đăng xuất tất cả" khi chỉ còn phiên hiện tại là no-op: notify nói thẳng, không Hoàn tác giả', async () => {
  // Vào thẳng store (không qua hook) để chỉ còn phiên hiện tại mà KHÔNG sinh toast Hoàn tác
  // của lần revoke trước — nếu không, nút Hoàn tác cũ còn hiển thị và làm nhiễu assertion.
  previewMockStore.revokeSession('ses-mobile')
  open('sessions')
  expect(screen.getByRole('heading', { level: 2, name: 'Các phiên đang hoạt động (1)' })).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất tất cả các phiên khác' }))
  expect(await screen.findByText('Chỉ còn phiên hiện tại — không có phiên nào khác để đăng xuất.')).toBeDefined()
  // No-op → không có Hoàn tác (hoàn tác một lần không đổi gì rồi báo "Đã hoàn tác" là nói dối).
  expect(screen.queryByRole('button', { name: 'Hoàn tác' })).toBeNull()
})

it('Tùy chọn thông báo: mỗi dòng là một role="switch", gạt là mutation optimistic có Hoàn tác', async () => {
  open('notifications')
  expect(screen.getByRole('heading', { level: 2, name: 'Tùy chọn thông báo' })).toBeDefined()
  const switches = screen.getAllByRole('switch')
  expect(switches).toHaveLength(4)
  expect(switches[0].getAttribute('aria-checked')).toBe('true')

  fireEvent.click(switches[0])
  // Optimistic: state lật tức thì (commit trước delay), toast tới sau 160ms.
  expect(screen.getAllByRole('switch')[0].getAttribute('aria-checked')).toBe('false')
  expect(previewMockStore.getState().notificationPrefs.system).toBe(false)

  expect(await screen.findByText('Đã tắt tùy chọn thông báo')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }))
  expect(previewMockStore.getState().notificationPrefs.system).toBe(true)
})

// Rail TỪNG có ô tìm kiếm chụp theo topbar; topbar đã bỏ ô đó (yêu cầu 03/11) và Settings chỉ có
// bảy mục trong hai cấp nên gập/mở trên rail là đủ. Test chốt: không còn ô tìm nào trên màn, và
// mỗi lá vẫn ghi đúng hash của nó.
it('rail không có ô tìm kiếm; gập nhóm rồi mở lại, bấm một mục con ghi hash "#/preview/settings/<mục>"', () => {
  open('security')
  expect(screen.queryByRole('searchbox')).toBeNull()
  expect(screen.queryByRole('textbox', { name: /tìm/i })).toBeNull()

  const nav = screen.getByRole('navigation', { name: 'Chuyên mục Cài đặt' })
  const group = within(nav).getByRole('button', { name: 'Cài đặt tài khoản' })
  expect(group.getAttribute('aria-expanded')).toBe('true')

  fireEvent.click(group)
  expect(group.getAttribute('aria-expanded')).toBe('false')
  expect(within(nav).queryByRole('button', { name: 'Đăng nhập & phiên' })).toBeNull()

  fireEvent.click(group)
  expect(within(nav).getByRole('button', { name: 'Đăng nhập & phiên' })).toBeDefined()
  fireEvent.click(within(nav).getByRole('button', { name: 'Đăng nhập & phiên' }))
  expect(window.location.pathname).toBe('/management/settings/sessions')
})

it('màn Settings không có nút chết im lặng (mọi control đều tương tác được)', () => {
  open('sessions')
  // Khác các trang khác: Settings không mượn control tắt + note; mọi thao tác đểu chạy trên
  // dữ liệu mẫu → bất biến "nút tắt phải có lý do" ở đây là "KHÔNG có nút tắt nào".
  expect(disabledButtons()).toHaveLength(0)
})
