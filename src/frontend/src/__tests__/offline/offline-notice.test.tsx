import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiTargetManager } from '../../lib/api-target-manager'
import { AuthContext } from '../../hooks/auth/auth-context'
import { OfflineNotice } from '../../app/provider/offline-notice'
import type { AuthContextValue } from '../../types/auth/auth-context.types'
import type { LocalDataPort, OfflineWritePort, OfflineWriteStatus } from '../../types/offline'

const originalOnline = Object.getOwnPropertyDescriptor(navigator, 'onLine')
afterEach(() => {
  cleanup()
  if (originalOnline) Object.defineProperty(navigator, 'onLine', originalOnline)
  else Reflect.deleteProperty(navigator, 'onLine')
  vi.restoreAllMocks()
})

it('shows stale/missing reads and each queued request state with recovery actions', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  const localSnapshot = {
    fallbacks: [{ cacheKey: 'workspace-cache', path: '/workspaces', savedAt: 1_700_000_000_000, fallbackAt: 1_700_000_001_000 }],
    cacheMisses: [{ cacheKey: 'project-cache', path: '/projects/not-cached', at: 1_700_000_002_000 }],
  }
  const localData: LocalDataPort = {
    wrapClient: api => api,
    readCached: async () => null,
    getSnapshot: () => localSnapshot,
    subscribe: () => () => {},
    resetStatus: () => {},
  }
  const queueStatus: OfflineWriteStatus = {
    entries: [
      { id: 'queued-1', state: 'queued', label: 'Xóa dataset', attempts: 0, createdAt: 1_700_000_000_000 },
      { id: 'sending-1', state: 'sending', label: 'Cập nhật project', attempts: 1, createdAt: 1_700_000_000_000 },
      { id: 'uncertain-1', state: 'uncertain', label: 'Upload sample.csv', fileName: 'sample.csv', attempts: 1, createdAt: 1_700_000_000_000, error: 'Mất phản hồi từ server.' },
      { id: 'blocked-1', state: 'blocked', label: 'Cập nhật workspace', attempts: 1, createdAt: 1_700_000_000_000, error: 'Version đã thay đổi.' },
    ], syncing: false, revision: 4, error: null,
  }
  const offlineWrites: OfflineWritePort = {
    getSnapshot: () => queueStatus,
    subscribe: () => () => {},
    accepts: () => false,
    enqueue: async () => { throw new Error('unused') },
    sync: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    recheck: vi.fn(async () => {}),
  }
  const apiTargetManager = new ApiTargetManager({ baseUrl: 'https://old.example.test', prefix: '/api/v1', environmentId: 'qa-main' })
  const retryConnection = vi.fn(async () => {})
  const value: AuthContextValue = {
    snapshot: { phase: 'local-limited', generation: 1, sessionEnded: false, accountId: 'account-a', expiresAtMs: Date.now() + 60_000, user: null, error: null, cleanupError: null },
    configurationError: null, localData, offlineWrites, apiTargetManager, retryConnection,
    signIn: async () => {}, signOut: async () => ({ serverRevoked: true, revokeError: null, cleanupError: null }), confirmRenewal: async () => {},
  }
  render(<AuthContext.Provider value={value}><OfflineNotice /></AuthContext.Provider>)

  expect(screen.getByRole('region', { name: 'Trạng thái offline và đồng bộ' })).toBeDefined()
  const readsRegion = screen.getByRole('region', { name: 'Dữ liệu đọc offline' })
  expect(readsRegion.textContent).toContain('Đang dùng cache cho /workspaces')
  expect(readsRegion.textContent).toContain('Chưa có bản lưu cho /projects/not-cached')
  const queueRegion = screen.getByRole('region', { name: 'Danh sách request đồng bộ' })
  expect(queueRegion.textContent).toContain('Đang chờ')
  expect(queueRegion.textContent).toContain('Đang gửi')
  expect(queueRegion.textContent).toContain('Chưa rõ kết quả')
  expect(queueRegion.textContent).toContain('Bị chặn · cần kiểm tra')
  expect(screen.getByText(/Bỏ khỏi queue chỉ áp dụng trước lần gửi đầu/)).toBeDefined()

  fireEvent.click(screen.getByRole('button', { name: 'Kết nối lại' }))
  await vi.waitFor(() => expect(retryConnection).toHaveBeenCalledOnce())
  const uncertainRow = screen.getByText('Upload sample.csv').closest('li')
  if (!uncertainRow) throw new Error('Không tìm thấy dòng upload cần đối chiếu.')
  fireEvent.click(within(uncertainRow).getByRole('button', { name: 'Đối chiếu lại' }))
  await vi.waitFor(() => expect(offlineWrites.recheck).toHaveBeenCalledWith('uncertain-1'))
  const queuedRow = screen.getByText('Xóa dataset').closest('li')
  if (!queuedRow) throw new Error('Không tìm thấy dòng delete đang chờ.')
  fireEvent.click(within(queuedRow).getByRole('button', { name: 'Bỏ khỏi queue' }))
  await vi.waitFor(() => expect(offlineWrites.cancel).toHaveBeenCalledWith('queued-1', 'queued'))
})
