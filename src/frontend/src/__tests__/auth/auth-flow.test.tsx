import 'fake-indexeddb/auto'
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { AxiosError, AxiosHeaders } from 'axios'
import type { AxiosAdapter } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { AppProviders } from '../../app/app-providers'
import { createAppRuntime } from '../../app/app-runtime'
import { createQueryClient, clearSessionQueries } from '../../lib/query-client'
import { createSessionStorage } from '../../lib/session-storage'
import { UploadDraftDatabase } from '../../repositories/datasets/upload-draft.database'
import { validReturnTarget } from '../../app/router/return-target'

const disposers: Array<() => Promise<void>> = []
afterEach(async () => {
  cleanup()
  for (const dispose of disposers.splice(0)) await dispose()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const token = (exp = Math.floor(Date.now() / 1000) + 60) => `e30.${btoa(JSON.stringify({ sub: 'a', exp })).replace(/=/g, '')}.c2ln`
const loginData = () => ({ access_token: token(), refresh_token: 'test-refresh', expires_in: 900,
  user: { id: 'a', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'analyst' } })
const profile = { _id: 'a', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'analyst', status: 'active' }
const LocationProbe = () => {
  const location = useLocation()
  return <><output data-testid="location">{location.pathname}{location.search}{location.hash}</output><output data-testid="location-state">{JSON.stringify(location.state)}</output></>
}

const mount = async (options: { path?: string; storedExp?: number; rejectLogin?: boolean; pendingLogin?: Promise<unknown>; pendingRefresh?: Promise<unknown>; meFailure?: boolean } = {}) => {
  const records = new Map<string, string>()
  const storage = createSessionStorage({ getStorage: () => ({
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => { records.set(key, value) },
    removeItem: key => { records.delete(key) },
  }) })
  if (options.storedExp !== undefined) storage.write({ schemaVersion: 1, accountId: 'a', accessToken: token(options.storedExp), refreshToken: 'test-refresh' })
  const database = new UploadDraftDatabase(`react-test-${crypto.randomUUID()}`)
  const queryClient = createQueryClient()
  const adapter = vi.fn<AxiosAdapter>(async config => {
    let data: unknown
    if (config.url?.endsWith('/auth/login')) {
      if (options.rejectLogin) throw new AxiosError('failure', undefined, config, undefined, { config, status: 401, statusText: 'Unauthorized', headers: new AxiosHeaders(), data: { success: false, error: { message: 'Email hoặc mật khẩu không chính xác' } } })
      data = options.pendingLogin ? await options.pendingLogin : loginData()
    } else if (config.url?.endsWith('/users/me')) {
      if (options.meFailure) throw new AxiosError('network', 'ERR_NETWORK')
      data = profile
    } else if (config.url?.endsWith('/health')) data = { status: 'ok', services: { mongodb_atlas: { status: 'connected' } } }
    else if (config.url?.endsWith('/auth/refresh')) data = options.pendingRefresh ? await options.pendingRefresh : { access_token: token(), expires_in: 900 }
    else data = { message: 'Đăng xuất thành công' }
    return { config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { success: true, data } }
  })
  const runtime = createAppRuntime({ storage, database, client: { baseUrl: 'http://localhost:3000/api/v1', adapter }, clearSessionCache: () => clearSessionQueries(queryClient) })
  disposers.push(async () => { runtime.dispose(); queryClient.clear(); await database.delete() })
  const rendered = await act(async () => render(<StrictMode><AppProviders runtime={runtime} queryClient={queryClient}>
    <MemoryRouter initialEntries={[options.path ?? '/auth/login']}><App /><LocationProbe /></MemoryRouter>
  </AppProviders></StrictMode>))
  return { runtime, storage, adapter, queryClient, rendered }
}
const fillLogin = () => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: ' x ' } })
}
const submitLogin = async () => {
  fillLogin()
  await act(async () => { fireEvent.submit(screen.getByRole('form', { name: 'Đăng nhập' })) })
}
const requests = (adapter: ReturnType<typeof vi.fn<AxiosAdapter>>, path: string) => adapter.mock.calls.filter(([config]) => config.url?.endsWith(path))

describe('login, routes and session cleanup', () => {
  it('submits actual login service, preserves password and opens shell without me', async () => {
    const s = await mount()
    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }))
    expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).type).toBe('text')
    await submitLogin()
    expect(screen.getByTestId('location').textContent).toBe('/workspaces')
    expect(screen.getByRole('heading', { name: 'Xin chào, Test User' })).toBeDefined()
    expect(requests(s.adapter, '/users/me')).toHaveLength(0)
    expect(JSON.parse(requests(s.adapter, '/auth/login')[0][0].data).password).toBe(' x ')
  })

  it('preserves a valid private return target then clears it and user/cache on logout', async () => {
    const s = await mount({ path: '/workspaces?view=local#top' })
    expect(screen.getByTestId('location').textContent).toBe('/auth/login')
    await submitLogin()
    expect(screen.getByTestId('location').textContent).toBe('/workspaces?view=local#top')
    s.queryClient.setQueryData(['users', 'a', 'me'], { private: true })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Đăng xuất/ })) })
    expect(screen.getByTestId('location').textContent).toBe('/auth/login')
    expect(screen.getByTestId('location-state').textContent).toBe('null')
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).value).toBe('')
    expect(s.storage.read()).toEqual({ status: 'empty' })
    expect(s.queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('keeps invalid input out of transport and shows login rejection without renewal', async () => {
    const s = await mount({ rejectLogin: true })
    await act(async () => { fireEvent.submit(screen.getByRole('form', { name: 'Đăng nhập' })) })
    expect(s.adapter).not.toHaveBeenCalled()
    await submitLogin()
    expect(screen.getByRole('alert').textContent).toContain('không chính xác')
    expect(screen.getByTestId('location').textContent).toBe('/auth/login')
    expect(requests(s.adapter, '/health')).toHaveLength(0)
    expect(requests(s.adapter, '/auth/refresh')).toHaveLength(0)
  })

  it('disables duplicate submission while login is pending', async () => {
    let resolve!: (value: unknown) => void
    const pendingLogin = new Promise<unknown>(yes => { resolve = yes })
    const s = await mount({ pendingLogin })
    fillLogin()
    await act(async () => { fireEvent.submit(screen.getByRole('form', { name: 'Đăng nhập' })) })
    expect((screen.getByRole('button', { name: /Đang đăng nhập/ }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { fireEvent.submit(screen.getByRole('form', { name: 'Đăng nhập' })) })
    expect(requests(s.adapter, '/auth/login')).toHaveLength(1)
    await act(async () => { resolve(loginData()) })
  })

  it('bootstraps under StrictMode once and redirects public login to private shell', async () => {
    const s = await mount({ storedExp: Math.floor(Date.now() / 1000) + 60 })
    expect(requests(s.adapter, '/users/me')).toHaveLength(1)
    expect(screen.getByTestId('location').textContent).toBe('/workspaces')
    expect(s.runtime.coordinator.draftAccess.read()?.accountId).toBe('a')
  })

  it('renders a limited shell on outage without inventing profile or workspace list', async () => {
    await mount({ storedExp: Math.floor(Date.now() / 1000) + 60, meFailure: true })
    expect(screen.getByRole('heading', { name: 'Kết nối đang gián đoạn' })).toBeDefined()
    expect(screen.queryByText('test@example.com')).toBeNull()
    expect(screen.getByText(/thao tác trực tuyến đang bị khóa/)).toBeDefined()
  })

  it('shows a real not-found page for unknown routes', async () => {
    await mount({ path: '/not-a-route' })
    expect(screen.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeDefined()
  })

  it.each(['https://evil.invalid', '//evil.invalid', '/auth/login', '/unknown', '/\\evil.invalid', ' /workspaces'])('rejects unsafe return target %s', value => {
    expect(validReturnTarget(value)).toBe('/workspaces')
  })
})

describe('provider timer/focus and consent dialog', () => {
  it('Hủy on an already expired restored session returns to a clean login', async () => {
    const s = await mount({ path: '/workspaces?old=1', storedExp: Math.floor(Date.now() / 1000) - 1 })
    expect(screen.getByRole('dialog')).toBeDefined()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Hủy' })) })
    expect(screen.getByTestId('location').textContent).toBe('/auth/login')
    expect(screen.getByTestId('location-state').textContent).toBe('null')
    expect(requests(s.adapter, '/auth/refresh')).toHaveLength(0)
    expect(s.storage.read()).toEqual({ status: 'empty' })
  })

  it('expires on timer, traps focus, ignores backdrop and Escape declines without refresh', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date('2026-10-28T10:00:00Z'))
    const s = await mount({ path: '/workspaces?old=1', storedExp: Date.now() / 1000 + 1 })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    const dialog = screen.getByRole('dialog', { name: 'Bạn muốn tiếp tục?' })
    const cancel = within(dialog).getByRole('button', { name: 'Hủy' })
    const accept = within(dialog).getByRole('button', { name: 'Tiếp tục phiên' })
    expect(document.activeElement).toBe(cancel)
    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(accept)
    fireEvent.keyDown(accept, { key: 'Tab' })
    expect(document.activeElement).toBe(cancel)
    fireEvent.click(screen.getByTestId('renewal-backdrop'))
    expect(screen.getByRole('dialog')).toBeDefined()
    await act(async () => { fireEvent.keyDown(dialog, { key: 'Escape' }) })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe('/auth/login')
    expect(screen.getByTestId('location-state').textContent).toBe('null')
    expect(requests(s.adapter, '/auth/refresh')).toHaveLength(0)
    expect(s.storage.read()).toEqual({ status: 'empty' })
  })

  it('focus and visibility detect a sleeping tab, with one health and one refresh after accept', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date('2026-10-28T10:00:00Z'))
    let resolve!: (value: unknown) => void
    const pendingRefresh = new Promise<unknown>(yes => { resolve = yes })
    const s = await mount({ path: '/workspaces?view=current', storedExp: Date.now() / 1000 + 1, pendingRefresh })
    vi.setSystemTime(Date.now() + 2000)
    await act(async () => { fireEvent.focus(window); fireEvent(document, new Event('visibilitychange')); fireEvent(window, new Event('pageshow')) })
    expect(requests(s.adapter, '/health')).toHaveLength(1)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục phiên' })) })
    const dialog = screen.getByRole('dialog')
    expect((within(dialog).getByRole('button', { name: 'Hủy' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(requests(s.adapter, '/auth/refresh')).toHaveLength(1)
    await act(async () => { resolve({ access_token: token(), expires_in: 900 }) })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe('/workspaces?view=current')
    expect(requests(s.adapter, '/users/me')).toHaveLength(2)
  })

  it('rearms long timers instead of overflowing and disposes listeners/timers on unmount', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date('2026-10-28T10:00:00Z'))
    const exp = (Date.now() + 2_147_484_647) / 1000
    const s = await mount({ storedExp: exp })
    await act(async () => { await vi.advanceTimersByTimeAsync(2_147_483_647) })
    expect(requests(s.adapter, '/health')).toHaveLength(0)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(screen.getByRole('dialog')).toBeDefined()
    await act(async () => { s.rendered.unmount(); await Promise.resolve() })
    const calls = s.adapter.mock.calls.length
    fireEvent.focus(window)
    expect(s.adapter).toHaveBeenCalledTimes(calls)
    expect(s.runtime.coordinator.draftAccess.read()).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('checks expiry on visible transition but not while the document is hidden', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date('2026-10-28T10:00:00Z'))
    const s = await mount({ storedExp: Date.now() / 1000 + 1 })
    vi.setSystemTime(Date.now() + 2000)
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await act(async () => { fireEvent(document, new Event('visibilitychange')) })
    expect(requests(s.adapter, '/health')).toHaveLength(0)
    visibility.mockReturnValue('visible')
    await act(async () => { fireEvent(document, new Event('visibilitychange')) })
    expect(requests(s.adapter, '/health')).toHaveLength(1)
    expect(screen.getByRole('dialog')).toBeDefined()
  })
})
