import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { Link } from 'react-router'
import { WorkbenchEntry } from '../../app/router/workbench-routes'
import { legacyManagementRedirect, universePath } from '../../services/preview/preview-route'
import { previewMockStore } from '../../services/preview/preview-mock.service'

vi.mock('../../views/preview/home-2d.view', () => ({ HomePreviewView: () => <><p>frame home</p><Link to="/management/projects">Projects</Link><Link to="/processing/projects/prj-sales/upload">Processing</Link></> }))
vi.mock('../../views/preview/workspaces-2d.view', () => ({ WorkspacesPreviewView: ({ workspaceId }: { workspaceId?: string }) => <p>{workspaceId ? `frame workspace ${workspaceId}` : 'frame workspaces'}</p> }))
vi.mock('../../views/preview/projects-2d.view', () => ({ ProjectsPreviewView: () => <p>frame projects</p> }))
vi.mock('../../views/preview/project-workspace-2d.view', () => ({ ProjectWorkspaceView: ({ projectId }: { projectId: string }) => <p>{`frame project ${projectId}`}</p> }))
vi.mock('../../views/preview/notifications-2d.view', () => ({ NotificationsPreviewView: ({ notificationId }: { notificationId: string | null }) => <p>{notificationId ? `frame notification ${notificationId}` : 'frame notifications'}</p> }))
vi.mock('../../views/preview/settings-2d.view', () => ({ SettingsPreviewView: ({ section }: { section: string | null }) => <p>{section ? `frame settings ${section}` : 'frame settings'}</p> }))

const openUrl = (url: string): void => { window.history.replaceState({}, '', url) }
// These tests verify routing, not module transform speed. Load lazy views before
// assertions so a cold Vite transform cannot consume Testing Library's wait window.
beforeAll(async () => {
  await Promise.all([import('../../views/application/application-frame'), import('../../views/preview/preview-entry'), import('../../views/processing/processing.view')])
})
beforeEach(() => { previewMockStore.reset(); window.localStorage.clear(); openUrl('/') })
afterEach(() => { cleanup(); openUrl('/') })

it.each([
  ['/management', 'frame home'],
  ['/management/workspaces', 'frame workspaces'],
  ['/management/workspaces/ws-acme', 'frame workspace ws-acme'],
  ['/management/projects', 'frame projects'],
  ['/processing/projects/prj-sales', 'frame project prj-sales'],
  ['/management/notifications/nt-02', 'frame notification nt-02'],
  ['/management/settings/sessions', 'frame settings sessions'],
])('opens %s directly and after remount', async (url, text) => {
  openUrl(url)
  const mounted = render(<WorkbenchEntry />)
  expect(await screen.findByText(text)).toBeDefined()
  expect(window.location.hash).toBe('')
  mounted.unmount()
  render(<WorkbenchEntry />)
  expect(await screen.findByText(text)).toBeDefined()
})

it.each([
  ['/preview/home#/preview/projects/ws-acme/prj-sales', '/processing/projects/prj-sales', 'frame project prj-sales'],
  ['/#/preview/workspaces/ws-acme', '/management/workspaces/ws-acme', 'frame workspace ws-acme'],
  ['/preview/projects/ws-acme', '/management/projects?workspace=ws-acme', 'frame projects'],
  ['/preview/settings/color', '/management/settings/color', 'frame settings color'],
])('migrates old URL %s without keeping its hash', async (url, destination, text) => {
  openUrl(url)
  render(<WorkbenchEntry />)
  expect(await screen.findByText(text)).toBeDefined()
  expect(`${window.location.pathname}${window.location.search}`).toBe(destination)
  expect(window.location.hash).toBe('')
})

it.each(['/management/unknown', '/management/settings/unknown', '/management/projects/prj-sales', '/management/projects/missing', '/management/workspaces/missing', '/processing/projects/missing', '/processing/projects/missing/upload', '/processing/projects/prj-sales/unknown'])('shows a missing resource/page for %s', async url => {
  openUrl(url)
  render(<WorkbenchEntry />)
  expect(await screen.findByText('404')).toBeDefined()
})

it('opens the processing entry, creation form, and cross-area navigation', async () => {
  openUrl('/processing')
  render(<WorkbenchEntry />)
  expect(await screen.findByRole('heading', { name: /Khám phá.*vũ trụ dữ liệu/ })).toBeDefined()
  expect(screen.getByRole('heading', { name: 'Projects gần đây' })).toBeDefined()
  expect(screen.queryByRole('list', { name: 'Các bước xử lý dữ liệu' })).toBeNull()
  fireEvent.click(await screen.findByRole('link', { name: 'Tạo Project' }))
  expect(await screen.findByRole('heading', { name: 'Tạo Project mới' })).toBeDefined()
  expect((screen.getByRole('button', { name: 'Tạo Project và tiếp tục' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('link', { name: 'Trang chủ Processing' }))
  expect(await screen.findByRole('heading', { name: /Khám phá.*vũ trụ dữ liệu/ })).toBeDefined()
  expect(window.location.pathname).toBe('/processing')
})

it.each(['upload', 'analysis', 'review', 'results'])('redirects old step %s to the existing project page', async step => {
  openUrl(`/processing/projects/prj-sales/${step}`)
  render(<WorkbenchEntry />)
  expect(await screen.findByText('frame project prj-sales')).toBeDefined()
  expect(window.location.pathname).toBe('/processing/projects/prj-sales')
})

it('keeps navigation in browser history for Back and Forward', async () => {
  openUrl('/management')
  render(<WorkbenchEntry />)
  fireEvent.click(await screen.findByRole('link', { name: 'Projects' }))
  expect(await screen.findByText('frame projects')).toBeDefined()
  act(() => window.history.back())
  await waitFor(() => expect(screen.getByText('frame home')).toBeDefined())
  act(() => window.history.forward())
  await waitFor(() => expect(screen.getByText('frame projects')).toBeDefined())
})

it('restores workspace scope from query and clears it for all projects', async () => {
  openUrl('/management/projects?workspace=ws-marketing')
  const mounted = render(<WorkbenchEntry />)
  await screen.findByText('frame projects')
  expect(previewMockStore.getState().selection.workspaceId).toBe('ws-marketing')
  mounted.unmount()
  openUrl('/management/projects')
  render(<WorkbenchEntry />)
  await screen.findByText('frame projects')
  expect(previewMockStore.getState().selection.workspaceId).toBe('')
})

it('does not migrate the existing 3D path or unrelated anchors', () => {
  expect(legacyManagementRedirect(universePath, '#project=prj-sales')).toBeNull()
  expect(legacyManagementRedirect('/auth/login', '#section-2')).toBeNull()
})

it('redirects a trailing-slash step URL to the existing project', async () => {
  openUrl('/processing/projects/prj-sales/upload/')
  render(<WorkbenchEntry />)
  expect(await screen.findByText('frame project prj-sales')).toBeDefined()
  expect(window.location.pathname).toBe('/processing/projects/prj-sales')
})

it('shares the same project data when navigating between management and processing', async () => {
  await previewMockStore.rename('project', 'prj-sales', 'Project đã đổi tên')
  openUrl('/processing')
  render(<WorkbenchEntry />)
  fireEvent.click(await screen.findByText('Project đã đổi tên', { selector: '.row-name' }))
  expect(await screen.findByText('frame project prj-sales')).toBeDefined()
  expect(previewMockStore.getState().projects.find(project => project.id === 'prj-sales')?.name).toBe('Project đã đổi tên')
})
