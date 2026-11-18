import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../../hooks/auth/auth-context'
import type { AuthContextValue } from '../../types/auth/auth-context.types'
import { LoginView } from '../../views/auth/login/login.view'

// Keep the login lifecycle real; replace only the WebGL renderer boundary.
vi.mock('../../components/graphics/auth-glass/auth-glass.scene', () => ({
  AuthGlassStage: ({ onSceneStatus }: { onSceneStatus: (status: 'ready' | 'failed') => void }) =>
    <div aria-label="Test renderer">
      <button onClick={() => onSceneStatus('ready')}>Renderer ready</button>
      <button onClick={() => onSceneStatus('failed')}>Renderer failed</button>
    </div>,
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('WebGL2RenderingContext', class {})
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

async function mount() {
  const value: AuthContextValue = {
    snapshot: { generation: 1, phase: 'anonymous', accountId: null, expiresAtMs: null, user: null, sessionEnded: false, error: null, cleanupError: null },
    configurationError: null,
    signIn: vi.fn(() => Promise.resolve()),
    signOut: () => Promise.resolve({ serverRevoked: true, revokeError: null, cleanupError: null }),
    confirmRenewal: () => Promise.resolve(),
  }
  let view!: ReturnType<typeof render>
  await act(() => {
    view = render(<AuthContext.Provider value={value}><MemoryRouter><LoginView /></MemoryRouter></AuthContext.Provider>)
    return Promise.resolve()
  })
  return { ...view, signIn: value.signIn }
}

it('reveals a usable login form at the scene deadline, not before it', async () => {
  const view = await mount()
  expect(screen.queryByRole('form', { name: 'Đăng nhập' })).toBeNull()
  await act(() => vi.advanceTimersByTime(9999))
  expect(screen.queryByRole('form', { name: 'Đăng nhập' })).toBeNull()
  await act(() => vi.advanceTimersByTime(1))
  expect(screen.getByRole('form', { name: 'Đăng nhập' })).toBeDefined()
  expect(screen.queryByLabelText('Test renderer')).toBeNull()
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'learner@example.test' } })
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'example-password' } })
  await act(() => {
    fireEvent.submit(screen.getByRole('form', { name: 'Đăng nhập' }))
    return Promise.resolve()
  })
  expect(view.signIn).toHaveBeenCalledWith({ email: 'learner@example.test', password: 'example-password' })
})

it('keeps a ready renderer mounted after the original deadline', async () => {
  await mount()
  fireEvent.click(screen.getByRole('button', { name: 'Renderer ready', hidden: true }))
  expect(screen.getByRole('form', { name: 'Đăng nhập' })).toBeDefined()
  await act(() => vi.advanceTimersByTime(10000))
  expect(screen.getByLabelText('Test renderer')).toBeDefined()
})

it('reveals the form immediately when the renderer reports a failure', async () => {
  await mount()
  fireEvent.click(screen.getByRole('button', { name: 'Renderer failed', hidden: true }))
  expect(screen.getByRole('form', { name: 'Đăng nhập' })).toBeDefined()
  expect(screen.queryByLabelText('Test renderer')).toBeNull()
})

it('does not wait for a renderer when WebGL is unavailable', async () => {
  vi.stubGlobal('WebGL2RenderingContext', undefined)
  await mount()
  expect(screen.getByRole('form', { name: 'Đăng nhập' })).toBeDefined()
  expect(screen.queryByLabelText('Test renderer')).toBeNull()
})

it('cancels the pending scene deadline on unmount', async () => {
  const view = await mount()
  expect(vi.getTimerCount()).toBe(1)
  view.unmount()
  expect(vi.getTimerCount()).toBe(0)
})
