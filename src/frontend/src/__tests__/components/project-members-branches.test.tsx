import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ProjectMembersDialog, ProjectPanelSurface } from '../../components/project/members/project-members-dialog'
import { ManagementStoreContext, usePreviewStore } from '../../hooks/management/use-management-store'
import { previewMockStore as store } from '../support/management-mock-store'
import { requireDefined } from '../../utils/required-value'
import { renderFrame } from '../support/workbench-test-kit'

const person = { id: 'coverage-ui-member', name: 'Unique Candidate', initials: 'UC', role: 'Specialist', email: 'candidate@example.test' }
const target = () => requireDefined(store.getState().projects[0], 'project fixture')
beforeEach(async () => {
  vi.useFakeTimers()
  store.reset('demo')
  const addition = store.addWorkspaceMember({ workspaceId: target().workspaceId, person })
  await vi.advanceTimersByTimeAsync(160)
  await addition
})
afterEach(() => { cleanup(); vi.useRealTimers() })

function Members() {
  const state = usePreviewStore()
  return <ProjectPanelSurface panel={{ projectId: target().id }} projects={state.projects} workspaces={state.workspaces} onClose={() => {}} />
}

it('shows the member roster without an add button for a read-only account', () => {
  const project = { ...target(), canManage: false, members: [person] }
  renderFrame(<ProjectMembersDialog project={project} workspace={null} live onClose={() => {}} />)

  expect(screen.queryByRole('button', { name: 'Thêm thành viên' })).toBeNull()
  expect(within(screen.getByRole('row', { name: /Unique Candidate/ })).getByText('Chỉ xem')).toBeDefined()
})

it('retries a failed live roster and displays verified names and candidates', async () => {
  const project = { ...target(), canManage: false }
  const owner = { ...project.owner, name: 'Project Owner From API' }
  const liveStore = {
    ...store,
    loadProjectMembersData: vi.fn()
      .mockRejectedValueOnce(new Error('Không tải được dữ liệu.'))
      .mockResolvedValueOnce({
        project: { owner, members: [owner], canManage: true },
        workspace: { name: 'Workspace From API', memberPreview: [person] },
      }),
  }
  renderFrame(<ManagementStoreContext.Provider value={liveStore}>
    <ProjectPanelSurface panel={{ projectId: project.id }} projects={[project]} workspaces={[]} onClose={() => {}} />
  </ManagementStoreContext.Provider>)

  expect(within(screen.getByRole('dialog')).getByRole('status').textContent).toContain('Đang tải')
  await act(() => Promise.resolve())
  expect(screen.getByRole('alert').textContent).toContain('Không tải được dữ liệu.')
  await act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    return Promise.resolve()
  })

  expect(screen.getByRole('row', { name: /Project Owner From API/ })).toBeDefined()
  expect(screen.getByText(/Workspace From API/)).toBeDefined()
  const add = screen.getByRole<HTMLButtonElement>('button', { name: 'Thêm thành viên' })
  expect(add.disabled).toBe(false)
  fireEvent.click(add)
  expect(screen.getByText(person.name)).toBeDefined()
})

it.each(['keyboard', 'button'])('adds a workspace candidate using %s, changes their role and removes them through the real session', async input => {
  renderFrame(<Members />)
  fireEvent.click(screen.getByRole('button', { name: 'Thêm thành viên' }))
  const search = screen.getByRole('textbox', { name: 'Tìm thành viên của Workspace để thêm vào Project' })
  fireEvent.change(search, { target: { value: input === 'keyboard' ? 'unique candidate' : 'candidate@example.test' } })
  if (input === 'keyboard') fireEvent.keyDown(search, { key: 'Enter' })
  else fireEvent.click(screen.getByRole('button', { name: 'Thêm' }))
  await act(() => vi.advanceTimersByTimeAsync(160))
  expect(target().members.find(item => item.id === person.id)?.role).toBe('Member')
  fireEvent.change(screen.getByRole('combobox', { name: `Vai trò của ${person.name} trong project` }), { target: { value: 'Viewer' } })
  await act(() => vi.advanceTimersByTimeAsync(160))
  expect(target().members.find(item => item.id === person.id)?.role).toBe('Viewer')
  fireEvent.click(screen.getByRole('button', { name: `Gỡ ${person.name} khỏi Project` }))
  await act(() => vi.advanceTimersByTimeAsync(160))
  expect(target().members.some(item => item.id === person.id)).toBe(false)
  expect(screen.queryByRole('combobox', { name: `Vai trò của ${person.name} trong project` })).toBeNull()
})

it('does not add anyone when the candidate search has no match', () => {
  renderFrame(<Members />)
  const before = target().members
  fireEvent.click(screen.getByRole('button', { name: 'Thêm thành viên' }))
  const search = screen.getByRole('textbox', { name: 'Tìm thành viên của Workspace để thêm vào Project' })
  fireEvent.change(search, { target: { value: 'no-match-external-person' } })
  expect(screen.queryByRole('button', { name: 'Thêm' })).toBeNull()
  fireEvent.keyDown(search, { key: 'Enter' })
  expect(target().members).toBe(before)
})

it('keeps a custom member role visible and combines name/email search with role filtering', () => {
  const project = { ...target(), members: [person] }
  const workspace = requireDefined(store.getState().workspaces.find(item => item.id === project.workspaceId), 'workspace fixture')
  renderFrame(<ProjectMembersDialog project={project} workspace={workspace} onClose={() => {}} />)
  const select = screen.getByRole<HTMLSelectElement>('combobox', { name: `Vai trò của ${person.name} trong project` })
  expect(select.value).toBe('Specialist')
  expect(within(select).getByRole('option', { name: 'Specialist' })).toBeDefined()
  fireEvent.change(screen.getByRole('textbox', { name: 'Tìm kiếm thành viên của project' }), { target: { value: 'unique' } })
  expect(screen.getByRole('row', { name: /Unique Candidate/ })).toBeDefined()
  fireEvent.change(screen.getByRole('textbox', { name: 'Tìm kiếm thành viên của project' }), { target: { value: 'candidate@example.test' } })
  expect(screen.getByRole('row', { name: /Unique Candidate/ })).toBeDefined()
  fireEvent.change(screen.getByRole('combobox', { name: 'Lọc theo vai trò' }), { target: { value: 'Viewer' } })
  expect(screen.getByText('Không có thành viên nào khớp bộ lọc.')).toBeDefined()
})

it('shows a missing workspace without inventing candidates and does not duplicate an owner already in the roster', () => {
  const project = target()
  renderFrame(<ProjectMembersDialog project={{ ...project, members: [project.owner] }} workspace={null} onClose={() => {}} />)
  expect(screen.getByText('1 thành viên')).toBeDefined()
  expect(screen.getByText(/Workspace đã bị gỡ/)).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Thêm thành viên' }))
  expect(screen.getByText(/Workspace của project này chưa có thành viên nào/)).toBeDefined()
  expect(screen.queryByRole('button', { name: `Gỡ ${project.owner.name} khỏi Project` })).toBeNull()
})

it('does not open a panel without a request or after its project disappears', () => {
  const view = renderFrame(<ProjectPanelSurface panel={null} projects={[]} workspaces={[]} onClose={() => {}} />)
  expect(screen.queryByRole('dialog')).toBeNull()
  view.unmount()
  renderFrame(<ProjectPanelSurface panel={{ projectId: 'missing' }} projects={[]} workspaces={[]} onClose={() => {}} />)
  expect(screen.queryByRole('dialog')).toBeNull()
})
