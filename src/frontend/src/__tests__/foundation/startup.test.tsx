import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { MemoryRouter } from 'react-router'
import { AppProviders } from '../../app/app-providers'
import { createQueryClient } from '../../lib/query-client'
import { ApiError } from '../../lib/api-error'

const { authGlassStage } = vi.hoisted(() => ({
  authGlassStage: vi.fn<(props: { onSceneStatus: (status: 'ready' | 'failed') => void }) => null>(() => null),
}))
vi.mock('../../components/graphics/auth-glass/auth-glass.scene', () => ({ AuthGlassStage: authGlassStage }))

afterEach(() => {
  cleanup()
  authGlassStage.mockClear()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function renderLogin() {
  vi.stubEnv('VITE_API_BASE_URL', undefined)
  return render(<AppProviders queryClient={createQueryClient()} runtime={null} configurationError={new ApiError({ kind: 'config', message: 'Missing config' })}>
    <MemoryRouter initialEntries={['/auth/login']}><App /></MemoryRouter>
  </AppProviders>)
}

it('keeps login visible with a clear error and disabled submission when configuration is missing', () => {
  renderLogin()
  expect(screen.getByRole('heading', { name: 'Chào mừng trở lại' }).textContent).toBe('Chào mừng trở lại')
  expect(screen.getByRole('alert').textContent).toContain('chưa được cấu hình')
  expect((screen.getByRole('button', { name: 'Đăng nhập' }) as HTMLButtonElement).disabled).toBe(true)
})

it('keeps the desktop form hidden until the 3D stage is ready and restores it if the scene fails', async () => {
  vi.stubGlobal('WebGL2RenderingContext', class {})
  renderLogin()

  expect(screen.getByRole('status').textContent).toContain('Đang tải giao diện 3D')
  expect(screen.queryByRole('form', { name: 'Đăng nhập' })).toBeNull()
  await waitFor(() => expect(authGlassStage).toHaveBeenCalled())
  const [{ onSceneStatus }] = authGlassStage.mock.lastCall!
  act(() => onSceneStatus('ready'))
  expect(screen.getByRole('form', { name: 'Đăng nhập' })).toBeTruthy()
  expect(screen.queryByText('Đang tải giao diện 3D…')).toBeNull()

  act(() => onSceneStatus('failed'))
  expect(screen.getByRole('form', { name: 'Đăng nhập' })).toBeTruthy()
  expect(document.querySelector('.auth-glass-login-stage')).toBeNull()
})

it('uses the 2D form immediately on narrow screens even when WebGL is available', () => {
  vi.stubGlobal('WebGL2RenderingContext', class {})
  vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: true }))
  renderLogin()

  expect(screen.getByRole('form', { name: 'Đăng nhập' })).toBeTruthy()
  expect(document.querySelector('.auth-glass-login-stage')).toBeNull()
  expect(authGlassStage).not.toHaveBeenCalled()
})

it('falls back to 2D when the 3D stage takes too long', () => {
  vi.useFakeTimers()
  vi.stubGlobal('WebGL2RenderingContext', class {})
  renderLogin()

  expect(screen.queryByRole('form', { name: 'Đăng nhập' })).toBeNull()
  act(() => vi.advanceTimersByTime(10_000))
  expect(screen.getByRole('form', { name: 'Đăng nhập' })).toBeTruthy()
  expect(document.querySelector('.auth-glass-login-stage')).toBeNull()
})
