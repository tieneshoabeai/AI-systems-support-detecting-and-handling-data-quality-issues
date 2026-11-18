import { beforeEach, expect, it, vi } from 'vitest'
import { previewMockStore } from '../../services/preview/preview-mock.service'

const key = 'shopping-demo.project-state.v1'
beforeEach(() => { sessionStorage.clear(); previewMockStore.reset() })

// A fresh module isolates the module-owned diagnostic between independent cases.
const storage = () => vi.importActual<typeof import('../../mocks/shopping-trends/demo-storage')>('../../mocks/shopping-trends/demo-storage')

it('uses the seed without a saved snapshot and round-trips a saved state', async () => {
  vi.resetModules()
  const service = await storage()
  const seed = previewMockStore.getState()
  expect(service.getDemoStorageIssue()).toBeNull()
  expect(service.restoreDemoState(seed)).toBe(seed)
  service.persistDemoState(seed)
  expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual({ version: 1, state: seed })
  expect(service.restoreDemoState(seed)).toEqual(seed)
  expect(service.getDemoStorageIssue()).toBeNull()
})

it.each(['{broken', 'null', '{}', '{"version":2,"state":{}}', '{"version":1,"state":{}}'])('falls back with an observable diagnostic for invalid snapshot %s', async raw => {
  vi.resetModules()
  const service = await storage()
  const seed = previewMockStore.getState()
  sessionStorage.setItem(key, raw)
  expect(service.restoreDemoState(seed)).toBe(seed)
  expect(service.getDemoStorageIssue()).toBe('Không đọc được trạng thái demo đã lưu. Đang dùng dữ liệu ban đầu.')
})

it.each(['projects', 'workspaces', 'notifications', 'reports', 'selection', 'profile', 'sessions', 'notificationPrefs'])('rejects a snapshot missing required field %s', async field => {
  vi.resetModules()
  const service = await storage()
  const seed = previewMockStore.getState()
  const state: Record<string, unknown> = { ...seed }
  delete state[field]
  sessionStorage.setItem(key, JSON.stringify({ version: 1, state }))
  expect(service.restoreDemoState(seed)).toBe(seed)
  expect(service.getDemoStorageIssue()).not.toBeNull()
})

it('rejects an unsupported version even when the saved state is otherwise valid', async () => {
  vi.resetModules()
  const service = await storage()
  const seed = previewMockStore.getState()
  sessionStorage.setItem(key, JSON.stringify({ version: 2, state: seed }))
  expect(service.restoreDemoState(seed)).toBe(seed)
  expect(service.getDemoStorageIssue()).not.toBeNull()
})

it('falls back on read failure and exposes write failure instead of acknowledging persistence', async () => {
  vi.resetModules()
  const service = await storage()
  const seed = previewMockStore.getState()
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  expect(service.restoreDemoState(seed)).toBe(seed)
  expect(service.getDemoStorageIssue()).not.toBeNull()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  expect(() => service.persistDemoState(seed)).toThrow('Không lưu được trạng thái demo trong trình duyệt.')
})

it('clears project and detection snapshots while preserving unrelated storage', async () => {
  const service = await storage()
  sessionStorage.setItem(key, 'project')
  sessionStorage.setItem('shopping-demo.detection.v1', 'detection')
  sessionStorage.setItem('unrelated', 'keep')
  service.clearDemoProject()
  expect(sessionStorage.getItem(key)).toBeNull()
  expect(sessionStorage.getItem('shopping-demo.detection.v1')).toBeNull()
  expect(sessionStorage.getItem('unrelated')).toBe('keep')
})

it('propagates a cleanup failure to the caller', async () => {
  const service = await storage()
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked cleanup') })
  expect(() => service.clearDemoProject()).toThrow('blocked cleanup')
})
