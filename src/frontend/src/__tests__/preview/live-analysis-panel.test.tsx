import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../../hooks/auth/auth-context'
import { ManagementStoreContext } from '../../hooks/preview/use-preview-store'
import { ApiError } from '../../lib/api-error'
import { previewMockStore } from '../../services/preview/preview-mock.service'
import { createAnalysisService } from '../../services/processing/analysis.service'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'
import { LiveAnalysisPanel } from '../../views/processing/project/sections/live-analysis-panel'
import { PreviewSessionProvider } from '../../views/preview/preview-session'
import type { AuthContextValue } from '../../types/auth/auth-context.types'

const analysisRunId = '123456789012345678901234'
const jobId = 'abcdefabcdefabcdefabcdef'
const result = { analysisRunId, dqSummary: { totalScanned: 50 } }

afterEach(() => { cleanup(); vi.useRealTimers() })

function renderPanel(respond: (options: ApiRequestOptions) => unknown, canExecute = true) {
  const fixture = previewMockStore.getState().projects.find(project => project.dataset)
  if (!fixture?.dataset) throw new Error('Fixture needs a dataset')
  const project = { ...fixture, dataset: { ...fixture.dataset, status: 'processed' as const } }
  const request = vi.fn(async (options: ApiRequestOptions) => Promise.resolve(respond(options)))
  const store = { ...previewMockStore, analysisService: createAnalysisService({ request } as ApiClient) }
  let offlineSnapshot = { offline: false, savedAt: null, storageError: null }
  const offlineListeners = new Set<() => void>()
  const localOffline = {
    getSnapshot: () => offlineSnapshot,
    subscribe: (listener: () => void) => { offlineListeners.add(listener); return () => offlineListeners.delete(listener) },
    reconnect: () => {}, useSavedData: () => {}, listReports: () => Promise.resolve([]),
  }
  const auth = {
    snapshot: { phase: 'authenticated', generation: 1, sessionEnded: false, accountId: 'test-user',
      user: null, expiresAtMs: Date.now() + 60_000, error: null, cleanupError: null },
    configurationError: null, signIn: () => Promise.resolve(), signOut: () => Promise.resolve({ serverRevoked: true, revokeError: null, cleanupError: null }),
    confirmRenewal: () => Promise.resolve(),
    localData: { drafts: {}, offline: localOffline, migration: { getSnapshot: () => ({ state: 'idle', conflicts: 0,
      unlistedNamespaces: 0, message: null }), subscribe: () => () => {} }, wrapApi: (api: ApiClient) => api },
  } as unknown as AuthContextValue
  const setOffline = (value: boolean) => {
    offlineSnapshot = { offline: value, savedAt: null, storageError: null, ...(value ? { reason: 'network' as const } : {}) }
    offlineListeners.forEach(listener => listener())
  }
  render(<AuthContext.Provider value={auth}><ManagementStoreContext.Provider value={store}>
    <PreviewSessionProvider routeIds={{}}>
      <LiveAnalysisPanel project={project} canExecute={canExecute} />
    </PreviewSessionProvider>
  </ManagementStoreContext.Provider></AuthContext.Provider>)
  return { request, projectPath: `/projects/${project.id}`, setOffline }
}

it('loads the latest result without running analysis for a viewer', async () => {
  const { request, projectPath } = renderPanel(() => result, false)

  expect(await screen.findByText('Dòng đã quét')).toBeDefined()
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Chạy phân tích' }).disabled).toBe(true)
  expect(request).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ path: `${projectPath}/analysis/result` }))
})

it('runs analysis on demand and follows the returned job until success', async () => {
  const { request, projectPath } = renderPanel(options => {
    if (options.method === 'POST') return { ...result, pollUrl: `/api/v1/analysis/jobs/${jobId}` }
    if (options.path === `/analysis/jobs/${jobId}`) return { jobId, analysisRunId, status: 'succeeded' }
    return result
  })
  await screen.findByText('Dòng đã quét')

  fireEvent.click(screen.getByRole('button', { name: 'Chạy phân tích' }))

  await screen.findByText('Đã có kết quả')
  expect(request).toHaveBeenCalledWith(expect.objectContaining({
    path: `${projectPath}/analysis`, method: 'POST',
    data: { correlation_method: 'pearson', outlier_method: 'iqr', top_n: 10, chart_top_n: 5 },
  }))
  expect(request.mock.calls.filter(([options]) => options.path === `/analysis/jobs/${jobId}`)).toHaveLength(1)
})

it('pauses job polling offline and keeps the loaded correlation result usable', async () => {
  vi.useFakeTimers()
  const loadedResult = {
    ...result,
    correlationMatrix: {
      columns: ['Tuổi', 'Điểm'],
      cells: [
        { colA: 'Tuổi', colB: 'Điểm', kind: 'pearson', coef: 0.82, n: 50 },
        { colA: 'Điểm', colB: 'Tuổi', kind: 'pearson', coef: 0.82, n: 50 },
      ],
    },
  }
  const { request, projectPath, setOffline } = renderPanel(options => {
    if (options.method === 'POST') return { ...loadedResult, pollUrl: `/api/v1/analysis/jobs/${jobId}` }
    if (options.path === `/analysis/jobs/${jobId}`) return { jobId, analysisRunId, status: 'pending' }
    return loadedResult
  })

  await act(async () => { await Promise.resolve(); await Promise.resolve() })
  fireEvent.click(screen.getByRole('button', { name: 'Chạy phân tích' }))
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(0)
  })
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: `${projectPath}/analysis`, method: 'POST' }))
  expect(request.mock.calls.filter(([options]) => options.path === `/analysis/jobs/${jobId}`)).toHaveLength(1)

  act(() => { setOffline(true) })
  expect(screen.getByText(/Đang ngoại tuyến\. Kết quả đã tải vẫn xem được/)).toBeDefined()
  await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
  expect(request.mock.calls.filter(([options]) => options.path === `/analysis/jobs/${jobId}`)).toHaveLength(1)

  fireEvent.click(screen.getByText(/^Tương quan ·/))
  expect(screen.getByRole('table', { name: 'Bảng màu hệ số theo cặp cột' })).toBeDefined()
  expect(request.mock.calls.filter(([options]) => options.path === `/analysis/jobs/${jobId}`)).toHaveLength(1)

  act(() => { setOffline(false) })
  await act(async () => { await vi.advanceTimersByTimeAsync(0); await vi.advanceTimersByTimeAsync(0) })
  expect(request.mock.calls.filter(([options]) => options.path === `/analysis/jobs/${jobId}`)).toHaveLength(2)
})

it('shows an empty result when the project has no analysis run', async () => {
  renderPanel(() => { throw new ApiError({ kind: 'http', status: 404, message: 'Chưa có lần phân tích nào cho project này' }) })

  expect(await screen.findByText('Chưa có kết quả phân tích cho project này.')).toBeDefined()
})

it('does not use a result identifier as a feedback run identifier', async () => {
  renderPanel(() => ({ analysisId: '111111111111111111111111' }))
  await screen.findByText('Kết quả này chưa có số liệu tổng quan.')
  fireEvent.click(screen.getByText('Phản hồi'))
  expect(await screen.findByText('Chạy phân tích hoặc tải kết quả trước khi gửi phản hồi.')).toBeDefined()
  expect(screen.queryByRole('button', { name: 'Viết phản hồi' })).toBeNull()
})

it('loads feedback on open and sends a draft scoped to the current analysis run', async () => {
  const feedbackPath = `/analyses/${analysisRunId}/feedback`
  let created = false
  const { request } = renderPanel(options => {
    if (options.path !== feedbackPath) return result
    if (options.method === 'POST') { created = true; return {} }
    return {
      items: created ? [{ id: 'feedback-1', label: 'false_positive', reason: 'Ngoại lệ hợp lệ', isMine: true }] : [],
      meta: { hasMore: false, nextCursor: null },
    }
  })
  await screen.findByText('Dòng đã quét')
  expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ path: feedbackPath }))

  fireEvent.click(screen.getByText('Phản hồi'))
  fireEvent.click(await screen.findByRole('button', { name: 'Viết phản hồi' }))
  fireEvent.change(screen.getByLabelText('Đánh giá'), { target: { value: 'false_positive' } })
  fireEvent.click(screen.getByRole('button', { name: 'Gửi phản hồi' }))
  expect(screen.getByRole('alert').textContent).toContain('Hãy nhập lý do')
  fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Ngoại lệ hợp lệ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Gửi phản hồi' }))

  expect(await screen.findByText('Ngoại lệ hợp lệ')).toBeDefined()
  expect(request).toHaveBeenCalledWith(expect.objectContaining({
    path: feedbackPath, method: 'POST', data: { label: 'false_positive', reason: 'Ngoại lệ hợp lệ', suggestedSeverity: null },
  }))
})

it('posts feedback for the selected data quality finding and refreshes only that finding', async () => {
  const findingPath = `/analyses/${analysisRunId}/findings/${encodeURIComponent('DQ-01:Email')}/feedback`
  let created = false
  const { request } = renderPanel(options => {
    if (options.path === findingPath) {
      if (options.method === 'POST') {
        created = true
        return {}
      }
      return {
        items: created ? [{ id: 'finding-feedback-1', label: 'correct', reason: 'Đã kiểm tra cột Email' }] : [],
        meta: { hasMore: false, nextCursor: null },
      }
    }
    return { ...result, dqSummary: { totalScanned: 50, duplicateRowCount: 2, columns: [{ column: 'Email', missingCount: 12 }] } }
  })
  const quality = await screen.findByRole('region', { name: 'Chất lượng dữ liệu' })
  const finding = within(quality).getAllByRole('listitem').find(row => row.textContent?.includes('Cột Email'))
  if (!finding) throw new Error('Expected Email finding')
  expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ path: findingPath }))

  fireEvent.click(within(finding).getByText('Feedback'))
  const form = within(finding)
  await form.findByLabelText('Đánh giá')
  expect(form.queryByRole('option', { name: 'Bỏ sót vấn đề' })).toBeNull()
  fireEvent.change(form.getByLabelText('Lý do'), { target: { value: 'Đã kiểm tra cột Email' } })
  fireEvent.click(form.getByRole('button', { name: 'Gửi phản hồi' }))

  expect(await form.findByRole('button', { name: 'Gửi phản hồi thành công' })).toBeDefined()
  expect(within(screen.getByRole('status', { name: 'Kết quả thao tác' })).getByText('Đã gửi phản hồi.')).toBeDefined()
  expect(form.queryByText('Đã gửi phản hồi.')).toBeNull()
  expect(await form.findByText('Đã kiểm tra cột Email')).toBeDefined()
  expect(request).toHaveBeenCalledWith(expect.objectContaining({
    path: findingPath, method: 'POST',
    data: { label: 'correct', reason: 'Đã kiểm tra cột Email', suggestedSeverity: null },
  }))
  expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ path: `/analyses/${analysisRunId}/feedback` }))
})

it('keeps the feedback draft available when a pending submission fails', async () => {
  const feedbackPath = `/analyses/${analysisRunId}/feedback`
  let rejectSubmission!: (error: Error) => void
  const submission = new Promise<unknown>((_resolve, reject) => { rejectSubmission = reject })
  renderPanel(options => {
    if (options.path !== feedbackPath) return result
    if (options.method === 'POST') return submission
    return { items: [], meta: { hasMore: false, nextCursor: null } }
  })
  await screen.findByText('Dòng đã quét')
  fireEvent.click(screen.getByText('Phản hồi'))
  fireEvent.click(await screen.findByRole('button', { name: 'Viết phản hồi' }))
  fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Giữ nội dung này' } })
  fireEvent.click(screen.getByRole('button', { name: 'Gửi phản hồi' }))

  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Đang gửi phản hồi' }).disabled).toBe(true)
  expect(screen.queryByRole('button', { name: 'Gửi phản hồi thành công' })).toBeNull()
  rejectSubmission(new Error('Gửi thất bại'))

  expect(await screen.findByText('Gửi thất bại')).toBeDefined()
  expect(screen.getByDisplayValue('Giữ nội dung này')).toBeDefined()
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Gửi phản hồi' }).disabled).toBe(false)
  expect(screen.queryByText('Đã gửi phản hồi.')).toBeNull()
})

it('shows row actions only for your feedback and sends edit and delete requests for that row', async () => {
  const feedbackPath = `/analyses/${analysisRunId}/feedback`
  let mine = [{ id: 'feedback-1', label: 'correct', reason: 'Nhận xét cũ', authorDisplayName: 'Minh', isMine: true }]
  const { request } = renderPanel(options => {
    if (options.path === '/feedback/feedback-1' && options.method === 'PATCH') {
      mine = [{ id: 'feedback-1', label: 'correct', reason: 'Nhận xét mới', authorDisplayName: 'Minh', isMine: true }]
      return mine[0]
    }
    if (options.path === '/feedback/feedback-1' && options.method === 'DELETE') {
      mine = []
      return { deleted: true }
    }
    if (options.path === feedbackPath) return {
      items: [...mine, { id: 'feedback-2', label: 'correct', authorDisplayName: 'An', isMine: false }],
      meta: { hasMore: false, nextCursor: null },
    }
    return result
  })
  await screen.findByText('Dòng đã quét')
  fireEvent.click(screen.getByText('Phản hồi'))
  fireEvent.click(await screen.findByRole('button', { name: 'Thao tác phản hồi của Minh' }))
  expect(screen.queryByRole('button', { name: 'Thao tác phản hồi của An' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Sửa' }))
  fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Nhận xét mới' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  await screen.findByText('Nhận xét mới')

  fireEvent.click(screen.getByRole('button', { name: 'Thao tác phản hồi của Minh' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xóa' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }))

  await screen.findByText('Đã xóa phản hồi.')
  expect(screen.queryByText('Nhận xét mới')).toBeNull()
  expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: '/feedback/feedback-1', method: 'PATCH' }))
  expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: '/feedback/feedback-1', method: 'DELETE' }))
})

it('tracks the new job identifier returned by retry', async () => {
  const retriedId = 'fedcbafedcbafedcbafedcba'
  const { request } = renderPanel(options => {
    if (options.path === `/analysis/jobs/${jobId}/retry`) return { jobId: retriedId, status: 'pending' }
    if (options.path === `/analysis/jobs/${jobId}`) return { jobId, analysisRunId, status: 'failed' }
    if (options.path === `/analysis/jobs/${retriedId}`) return { jobId: retriedId, analysisRunId, status: 'succeeded' }
    if (options.method === 'POST') return { ...result, pollUrl: `/api/v1/analysis/jobs/${jobId}` }
    return result
  })
  await screen.findByText('Dòng đã quét')
  fireEvent.click(screen.getByRole('button', { name: 'Chạy phân tích' }))
  const retry = await screen.findByRole('button', { name: 'Thử lại job' })

  fireEvent.click(retry)

  await screen.findByText('Đã có kết quả')
  expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: `/analysis/jobs/${retriedId}` }))
})

it('reports a failed PDF job from the HTTP 202 metadata', async () => {
  renderPanel(options => options.responseType === 'blob'
    ? { status: 202, data: new Blob([JSON.stringify({ status: 'failed', error: 'Worker không tạo được file' })]) }
    : result)
  await screen.findByText('Dòng đã quét')
  fireEvent.click(screen.getByText('Tổng kết và PDF'))
  fireEvent.change(screen.getByLabelText('Mã report'), { target: { value: 'report-1' } })

  fireEvent.click(screen.getByRole('button', { name: 'Tải PDF' }))

  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Không tạo được PDF'))
})
