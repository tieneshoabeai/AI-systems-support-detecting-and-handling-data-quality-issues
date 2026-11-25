import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AdminApiPanel } from '../../views/management/home/admin-api-panel'
import { createAdminService } from '../../services/management/admin.service'
import { ManagementStoreContext } from '../../hooks/preview/use-preview-store'
import { previewMockStore } from '../../services/preview/preview-mock.service'
import { PreviewSessionProvider } from '../../views/preview/preview-session'
import { ProjectPanelSurface } from '../../components/project/members/project-members-dialog'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'

afterEach(cleanup)
const user = (id: string) => ({ id, email: `${id}@example.test`, firstName: 'Test', lastName: id,
  role: 'analyst', status: 'active', createdAt: '2026-11-15', updatedAt: '2026-11-15' })

it('keeps TaiFE admin tabs and loads another cursor page only when Tải thêm is clicked', async () => {
  const request = vi.fn((options: ApiRequestOptions) => Promise.resolve(options.path === '/admin/users'
    ? options.params?.['cursor'] === 'next'
      ? { items: [user('u1'), user('u2')], meta: { hasMore: false, nextCursor: null } }
      : { items: [user('u1')], meta: { hasMore: true, nextCursor: 'next' } }
    : { items: [], meta: { hasMore: false, nextCursor: null } }))
  const adminService = createAdminService({ request } as ApiClient)
  render(<ManagementStoreContext.Provider value={{ ...previewMockStore, adminService }}><AdminApiPanel /></ManagementStoreContext.Provider>)
  await screen.findByText('u1@example.test')
  expect(request).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Tải thêm' }))
  await screen.findByText('u2@example.test')
  expect(screen.getAllByText('u1@example.test')).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Tải thêm' })).toBeNull()
  expect(request.mock.calls.map(([options]) => options.path)).toEqual(['/admin/users', '/admin/users'])
  fireEvent.click(screen.getByRole('tab', { name: 'Báo cáo vấn đề' }))
  await screen.findByText('Chưa có báo cáo vấn đề để hiển thị.')
  expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/admin/issues' }))
})

it('loads the Project roster on opening and preserves a read-only account without a second Workspace roster request', async () => {
  const project = previewMockStore.getState().projects[0]!
  const loadProjectWizardRoster = vi.fn(() => Promise.resolve([]))
  const loadProjectMembersData = vi.fn(() => Promise.resolve({
    project: { ...project, canManage: false }, workspace: null,
  }))
  render(<ManagementStoreContext.Provider value={{ ...previewMockStore, loadProjectMembersData, loadProjectWizardRoster }}>
    <PreviewSessionProvider routeIds={{}}><ProjectPanelSurface panel={{ projectId: project.id }} projects={[project]} workspaces={[]} onClose={() => {}} /></PreviewSessionProvider>
  </ManagementStoreContext.Provider>)
  const add = await screen.findByRole<HTMLButtonElement>('button', { name: 'Thêm thành viên' })
  expect(add.disabled).toBe(true)
  expect(loadProjectMembersData).toHaveBeenCalledOnce()
  expect(loadProjectWizardRoster).not.toHaveBeenCalled()
})
