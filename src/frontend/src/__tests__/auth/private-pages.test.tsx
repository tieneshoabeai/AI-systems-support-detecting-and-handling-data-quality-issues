import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router'
import { AppRouter } from '../../app/router/app-router'
import { AuthContext } from '../../hooks/auth/auth-context'
import type { AuthContextValue } from '../../types/auth/auth-context.types'
import type { SessionSnapshot } from '../../types/auth/session-coordinator.types'

const calls = vi.hoisted(() => ({ dataset: vi.fn() }))
// This suite checks route admission; data loading is covered by management-data-provider.test.
vi.mock('../../views/application/management-data-provider', () => ({
  ManagementDataProvider: ({ children }: { children: import('react').ReactNode }) => children,
  ProcessingDataProvider: ({ children }: { children: import('react').ReactNode }) => children,
}))
vi.mock('../../views/auth/login.view', () => ({ LoginView: () => <h1>Login page</h1> }))
vi.mock('../../views/dataset-3d/dataset-3d.view', () => {
  calls.dataset()
  return { Dataset3DView: () => <h1>Private Dataset 3D</h1> }
})
vi.mock('../../views/preview/preview-entry', () => ({ ManagementArea: () => <h1>Private Management</h1> }))
vi.mock('../../views/processing/processing.view', () => ({ ProcessingView: () => <h1>Private Processing</h1> }))

const base = { generation: 1, sessionEnded: false, error: null, cleanupError: null }
const anonymous: SessionSnapshot = { ...base, phase: 'anonymous', accountId: null, expiresAtMs: null, user: null }
const authenticated: SessionSnapshot = {
  ...base, phase: 'authenticated', accountId: 'account-1', expiresAtMs: 4_000_000_000_000,
  user: { source: 'login', value: { id: 'account-1', email: 'user@example.test', role: 'analyst' } },
}

function Location() {
  const location = useLocation()
  return <output data-testid="route">{location.pathname}</output>
}

function mount(path: string, snapshot: SessionSnapshot) {
  const value: AuthContextValue = {
    snapshot, configurationError: null,
    signIn: () => Promise.resolve(),
    signOut: () => Promise.resolve({ serverRevoked: true, revokeError: null, cleanupError: null }),
    confirmRenewal: () => Promise.resolve(),
  }
  return render(<AuthContext.Provider value={value}>
    <MemoryRouter initialEntries={[path]}><AppRouter /><Location /></MemoryRouter>
  </AuthContext.Provider>)
}

afterEach(cleanup)

it.each(['/management', '/processing', '/processing/projects/missing'])(
  'requires a session before rendering %s', async path => {
    mount(path, anonymous)
    expect(await screen.findByRole('heading', { name: 'Login page' })).toBeDefined()
    expect(screen.getByTestId('route').textContent).toBe('/auth/login')
    expect(calls.dataset).not.toHaveBeenCalled()
    expect(screen.queryByText('Không tìm thấy project')).toBeNull()
  },
)

it.each([
  ['/management', 'Private Management'],
  ['/processing', 'Private Processing'],
])('allows an authenticated session at %s', async (path, heading) => {
  mount(path, authenticated)
  expect(await screen.findByRole('heading', { name: heading })).toBeDefined()
})

it.each([
  ['/unknown-url', anonymous],
  ['/workspaces', anonymous],
  ['/workspaces', authenticated],
  ['/workspaces/3d-dataset', anonymous],
  ['/workspaces/3d-dataset', authenticated],
])('shows public 404 at %s for session %j', async (path, snapshot) => {
  mount(path, snapshot)
  expect(await screen.findByRole('heading', { name: 'Không tìm thấy trang' })).toBeDefined()
  expect(screen.getByTestId('route').textContent).toBe(path)
})

it('shows missing project only after session validation', async () => {
  mount('/processing/projects/missing', authenticated)
  expect(await screen.findByRole('heading', { name: 'Không tìm thấy project' })).toBeDefined()
})

it('preserves local-limited access and waits for an unresolved session', async () => {
  const view = mount('/processing', {
    ...base, phase: 'local-limited', accountId: 'account-1', expiresAtMs: 4_000_000_000_000, user: null,
  })
  expect(await screen.findByRole('heading', { name: 'Private Processing' })).toBeDefined()
  view.unmount()
  mount('/processing', { ...anonymous, phase: 'bootstrapping' })
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Private Processing' })).toBeNull())
  expect(screen.getByTestId('route').textContent).toBe('/processing')
})
