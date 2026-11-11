import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { WorkbenchEntry } from '../../app/router/workbench-routes'
import { SettingsPreviewView } from '../../views/preview/settings-2d.view'
import { previewColorKey } from '../../hooks/preview/use-preview-color-scheme'
import { renderFrame, resetPreviewStore } from './preview-test-kit'

let systemDark = false
let media: EventTarget
const frameTheme = () => document.querySelector('[data-preview="2d"]')?.getAttribute('data-theme')
const choose = (name: string) => fireEvent.click(screen.getByRole('radio', { name }))
const changeSystem = (dark: boolean) => act(() => {
  systemDark = dark
  media.dispatchEvent(new Event('change'))
})

beforeAll(async () => {
  await Promise.all([import('../../views/application/application-frame'), import('../../views/preview/preview-entry'), import('../../views/processing/processing.view')])
})

beforeEach(() => {
  resetPreviewStore()
  window.localStorage.clear()
  window.history.replaceState({}, '', '/#/preview/settings/color')
  systemDark = false
  media = new EventTarget()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() { return query === '(prefers-color-scheme: dark)' && systemDark },
    media: query,
    addEventListener: media.addEventListener.bind(media),
    removeEventListener: media.removeEventListener.bind(media),
  }))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.localStorage.clear()
  window.history.replaceState({}, '', '/')
})

it('Dark là mặc định; Light đổi cả frame và được nhớ sau khi tải lại', () => {
  renderFrame(<SettingsPreviewView section="color" />)
  expect(frameTheme()).toBe('dark')
  expect((screen.getByRole('radio', { name: 'Dark' }) as HTMLInputElement).checked).toBe(true)
  choose('Light')
  expect(frameTheme()).toBe('light')
  expect(screen.getByRole('button', { name: 'Chế độ màu' }).getAttribute('title')).toBe('Chế độ màu: Sáng')
  expect(window.localStorage.getItem(previewColorKey)).toBe('light')
  cleanup()
  renderFrame(<SettingsPreviewView section="color" />)
  expect(frameTheme()).toBe('light')
  expect((screen.getByRole('radio', { name: 'Light' }) as HTMLInputElement).checked).toBe(true)
})

it('System theo thiết bị ngay khi chọn, cập nhật trực tiếp và vẫn theo thiết bị sau khi tải lại', () => {
  renderFrame(<SettingsPreviewView section="color" />)
  choose('System')
  expect(frameTheme()).toBe('light')
  changeSystem(true)
  expect(frameTheme()).toBe('dark')
  expect(window.localStorage.getItem(previewColorKey)).toBe('system')
  cleanup()
  renderFrame(<SettingsPreviewView section="color" />)
  expect((screen.getByRole('radio', { name: 'System' }) as HTMLInputElement).checked).toBe(true)
  expect(frameTheme()).toBe('dark')
  changeSystem(false)
  expect(frameTheme()).toBe('light')
  choose('Dark')
  changeSystem(true)
  changeSystem(false)
  expect(frameTheme()).toBe('dark')
  choose('Light')
  changeSystem(true)
  expect(frameTheme()).toBe('light')
})

it('giá trị lưu không hợp lệ trở về Dark; đổi màu vẫn hoạt động khi storage bị chặn', () => {
  window.localStorage.setItem(previewColorKey, 'invalid')
  renderFrame(<SettingsPreviewView section="color" />)
  expect(frameTheme()).toBe('dark')
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
  choose('Light')
  expect(frameTheme()).toBe('light')
})

it('storage bị chặn lúc mở trang vẫn dùng Dark, không làm hỏng Settings', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked') })
  renderFrame(<SettingsPreviewView section="color" />)
  expect(frameTheme()).toBe('dark')
  choose('System')
  expect(frameTheme()).toBe('light')
})

it('lựa chọn từ tab khác đồng bộ vào trang đang mở, xóa lựa chọn trở về mặc định', () => {
  renderFrame(<SettingsPreviewView section="color" />)
  act(() => {
    window.localStorage.setItem(previewColorKey, 'light')
    window.dispatchEvent(new StorageEvent('storage', { key: previewColorKey }))
  })
  expect(frameTheme()).toBe('light')
  act(() => {
    window.localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
  })
  expect(frameTheme()).toBe('dark')
})

it('đường dẫn Color mở đúng System; về Settings đóng các nhánh rồi mở lại theo từng cấp', async () => {
  render(<WorkbenchEntry />)
  expect(await screen.findByRole('heading', { level: 1, name: 'System' })).toBeDefined()
  choose('Light')
  const nav = () => within(screen.getByRole('navigation', { name: 'Chuyên mục Cài đặt' }))
  expect(nav().getByRole('button', { name: 'System' }).getAttribute('aria-expanded')).toBe('true')
  expect(nav().getByRole('button', { name: 'Accounts' }).getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  await waitFor(() => expect(nav().getAllByRole('button').map(button => button.textContent)).toEqual(['Accounts', 'System']))
  expect(frameTheme()).toBe('light')
  fireEvent.click(nav().getByRole('button', { name: 'System' }))
  fireEvent.click(nav().getByRole('button', { name: 'Color' }))
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Light' })).toBeDefined())
  expect(window.location.pathname).toBe('/management/settings/color')
  fireEvent.click(screen.getByRole('button', { name: 'Home' }))
  await waitFor(() => expect(document.querySelector('.preview-root')?.getAttribute('data-section')).toBe('home'))
  expect(frameTheme()).toBe('light')
})

it('Processing keeps only the shared header and preserves light mode across areas and reload', async () => {
  window.history.replaceState({}, '', '/processing')
  const mounted = render(<WorkbenchEntry />)
  await screen.findByRole('heading', { name: /Khám phá.*vũ trụ dữ liệu/ })
  expect(document.querySelector('.preview-sidebar')).toBeNull()
  expect(document.querySelector('.sidebar-toggle')).toBeNull()
  expect(document.querySelector('.preview-topbar .topbar-chips')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Chế độ màu' }))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Chế độ màu' })).getByRole('radio', { name: 'Sáng' }))
  expect(frameTheme()).toBe('light')
  fireEvent.keyDown(screen.getByRole('radio', { name: 'Sáng' }), { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: 'Chế độ màu' })).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Chế độ màu' }))
  fireEvent.click(screen.getByRole('button', { name: 'Tài khoản Nguyễn Minh Anh' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cài đặt tài khoản' }))
  await waitFor(() => expect(document.querySelector('.preview-root')?.getAttribute('data-section')).toBe('settings'))
  expect(frameTheme()).toBe('light')
  fireEvent.click(screen.getByRole('link', { name: 'Xử lý dữ liệu' }))
  await screen.findByRole('heading', { name: /Khám phá.*vũ trụ dữ liệu/ })
  expect(frameTheme()).toBe('light')
  expect(document.querySelectorAll('[data-preview="2d"]')).toHaveLength(1)
  mounted.unmount()
  render(<WorkbenchEntry />)
  await screen.findByRole('heading', { name: /Khám phá.*vũ trụ dữ liệu/ })
  expect(frameTheme()).toBe('light')
})

it('header System mode follows the device and Dark mode stops following it', async () => {
  window.history.replaceState({}, '', '/processing')
  render(<WorkbenchEntry />)
  await screen.findByRole('heading', { name: /Khám phá.*vũ trụ dữ liệu/ })
  fireEvent.click(screen.getByRole('button', { name: 'Chế độ màu' }))
  choose('Theo hệ thống')
  expect(frameTheme()).toBe('light')
  changeSystem(true)
  expect(frameTheme()).toBe('dark')
  changeSystem(false)
  expect(frameTheme()).toBe('light')
  choose('Tối')
  changeSystem(true)
  changeSystem(false)
  expect(frameTheme()).toBe('dark')
  expect(window.localStorage.getItem(previewColorKey)).toBe('dark')
})

it('keeps theme during area navigation even when storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
  window.history.replaceState({}, '', '/processing')
  render(<WorkbenchEntry />)
  await screen.findByRole('heading', { name: /Khám phá.*vũ trụ dữ liệu/ })
  fireEvent.click(screen.getByRole('button', { name: 'Chế độ màu' }))
  choose('Sáng')
  fireEvent.click(screen.getByRole('button', { name: 'Tài khoản Nguyễn Minh Anh' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cài đặt tài khoản' }))
  await waitFor(() => expect(document.querySelector('.preview-root')?.getAttribute('data-section')).toBe('settings'))
  expect(frameTheme()).toBe('light')
  expect(screen.queryByRole('dialog', { name: 'Chế độ màu' })).toBeNull()
})

it('reuses notification/report/account popovers on Processing and account navigation closes them', async () => {
  window.history.replaceState({}, '', '/processing')
  render(<WorkbenchEntry />)
  await screen.findByRole('heading', { name: /Khám phá.*vũ trụ dữ liệu/ })
  fireEvent.click(screen.getByRole('button', { name: 'Thông báo · 5 chưa đọc' }))
  expect(screen.getByRole('dialog', { name: 'Thông báo' })).toBeDefined()
  fireEvent.keyDown(document, { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: 'Báo cáo vấn đề' }))
  expect(screen.getByRole('dialog', { name: 'Báo cáo vấn đề' })).toBeDefined()
  fireEvent.keyDown(document, { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: 'Tài khoản Nguyễn Minh Anh' }))
  fireEvent.click(screen.getByRole('button', { name: 'Hồ sơ cá nhân' }))
  await waitFor(() => expect(window.location.pathname).toBe('/management/settings/profile'))
  expect(screen.queryByRole('dialog', { name: 'Tài khoản Nguyễn Minh Anh' })).toBeNull()
})
