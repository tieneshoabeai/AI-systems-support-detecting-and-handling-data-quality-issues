import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../../hooks/auth/auth-context'
import { usePreviewStore } from '../../hooks/preview/use-preview-store'
import { createSessionStorage } from '../../lib/session-storage'
import { ManagementDataProvider } from '../../views/application/management-data-provider'
import type { AuthContextValue } from '../../types/auth/auth-context.types'
import type { SessionSnapshot } from '../../types/auth/session-coordinator.types'
import type { ApiRequestOptions } from '../../types/api/api.types'

// Only the transport is replaced; provider, session storage and API store are real.
const transport = vi.hoisted(() => ({
  request: vi.fn<(options: ApiRequestOptions) => Promise<unknown>>(),
  token: undefined as (() => string | null) | undefined,
  demo: false,
}))
vi.mock('../../lib/axios-client', () => ({
  createAxiosClient: (options: { readToken: () => string | null }) => {
    transport.token = options.readToken
    return { request: transport.request }
  },
}))
vi.mock('../../mocks/shopping-trends/demo-mode', () => ({ isShoppingDemo: () => transport.demo }))

const base = { generation: 1, sessionEnded: false, error: null, cleanupError: null }
const authenticated: SessionSnapshot = {
  ...base, phase: 'authenticated', accountId: 'u1', expiresAtMs: 4_000_000_000_000,
  user: { source: 'login', value: { id: 'u1', email: 'user@example.test', role: 'analyst' } },
}
const token = (suffix: string, accountId = 'u1') => `e30.${btoa(JSON.stringify({ sub: accountId, exp: 4_000_000_000 })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}.${suffix}`
const persist = (suffix: string, accountId = 'u1') => createSessionStorage().write({
  schemaVersion: 1, accountId, accessToken: token(suffix, accountId), refreshToken: 'test-refresh',
})
function Probe() {
  const state = usePreviewStore()
  return <output data-testid="source">{state.source === 'api' ? `api:${state.workspaces.length}` : 'fixture'}</output>
}
function tree(snapshot: SessionSnapshot = authenticated) {
  const value: AuthContextValue = {
    snapshot, configurationError: null,
    signIn: () => Promise.resolve(), confirmRenewal: () => Promise.resolve(),
    signOut: () => Promise.resolve({ serverRevoked: true, revokeError: null, cleanupError: null }),
  }
  return <AuthContext.Provider value={value}><ManagementDataProvider><Probe /></ManagementDataProvider></AuthContext.Provider>
}
const response = (r: ApiRequestOptions): Promise<unknown> => Promise.resolve().then(() => {
  if (r.path === '/workspaces' || r.path === '/projects') return { items: [], total: 0 }
  if (r.path === '/users/me') return { firstName: 'Test', lastName: 'User', email: 'user@example.test', role: 'analyst', notificationsEnabled: true }
  if (r.path === '/notifications' || r.path === '/issues') return { items: [], meta: { hasMore: false, nextCursor: null } }
  if (r.path === '/notifications/unread-count') return { unreadCount: 0 }
  throw new Error(`Unexpected request: ${r.path}`)
})
beforeEach(() => {
  transport.demo = false
  transport.token = undefined
  transport.request.mockReset().mockImplementation(response)
  window.sessionStorage.clear()
  persist('first')
})
afterEach(() => { cleanup(); window.sessionStorage.clear() })

it('waits for API data and exposes the real store without fixture records', async () => {
  render(tree())
  expect(screen.getByRole('status').textContent).toContain('Đang tải')
  expect(screen.queryByTestId('source')).toBeNull()
  await waitFor(() => expect(screen.getByTestId('source').textContent).toBe('api:0'))
  expect(transport.request.mock.calls.map(([r]) => r.path)).toEqual(['/workspaces', '/projects', '/users/me', '/notifications', '/issues', '/notifications/unread-count'])
})

it('shows server errors without fixtures and retries only on user request', async () => {
  transport.request.mockRejectedValueOnce(new Error('Forbidden'))
  render(tree())
  expect((await screen.findByRole('alert')).textContent).toContain('Forbidden')
  expect(screen.queryByTestId('source')).toBeNull()
  expect(transport.request).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  await waitFor(() => expect(screen.getByTestId('source').textContent).toBe('api:0'))
})

it('reads a rotated token and refuses a different account token', async () => {
  render(tree())
  await screen.findByTestId('source')
  expect(transport.token?.()).toBe(token('first'))
  persist('rotated')
  expect(transport.token?.()).toBe(token('rotated'))
  persist('other', 'u2')
  expect(transport.token?.()).toBeNull()
})

it('does not reveal an old load after the session ends', async () => {
  let finish!: (value: unknown) => void
  transport.request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(tree())
  view.rerender(tree({ ...base, generation: 2, phase: 'anonymous', accountId: null, expiresAtMs: null, user: null }))
  await act(() => { finish({ items: [], total: 0 }); return Promise.resolve() })
  expect(screen.queryByTestId('source')).toBeNull()
  expect(screen.getByRole('status').textContent).toContain('Cần phiên đăng nhập trực tuyến')
})

it('keeps the existing Shopping demo store without calling backend endpoints', () => {
  transport.demo = true
  render(tree())
  expect(screen.getByTestId('source').textContent).toBe('fixture')
  expect(transport.request).not.toHaveBeenCalled()
})

it('does not substitute fixture data for a local-limited online session', () => {
  render(tree({ ...base, phase: 'local-limited', accountId: 'u1', expiresAtMs: 4_000_000_000_000, user: null }))
  expect(screen.getByRole('status').textContent).toContain('Cần phiên đăng nhập trực tuyến')
  expect(screen.queryByTestId('source')).toBeNull()
  expect(transport.request).not.toHaveBeenCalled()
})
