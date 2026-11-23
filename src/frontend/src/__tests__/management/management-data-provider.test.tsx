import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../../hooks/auth/auth-context'
import { usePreviewStore } from '../../hooks/preview/use-preview-store'
import { createSessionStorage } from '../../lib/session-storage'
import { useContext, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { ManagementDataProvider, ProcessingDataProvider } from '../../views/application/management-data-provider'
import { ProcessingDataContext } from '../../views/application/processing-data-context'
import { PreviewSessionProvider } from '../../views/preview/preview-session'
import { ProjectWorkspaceView } from '../../views/processing/project/project-workspace.view'
import { ProcessingView } from '../../views/processing/home/processing.view'
import { ManagementArea } from '../../views/preview/preview-entry'
import { ManagementLoadingContext, ManagementPersonalLoadingContext } from '../../hooks/preview/management-loading-context'
import { DataRegionStatus } from '../../components/loading/data-region-status'
import type { AuthContextValue } from '../../types/auth/auth-context.types'
import type { SessionSnapshot } from '../../types/auth/session-coordinator.types'
import type { ApiRequestOptions } from '../../types/api/api.types'

// Only the transport is replaced; provider, session storage and API store are real.
const transport = vi.hoisted(() => ({
  request: vi.fn<(options: ApiRequestOptions) => Promise<unknown>>(),
  token: undefined as (() => string | null) | undefined,
}))
vi.mock('../../lib/axios-client', () => ({
  createAxiosClient: (options: { readToken: () => string | null }) => {
    transport.token = options.readToken
    return { request: transport.request }
  },
}))
vi.mock('../../components/graphics/workspace-3d/home-universe', () => ({ default: () => <div aria-hidden="true" /> }))

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
  const status = useContext(ManagementLoadingContext)
  if (status) return <DataRegionStatus status={status} label="Đang tải dữ liệu"><span /></DataRegionStatus>
  return <output data-testid="source">{state.source === 'api' ? `api:${state.workspaces.length}` : 'fixture'}</output>
}
function tree(snapshot: SessionSnapshot = authenticated, projectId?: string, children?: ReactNode, recent = false, progressiveProjects = false) {
  const value: AuthContextValue = {
    snapshot, configurationError: null,
    signIn: () => Promise.resolve(), confirmRenewal: () => Promise.resolve(),
    signOut: () => Promise.resolve({ serverRevoked: true, revokeError: null, cleanupError: null }),
  }
  return <AuthContext.Provider value={value}>{projectId || recent
    ? <ProcessingDataProvider {...(projectId ? { projectId } : {})}>{children ?? <ProjectProbe />}</ProcessingDataProvider>
    : <ManagementDataProvider progressiveProjects={progressiveProjects}>{children ?? <Probe />}</ManagementDataProvider>}</AuthContext.Provider>
}
function ProjectProbe() {
  const processing = useContext(ProcessingDataContext)
  const state = usePreviewStore()
  return <><div>Khung project</div><output data-testid="project">{processing?.loading ? 'Đang tải' : state.projects[0]?.name}</output></>
}
const response = (r: ApiRequestOptions): Promise<unknown> => Promise.resolve().then(() => {
  if (r.path === '/projects') return { items: [], meta: { hasMore: false, nextCursor: null, limit: 10 } }
  if (r.path === '/workspaces' || r.path === '/projects') return { items: [], total: 0 }
  if (r.path === '/users/me') return { firstName: 'Test', lastName: 'User', email: 'user@example.test', role: 'analyst', notificationsEnabled: true }
  if (r.path === '/notifications/unread-count') return { unreadCount: 0 }
  if (r.path === '/notifications' || r.path === '/issues') return { items: [], meta: { hasMore: false, nextCursor: null } }
  if (r.path === '/notifications/unread-count') return { unreadCount: 0 }
  throw new Error(`Unexpected request: ${r.path}`)
})
beforeEach(() => {
  transport.token = undefined
  transport.request.mockReset().mockImplementation(response)
  window.sessionStorage.clear()
  persist('first')
})
afterEach(() => { cleanup(); window.sessionStorage.clear() })

it('shows a live card while both supplementary requests are pending and keeps viewer actions disabled', async () => {
  let finishMembers!: (value: unknown) => void
  let finishDataset!: (value: unknown) => void
  transport.request.mockImplementation(r => {
    if (r.path === '/workspaces') return Promise.resolve({ items: [{
      id: 'w1', name: 'Workspace', ownerId: 'owner', description: '', members: [], storageUsedBytes: 0,
      version: 1, lastAccessedAt: null, createdAt: '2026-11-15', updatedAt: '2026-11-15',
    }], total: 1 })
    if (r.path === '/projects') return Promise.resolve({ items: [{
      id: 'p1', name: 'Project 1', description: '', workspaceId: 'w1', members: [], createdBy: 'owner',
      hasDataset: true, version: 1, status: 'not_started', createdAt: '2026-11-15', updatedAt: '2026-11-15',
    }], total: 1 })
    if (r.path === '/projects/p1/members') return new Promise(resolve => { finishMembers = resolve })
    if (r.path === '/projects/p1/datasets') return new Promise(resolve => { finishDataset = resolve })
    return response(r)
  })
  render(<MemoryRouter initialEntries={['/management/projects']}>{tree(authenticated, undefined, <PreviewSessionProvider routeIds={{}}>
    <ManagementArea />
  </PreviewSessionProvider>, false, true)}</MemoryRouter>)
  const title = await screen.findByRole('heading', { name: 'Project 1' })
  const card = title.closest('article')!
  expect(card.dataset['cardDetails']).toBe('pending')
  expect(within(card).getByText('Đang tải dữ liệu…')).toBeDefined()
  expect(within(card).getByText('Đang tải thành viên…')).toBeDefined()
  const menu = within(card).getByRole<HTMLButtonElement>('button', { name: 'Thao tác với Project 1' })
  expect(menu.disabled).toBe(true)

  await act(async () => {
    finishMembers({ members: [{ userId: 'u1', role: 'viewer', name: 'Viewer' }] })
    finishDataset({ dataset: null })
  })
  expect(within(card).getByText('Chưa có tập dữ liệu.')).toBeDefined()
  expect(card.dataset['cardDetails']).toBe('ready')
  fireEvent.click(menu)
  expect(screen.getByRole<HTMLButtonElement>('menuitem', { name: /^Đổi tên/ }).disabled).toBe(true)
  expect(screen.getByRole<HTMLButtonElement>('menuitem', { name: /^Xóa Project/ }).disabled).toBe(true)
})

it('renders the project shell immediately and requests only the selected project and its workspace', async () => {
  let finish!: (value: unknown) => void
  transport.request.mockImplementation(r => {
    if (r.path === '/projects/p1') return new Promise(resolve => { finish = resolve })
    if (r.path === '/workspaces/w1') return Promise.resolve({ workspace: { id: 'w1', name: 'Workspace', ownerId: 'u1', description: '', members: [], storageUsedBytes: 0, version: 1, lastAccessedAt: null, createdAt: '2026-11-15', updatedAt: '2026-11-15' } })
    return response(r)
  })
  render(tree(authenticated, 'p1'))
  expect(screen.getByText('Khung project')).toBeDefined()
  expect(screen.getByTestId('project').textContent).toBe('Đang tải')
  expect(transport.request.mock.calls.map(([r]) => r.path)).toEqual(['/projects/p1'])

  await act(async () => {
    finish({ project: { id: 'p1', name: 'Project 1', description: '', workspaceId: 'w1', members: [], createdBy: 'u1',
      hasDataset: false, createdAt: '2026-11-15', updatedAt: '2026-11-15', status: 'not_started', version: 1 } })
  })
  expect(screen.getByTestId('project').textContent).toBe('Project 1')
  expect(transport.request.mock.calls.map(([r]) => r.path)).toEqual(['/projects/p1', '/workspaces/w1'])
})

it('keeps the scene mounted while preloading records and reads Detection before any run', async () => {
  let finishProject!: (value: unknown) => void
  let finishRecords!: (value: unknown) => void
  const project = { id: 'p1', name: 'Project 1', description: '', workspaceId: 'w1', members: [], createdBy: 'u1',
    hasDataset: true, createdAt: '2026-11-15', updatedAt: '2026-11-15', status: 'completed', version: 1 }
  transport.request.mockImplementation(r => {
    if (r.path === '/projects/p1') return new Promise(resolve => { finishProject = resolve })
    if (r.path === '/workspaces/w1') return Promise.resolve({ workspace: { id: 'w1', name: 'Workspace', ownerId: 'u1', description: '', members: [], storageUsedBytes: 0, version: 1, lastAccessedAt: null, createdAt: '2026-11-15', updatedAt: '2026-11-15' } })
    if (r.path === '/projects/p1/datasets') return Promise.resolve({ dataset: { id: 'd1', originalFileName: 'example.csv',
      rowCount: 0, columnCount: 0, fileSizeBytes: 0, createdAt: '2026-11-15', status: 'READY' } })
    if (r.path === '/datasets/d1/schema') return Promise.resolve({ columns: [] })
    if (r.path === '/datasets/d1/records') return new Promise(resolve => { finishRecords = resolve })
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
  expect(transport.request).toHaveBeenCalledWith(expect.objectContaining({ path: '/datasets/d1/records', params: { limit: 50, cursor: undefined } }))
  expect(transport.request).toHaveBeenCalledWith(expect.objectContaining({ path: '/projects/p1/analysis/result' }))
  expect(transport.request).not.toHaveBeenCalledWith(expect.objectContaining({ path: '/projects/p1/analysis' }))

  fireEvent.click(screen.getByRole('button', { name: 'Data View' }))
  expect(screen.getByText('Đang tải dữ liệu từ máy chủ.')).toBeDefined()
  await act(async () => { finishRecords({ items: [], meta: { hasMore: false, nextCursor: null } }) })
  expect(transport.request.mock.calls.filter(([r]) => r.path === '/datasets/d1/records')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Detection' }))
  expect(screen.getByText(/Kết quả đã lưu.*0 vi phạm/)).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Chạy Detection' }))
  expect(await screen.findByText(/Kết quả đã lưu.*1 vi phạm/)).toBeDefined()
})

it('waits for API data and exposes the real store without fixture records', async () => {
  render(tree())
  expect(screen.getByRole('status', { name: 'Đang tải dữ liệu' })).toBeDefined()
  expect(screen.queryByTestId('source')).toBeNull()
  await waitFor(() => expect(screen.getByTestId('source').textContent).toBe('api:0'))
  expect(transport.request.mock.calls.map(([r]) => r.path)).toEqual(['/workspaces', '/projects', '/users/me', '/notifications', '/issues', '/notifications/unread-count'])
})

it('keeps core data visible when notifications fail and retries only personal data', async () => {
  let failNotifications = true
  transport.request.mockImplementation(r => {
    if (r.path === '/notifications' && failNotifications) return Promise.reject(new Error('Notifications unavailable'))
    return response(r)
  })
  function PersonalProbe() {
    const status = useContext(ManagementPersonalLoadingContext)
    return status
      ? <DataRegionStatus status={status} label="Đang tải dữ liệu cá nhân"><span /></DataRegionStatus>
      : <span>Dữ liệu cá nhân sẵn sàng</span>
  }
  render(tree(authenticated, undefined, <><Probe /><PersonalProbe /></>))
  expect((await screen.findByRole('alert')).textContent).toContain('Notifications unavailable')
  expect(screen.getByTestId('source').textContent).toBe('api:0')

  failNotifications = false
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Dữ liệu cá nhân sẵn sàng')).toBeDefined()
  expect(transport.request.mock.calls.filter(([r]) => r.path === '/workspaces')).toHaveLength(1)
})

it('keeps the Processing hero mounted and shows loading, retry and empty state inside the project table', async () => {
  let failLoad!: (error: Error) => void
  transport.request.mockImplementationOnce(() => new Promise((_, reject) => { failLoad = reject }))
  render(tree(authenticated, undefined, <MemoryRouter initialEntries={['/processing']}>
    <PreviewSessionProvider routeIds={{}}><ProcessingView /></PreviewSessionProvider>
  </MemoryRouter>, true))

  const heading = screen.getByRole('heading', { name: /Khám phá.*vũ trụ dữ liệu/ })
  const table = screen.getByRole('table')
  expect(within(table).getByRole('status', { name: 'Đang tải Projects gần đây' })).toBeDefined()
  expect(screen.queryByText('Chưa có project nào.')).toBeNull()

  await waitFor(() => expect(transport.request).toHaveBeenCalledTimes(1))
  await act(async () => { failLoad(new Error('Offline')) })
  expect(within(table).getByRole('alert').textContent).toBe('Offline')
  fireEvent.click(within(table).getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Chưa có project nào.')).toBeDefined()
  expect(screen.getByRole('heading', { name: /Khám phá.*vũ trụ dữ liệu/ })).toBe(heading)
  expect(screen.getByRole('table')).toBe(table)
  expect(transport.request.mock.calls.map(([r]) => r.path)).toEqual(['/projects', '/projects'])
})

it('requests only the selected cursor page of recent projects and displays rows with optional metadata', async () => {
  transport.request.mockImplementation(r => {
    if (r.path !== '/projects') return response(r)
    if (r.params?.['cursor'] === 'next') return Promise.resolve({
      items: [{ id: 'p2', name: 'Project trang 2', status: 'completed', hasDataset: true }],
      meta: { hasMore: false, nextCursor: null, limit: 10 },
    })
    return Promise.resolve({
      items: [{ id: 'p1', name: 'Project trang 1', status: 'in_progress', workspaceName: 'Workspace A', fileName: 'sample.csv' }],
      meta: { hasMore: true, nextCursor: 'next', limit: 10 },
    })
  })
  render(tree(authenticated, undefined, <MemoryRouter initialEntries={['/processing']}>
    <PreviewSessionProvider routeIds={{}}><ProcessingView /></PreviewSessionProvider>
  </MemoryRouter>, true))

  expect(await screen.findByText('Project trang 1')).toBeDefined()
  expect(screen.getByText('Workspace A')).toBeDefined()
  expect(screen.getByText('sample.csv')).toBeDefined()
  expect(transport.request.mock.calls.map(([r]) => [r.path, r.params])).toEqual([['/projects', { sort: 'updated', limit: 10 }]])
  fireEvent.click(screen.getByRole('button', { name: 'Trang tiếp' }))
  const row = await screen.findByRole('rowheader', { name: 'Project trang 2' })
  expect(within(row.closest('tr')!).getAllByText('—')).toHaveLength(3)
  expect(transport.request.mock.calls[1]?.[0]).toMatchObject({ path: '/projects', params: { sort: 'updated', limit: 10, cursor: 'next' } })
  fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }))
  expect(await screen.findByText('Project trang 1')).toBeDefined()
  expect(transport.request.mock.calls.map(([r]) => r.path)).toEqual(['/projects', '/projects', '/projects'])
})

it('renders project rows before workspace names and reuses one lookup across rows and pages', async () => {
  let finishWorkspace!: (result: { workspace: { name: string } }) => void
  transport.request.mockImplementation(r => {
    if (r.path === '/workspaces/shared') return new Promise(resolve => { finishWorkspace = resolve })
    if (r.path === '/workspaces/unavailable') return Promise.reject(new Error('Forbidden'))
    if (r.path !== '/projects') return response(r)
    const nextPage = r.params?.['cursor'] === 'next'
    const ids = nextPage ? ['p3'] : ['p1', 'p2', 'missing']
    return Promise.resolve({
      items: ids.map(id => ({ id, name: id, status: 'completed', workspaceId: id === 'missing' ? 'unavailable' : 'shared' })),
      meta: { hasMore: !nextPage, nextCursor: nextPage ? null : 'next' },
    })
  })
  render(tree(authenticated, undefined, <MemoryRouter initialEntries={['/processing']}>
    <PreviewSessionProvider routeIds={{}}><ProcessingView /></PreviewSessionProvider>
  </MemoryRouter>, true))

  expect(await screen.findByText('p1')).toBeDefined()
  expect(screen.getByText('p2')).toBeDefined()
  expect(screen.queryByText('Workspace chung')).toBeNull()
  await act(async () => { finishWorkspace({ workspace: { name: 'Workspace chung' } }) })
  expect(screen.getAllByText('Workspace chung')).toHaveLength(2)
  expect(screen.getByText('missing')).toBeDefined()
  expect(screen.queryByRole('alert')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Trang tiếp' }))
  expect(await screen.findByText('p3')).toBeDefined()
  expect(await screen.findByText('Workspace chung')).toBeDefined()
  expect(transport.request.mock.calls.filter(([r]) => r.path === '/workspaces/shared')).toHaveLength(1)
})

it('shows Management navigation and waits for workspace data before reporting a missing workspace', async () => {
  let finishLoad!: (result: { items: []; total: number }) => void
  transport.request.mockImplementationOnce(() => new Promise(resolve => { finishLoad = resolve }))
  render(tree(authenticated, undefined, <MemoryRouter initialEntries={['/management/workspaces/missing']}>
    <PreviewSessionProvider routeIds={{ workspaceId: 'missing' }}><ManagementArea /></PreviewSessionProvider>
  </MemoryRouter>))

  expect(screen.getByRole('complementary', { name: 'Điều hướng chính' })).toBeDefined()
  expect(screen.getByRole('heading', { name: 'Workspaces', level: 1 })).toBeDefined()
  expect(screen.getByRole('status', { name: 'Đang tải Workspaces' })).toBeDefined()
  expect(screen.queryByText('Không tìm thấy workspace')).toBeNull()

  await act(async () => { finishLoad({ items: [], total: 0 }) })
  expect(await screen.findByText('Không tìm thấy workspace')).toBeDefined()
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
  expect(screen.getByRole('alert').textContent).toContain('Cần phiên đăng nhập trực tuyến')
})

it('does not substitute fixture data for a local-limited online session', () => {
  render(tree({ ...base, phase: 'local-limited', accountId: 'u1', expiresAtMs: 4_000_000_000_000, user: null }))
  expect(screen.getByRole('alert').textContent).toContain('Cần phiên đăng nhập trực tuyến')
  expect(screen.queryByTestId('source')).toBeNull()
  expect(transport.request).not.toHaveBeenCalled()
})
