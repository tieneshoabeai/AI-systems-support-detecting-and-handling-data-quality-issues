import { afterEach, expect, it, vi } from 'vitest'
import { byNewestFirst, monthlyProgressFor, workspaceStatsFor } from '../../hooks/preview/preview-presentation'
import { previewMockStore } from '../../services/preview/preview-mock.service'

afterEach(() => vi.useRealTimers())

it('counts actual API creation dates instead of producing the fixture chart', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 17))
  const template = previewMockStore.getState().projects[0]!
  const projects = [
    { ...template, workspaceId: 'w1', createdAt: '7/11/2026' },
    { ...template, workspaceId: 'w1', createdAt: '2026-11-13T12:00:00Z' },
    { ...template, workspaceId: 'w2', createdAt: '7/11/2026' },
    { ...template, workspaceId: 'w1', createdAt: '7/11/2025' },
  ]
  expect(monthlyProgressFor('w1', 4, projects)).toEqual([
    { label: '7/2026', value: 0 }, { label: '8/2026', value: 0 },
    { label: '9/2026', value: 0 }, { label: '10/2026', value: 0 },
    { label: '11/2026', value: 2 },
  ])
})

it('sorts Vietnamese API dates chronologically and counts ownership by the logged-in account', () => {
  expect([{ updatedAt: '7/11/2026' }, { updatedAt: '17/11/2026' }].sort(byNewestFirst))
    .toEqual([{ updatedAt: '17/11/2026' }, { updatedAt: '7/11/2026' }])
  const template = previewMockStore.getState()
  const workspace = { ...template.workspaces[0]!, currentUserId: 'real-user', owner: { ...template.workspaces[0]!.owner, id: 'real-user' } }
  expect(workspaceStatsFor({ ...template, workspaces: [workspace] }).find(stat => stat.id === 'ws-owned')?.value).toBe('1')
})
