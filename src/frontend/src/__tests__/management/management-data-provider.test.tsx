import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../../hooks/auth/auth-context'
import { usePreviewStore } from '../../hooks/preview/use-preview-store'
import { createSessionStorage } from '../../lib/session-storage'
import { useContext, type ReactNode } from 'react'
import { ManagementDataProvider, ProcessingDataProvider } from '../../views/application/management-data-provider'
import { ProcessingDataContext } from '../../views/application/processing-data-context'
import { PreviewSessionProvider } from '../../views/preview/preview-session'
import { ProjectWorkspaceView } from '../../views/processing/project/project-workspace.view'
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
function tree(snapshot: SessionSnapshot = authenticated, projectId?: string, children: ReactNode = <ProjectProbe />) {
  const value: AuthContextValue = {
    snapshot, configurationError: null,
    signIn: () => Promise.resolve(), confirmRenewal: () => Promise.resolve(),
    signOut: () => Promise.resolve({ serverRevoked: true, revokeError: null, cleanupError: null }),
  }
  return <AuthContext.Provider value={value}>{projectId
    ? <ProcessingDataProvider projectId={projectId}>{children}</ProcessingDataProvider>
    : <ManagementDataProvider><Probe /></ManagementDataProvider>}</AuthContext.Provider>
}
function ProjectProbe() {
  const processing = useContext(ProcessingDataContext)
  const state = usePreviewStore()
  return <><div>Khung project</div><output data-testid="project">{processing?.loading ? 'Đang tải' : state.projects[0]?.name}</output></>
}
const response = (r: ApiRequestOptions): Promise<unknown> => Promise.resolve().then(() => {
  if (r.path === '/workspaces') return { items: [], total: 0 }
  if (r.path === '/users/me') return { firstName: 'Test', lastName: 'User', email: 'user@example.test', role: 'analyst', notificationsEnabled: true }
  if (r.path === '/notifications/unread-count') return { unreadCount: 0 }
  if (r.path === '/notifications' || r.path === '/issues') return { items: [], meta: { hasMore: false, nextCursor: null } }
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

it('renders the project shell immediately and requests only the selected project and its workspace', async () => {
  let finish!: (value: unknown) => void
  transport.request.mockImplementation(r => {
    if (r.path === '/projects/p1') return new Promise(resolve => { finish = resolve })
    if (r.path === '/workspaces/w1') return Promise.resolve({ workspace: { id: 'w1', name: 'Workspace', ownerId: 'u1' } })
    return response(r)
  })
  render(tree(authenticated, 'p1'))
  expect(screen.getByText('Khung project')).toBeDefined()
  expect(screen.getByTestId('project').textContent).toBe('Đang tải')
  expect(transport.request.mock.calls.map(([r]) => r.path)).toEqual(['/projects/p1'])

  await act(async () => {
    finish({ project: { id: 'p1', name: 'Project 1', workspaceId: 'w1', members: [], createdBy: 'u1',
      hasDataset: false, createdAt: '2026-11-15', updatedAt: '2026-11-15', status: 'not_started', version: 1 } })
  })
  expect(screen.getByTestId('project').textContent).toBe('Project 1')
  expect(transport.request.mock.calls.map(([r]) => r.path)).toEqual(['/projects/p1', '/workspaces/w1'])
})

it('keeps the scene mounted while preloading records and reads Detection before any run', async () => {
  let finishProject!: (value: unknown) => void
  let finishRecords!: (value: unknown) => void
  const project = { id: 'p1', name: 'Project 1', workspaceId: 'w1', members: [], createdBy: 'u1',
    hasDataset: true, createdAt: '2026-11-15', updatedAt: '2026-11-15', status: 'completed', version: 1 }
  transport.request.mockImplementation(r => {
    if (r.path === '/projects/p1') return new Promise(resolve => { finishProject = resolve })
    if (r.path === '/workspaces/w1') return Promise.resolve({ workspace: { id: 'w1', name: 'Workspace', ownerId: 'u1' } })
    if (r.path === '/projects/p1/datasets') return Promise.resolve({ dataset: { id: 'd1', originalFileName: 'example.csv',
      rowCount: 0, columnCount: 0, fileSizeBytes: 0, createdAt: '2026-11-15', status: 'READY' } })
    if (r.path === '/datasets/d1/schema') return Promise.resolve({ columns: [] })
    if (r.path === '/datasets/d1/records/query') return new Promise(resolve => { finishRecords = resolve })
    if (r.path === '/projects/p1/analysis/result') return Promise.resolve({ dq05: { status: 'assessed', violations: [] } })
    if (r.path === '/projects/p1/analysis' && r.method === 'POST') return Promise.resolve({ dq05: { status: 'assessed', violations: [1] } })
    return response(r)
  })
  render(tree(authenticated, 'p1', <PreviewSessionProvider routeIds={{ projectId: 'p1' }}>
    <ProjectWorkspaceView projectId="p1" scene={<div data-testid="project-scene" />} />
  </PreviewSessionProvider>))
  const scene = screen.getByTestId('project-scene')
  expect(screen.getByText('Đang tải thông tin project…')).toBeDefined()
  await act(async () => { finishProject({ project }) })
  expect(screen.getByTestId('project-scene')).toBe(scene)
  expect(transport.request).toHaveBeenCalledWith(expect.objectContaining({ path: '/datasets/d1/records/query' }))
  expect(transport.request).toHaveBeenCalledWith(expect.objectContaining({ path: '/projects/p1/analysis/result' }))
  expect(transport.request).not.toHaveBeenCalledWith(expect.objectContaining({ path: '/projects/p1/analysis' }))

  fireEvent.click(screen.getByRole('button', { name: 'Data View' }))
  expect(screen.getByText('Đang tải dữ liệu từ máy chủ.')).toBeDefined()
  await act(async () => { finishRecords({ items: [], meta: { hasMore: false, nextCursor: null } }) })
  expect(transport.request.mock.calls.filter(([r]) => r.path === '/datasets/d1/records/query')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Detection' }))
  expect(screen.getByText(/Kết quả đã lưu.*0 vi phạm/)).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Chạy Detection' }))
  expect(await screen.findByText(/Kết quả đã lưu.*1 vi phạm/)).toBeDefined()
})

it('waits for API data and exposes the real store without fixture records', async () => {
  render(tree())
  expect(screen.getByRole('status').textContent).toContain('Đang tải')
  expect(screen.queryByTestId('source')).toBeNull()
  await waitFor(() => expect(screen.getByTestId('source').textContent).toBe('api:0'))
  expect(transport.request.mock.calls.map(([r]) => r.path)).toEqual(['/workspaces', '/users/me', '/notifications', '/issues', '/notifications/unread-count'])
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
