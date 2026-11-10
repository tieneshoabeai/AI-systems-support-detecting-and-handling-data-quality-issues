import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { previewMockStore } from '../../services/preview/preview-mock.service'
import { previewCardProps } from '../../views/preview/preview-card'
import { PreviewToaster } from '../../views/preview/components/preview-toaster'
import { HomePreviewView } from '../../views/preview/home-2d.view'
import { renderFrame } from './preview-test-kit'

beforeEach(() => { previewMockStore.reset('demo'); window.location.hash = '' })
afterEach(cleanup)

it('chặn thành viên ngoài Workspace tại cả lúc tạo và lúc thêm người vào Project', async () => {
  const outside = { id: 'outside', name: 'Người ngoài Workspace', initials: 'NN', role: 'Member' }
  const before = previewMockStore.getState()
  const project = before.projects[0]
  await expect(previewMockStore.addProjectMember({ projectId: project.id, person: outside, role: 'Member' }))
    .rejects.toThrow('Chỉ thành viên của Workspace')
  await expect(previewMockStore.createProject({
    workspaceId: project.workspaceId, name: 'Phân tích', description: '', members: [outside],
    dataset: { fileName: 'data.csv', format: 'CSV', rows: 1, columns: 1, sizeMb: 0.001 },
  })).rejects.toThrow('Chỉ thành viên của Workspace')
  expect(previewMockStore.getState()).toBe(before)
})

it('gỡ thành viên Workspace cũng gỡ khỏi Project; hoàn tác phục hồi cả hai', async () => {
  const person = { id: 'member-test', name: 'Thành viên kiểm thử', initials: 'TV', role: 'Member' }
  const project = previewMockStore.getState().projects[0]
  await previewMockStore.addWorkspaceMember({ workspaceId: project.workspaceId, person })
  await previewMockStore.addProjectMember({ projectId: project.id, person, role: 'Member' })
  const removal = await previewMockStore.removeWorkspaceMember(project.workspaceId, person.id)
  const memberIds = () => previewMockStore.getState().projects.find(item => item.id === project.id)!.members.map(item => item.id)
  expect(memberIds()).not.toContain(person.id)
  expect(previewMockStore.getState().workspaces.find(item => item.id === project.workspaceId)!.memberPreview.map(item => item.id))
    .not.toContain(person.id)
  removal.undo()
  expect(memberIds()).toContain(person.id)
  expect(previewMockStore.getState().workspaces.find(item => item.id === project.workspaceId)!.memberPreview.map(item => item.id))
    .toContain(person.id)
})

it('không gỡ hoặc đổi vai trò chủ sở hữu bằng đường cập nhật dữ liệu', async () => {
  const before = previewMockStore.getState()
  const workspace = before.workspaces[0]
  const project = before.projects[0]
  await expect(previewMockStore.removeWorkspaceMember(workspace.id, workspace.owner.id)).rejects.toThrow('chủ sở hữu')
  await expect(previewMockStore.setWorkspaceMemberRole(workspace.id, workspace.owner.id, 'Viewer')).rejects.toThrow('chủ sở hữu')
  await expect(previewMockStore.removeProjectMember(project.id, project.owner.id)).rejects.toThrow('chủ sở hữu')
  await expect(previewMockStore.setProjectMemberRole(project.id, project.owner.id, 'Viewer')).rejects.toThrow('chủ sở hữu')
  const owned = before.projects.find(item => {
    const parent = before.workspaces.find(ws => ws.id === item.workspaceId)!
    return item.owner.id !== parent.owner.id && parent.memberPreview.some(person => person.id === item.owner.id)
  })!
  expect(owned).toBeDefined()
  await expect(previewMockStore.removeWorkspaceMember(owned.workspaceId, owned.owner.id)).rejects.toThrow('đang sở hữu Project')
  expect(previewMockStore.getState()).toBe(before)
})

it('không tạo project mồ côi khi workspace không còn tồn tại', async () => {
  const before = previewMockStore.getState()
  await expect(previewMockStore.createProject({
    workspaceId: 'workspace-da-xoa', name: 'Phân tích', description: '', members: [],
    dataset: { fileName: 'data.csv', format: 'CSV', rows: 1, columns: 1, sizeMb: 0.001 },
  })).rejects.toThrow('Workspace không còn tồn tại')
  expect(previewMockStore.getState()).toBe(before)
})

it('Enter trên nút menu của dòng Project ở Home không mở trang ngoài ý muốn', () => {
  renderFrame(<HomePreviewView />)
  const row = document.querySelector<HTMLElement>('.home-table tbody tr')!
  const menu = row.querySelector<HTMLButtonElement>('button')!
  fireEvent.keyDown(menu, { key: 'Enter' })
  expect(window.location.hash).toBe('')
  fireEvent.keyDown(row, { key: 'Enter' })
  expect(window.location.hash).toContain('#/preview/projects/')
})

it('chuyển tới workspace rỗng bỏ project của phạm vi cũ; id không tồn tại không đổi phạm vi', () => {
  const initial = previewMockStore.getState()
  const empty = initial.workspaces.find(workspace => !initial.projects.some(project => project.workspaceId === workspace.id))!
  expect(empty).toBeDefined()
  previewMockStore.selectWorkspace(empty.id)
  expect(previewMockStore.getState().selection).toEqual({ workspaceId: empty.id, projectId: '' })
  previewMockStore.selectWorkspace('missing-workspace')
  previewMockStore.selectProject('missing-project')
  expect(previewMockStore.getState().selection).toEqual({ workspaceId: empty.id, projectId: '' })
  previewMockStore.selectWorkspace('')
  expect(previewMockStore.getState().selection).toEqual({ workspaceId: '', projectId: '' })
})

it('xóa project cuối trong workspace không chọn nhầm project ở workspace khác', async () => {
  const { projects } = previewMockStore.getState()
  const only = projects.find(project => projects.filter(item => item.workspaceId === project.workspaceId).length === 1)!
  expect(only).toBeDefined()
  previewMockStore.selectProject(only.id)
  const result = await previewMockStore.remove('project', only.id)
  expect(previewMockStore.getState().selection).toEqual({ workspaceId: only.workspaceId, projectId: '' })
  result.undo()
  expect(previewMockStore.getState().selection).toEqual({ workspaceId: only.workspaceId, projectId: only.id })
})

it('hoàn tác không làm mất cập nhật thông báo hoặc phạm vi được chọn sau đó', async () => {
  const initial = previewMockStore.getState()
  const workspace = initial.workspaces[0]
  const notice = initial.notifications.find(item => item.unread)!
  const favorite = await previewMockStore.toggleFavorite(workspace.id)
  await previewMockStore.markNotificationsRead([notice.id])
  previewMockStore.selectWorkspace(initial.workspaces[1].id)
  const selection = previewMockStore.getState().selection
  favorite.undo()
  const restored = previewMockStore.getState()
  expect(restored.workspaces[0].favorite).toBe(workspace.favorite)
  expect(restored.notifications.find(item => item.id === notice.id)?.unread).toBe(false)
  expect(restored.selection).toEqual(selection)
  favorite.undo()
  expect(previewMockStore.getState()).toBe(restored)
})

it('hoàn tác cũ không ghi đè thay đổi mới hơn; hoàn tác theo thứ tự ngược vẫn được', async () => {
  const original = previewMockStore.getState().projects[0]
  const first = await previewMockStore.rename('project', original.id, 'Tên lần một')
  const second = await previewMockStore.rename('project', original.id, 'Tên lần hai')
  expect(() => first.undo()).toThrow('thao tác mới hơn')
  expect(previewMockStore.getState().projects[0].name).toBe('Tên lần hai')
  second.undo()
  expect(previewMockStore.getState().projects[0].name).toBe('Tên lần một')
  first.undo()
  expect(previewMockStore.getState().projects[0].name).toBe(original.name)
})

it('bàn phím và double click trên nút con không kích hoạt mở thẻ', () => {
  const detail = vi.fn()
  const menu = vi.fn()
  const view = render(<article tabIndex={0} {...previewCardProps({ detail, menu })}>
    <button type="button">Thao tác</button><span>Tên thẻ</span>
  </article>)
  const button = view.getByRole('button')
  fireEvent.keyDown(button, { key: 'Enter' })
  fireEvent.keyDown(button, { key: ' ' })
  fireEvent.doubleClick(button)
  expect(detail).not.toHaveBeenCalled()
  fireEvent.keyDown(view.container.querySelector('article')!, { key: 'Enter' })
  expect(detail).toHaveBeenCalledTimes(1)
  fireEvent.doubleClick(view.getByText('Tên thẻ'))
  expect(detail).toHaveBeenCalledTimes(2)
})

it('giữ nút hoàn tác khi dữ liệu xung đột để người dùng có thể thử lại', () => {
  const undo = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true)
  const dismiss = vi.fn()
  const view = render(<PreviewToaster toasts={[{ id: 'undo-conflict', text: 'Đã đổi tên', tone: 'success', onUndo: undo }]} onDismiss={dismiss} />)
  fireEvent.click(view.getByRole('button', { name: 'Hoàn tác' }))
  expect(dismiss).not.toHaveBeenCalled()
  fireEvent.click(view.getByRole('button', { name: 'Hoàn tác' }))
  expect(dismiss).toHaveBeenCalledWith('undo-conflict')
})
