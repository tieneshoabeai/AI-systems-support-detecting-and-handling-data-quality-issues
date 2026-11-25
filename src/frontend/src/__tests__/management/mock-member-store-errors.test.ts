import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { previewMockStore as store } from '../support/management-mock-store'
import { requireDefined } from '../../utils/required-value'

beforeEach(() => { vi.useFakeTimers(); store.reset('demo') })
afterEach(() => { vi.useRealTimers() })
const person = { id: 'coverage-member', name: 'Test Member', initials: 'TM', role: 'Member' }
const project = () => requireDefined(store.getState().projects[0], 'test project')
const workspace = () => requireDefined(store.getState().workspaces.find(item => item.id === project().workspaceId), 'test workspace')

it.each([
  ['add workspace member', () => store.addWorkspaceMember({ workspaceId: 'missing', person })],
  ['change workspace member role', () => store.setWorkspaceMemberRole('missing', person.id, 'Viewer')],
  ['remove workspace member', () => store.removeWorkspaceMember('missing', person.id)],
  ['add project member', () => store.addProjectMember({ projectId: 'missing', person, role: 'Member' })],
  ['change project member role', () => store.setProjectMemberRole('missing', person.id, 'Viewer')],
  ['remove project member', () => store.removeProjectMember('missing', person.id)],
] as const)('rejects %s for a missing resource without changing state', async (_name, run) => {
  const before = store.getState()
  await expect(run()).rejects.toThrow(/không tồn tại|không còn/)
  expect(store.getState()).toBe(before)
})

it.each(['workspace', 'project'] as const)('rejects role changes and removal of an unknown member in an existing %s', async kind => {
  const before = store.getState()
  if (kind === 'workspace') {
    await expect(store.setWorkspaceMemberRole(workspace().id, person.id, 'Viewer')).rejects.toThrow('không còn')
    await expect(store.removeWorkspaceMember(workspace().id, person.id)).rejects.toThrow('không còn')
  } else {
    await expect(store.setProjectMemberRole(project().id, person.id, 'Viewer')).rejects.toThrow('không còn')
    await expect(store.removeProjectMember(project().id, person.id)).rejects.toThrow('không còn')
  }
  expect(store.getState()).toBe(before)
})

it('rejects adding the workspace owner to the roster again', async () => {
  const target = workspace()
  const before = store.getState()
  await expect(store.addWorkspaceMember({ workspaceId: target.id, person: target.owner })).rejects.toThrow('đã là thành viên')
  expect(store.getState()).toBe(before)
})

it('rejects duplicate project membership and restores role/removal changes through undo', async () => {
  const target = project()
  const invitation = store.addWorkspaceMember({ workspaceId: target.workspaceId, person })
  await vi.advanceTimersByTimeAsync(160)
  await invitation
  const addition = store.addProjectMember({ projectId: target.id, person, role: 'Member' })
  await vi.advanceTimersByTimeAsync(160)
  await addition
  const beforeDuplicate = store.getState()
  await expect(store.addProjectMember({ projectId: target.id, person, role: 'Admin' })).rejects.toThrow('đã là thành viên')
  expect(store.getState()).toBe(beforeDuplicate)
  const change = store.setProjectMemberRole(target.id, person.id, 'Viewer')
  await vi.advanceTimersByTimeAsync(160)
  const changed = await change
  const member = () => project().members.find(item => item.id === person.id)
  expect(member()?.role).toBe('Viewer')
  changed.undo()
  expect(member()?.role).toBe('Member')
  const removal = store.removeProjectMember(target.id, person.id)
  await vi.advanceTimersByTimeAsync(160)
  const removed = await removal
  expect(member()).toBeUndefined()
  removed.undo()
  expect(member()).toMatchObject(person)
})
