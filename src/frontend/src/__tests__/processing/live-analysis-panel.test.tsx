import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ManagementStoreContext } from '../../hooks/management/use-management-store'
import { ApiError } from '../../lib/api-error'
import { previewMockStore } from '../support/management-mock-store'
import { createAnalysisService } from '../../services/processing/analysis.service'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'
import { LiveAnalysisPanel } from '../../views/processing/project/sections/live-analysis-panel'
import { PreviewSessionProvider } from '../../views/application/workbench-session'

const analysisRunId = '123456789012345678901234'
const jobId = 'abcdefabcdefabcdefabcdef'
const result = { analysisRunId, dqSummary: { totalScanned: 50 } }

afterEach(cleanup)

function renderPanel(respond: (options: ApiRequestOptions) => unknown, canExecute = true) {
  const fixture = previewMockStore.getState().projects.find(project => project.dataset)
  if (!fixture?.dataset) throw new Error('Fixture needs a dataset')
  const project = { ...fixture, dataset: { ...fixture.dataset, status: 'processed' as const } }
  const request = vi.fn(async (options: ApiRequestOptions) => Promise.resolve(respond(options)))
  const store = { ...previewMockStore, analysisService: createAnalysisService({ request } as ApiClient) }
  render(<ManagementStoreContext.Provider value={store}>
    <PreviewSessionProvider routeIds={{}}>
      <LiveAnalysisPanel project={project} canExecute={canExecute} />
    </PreviewSessionProvider>
  </ManagementStoreContext.Provider>)
  return { request, projectPath: `/projects/${project.id}` }
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

  await waitFor(() => {
    expect(request.mock.calls.filter(([options]) => options.path === `${projectPath}/analysis/result`)).toHaveLength(2)
  })
  expect(request).toHaveBeenCalledWith(expect.objectContaining({
    path: `${projectPath}/analysis`, method: 'POST',
    data: { correlation_method: 'pearson', outlier_method: 'iqr', top_n: 10, chart_top_n: 5 },
  }))
  expect(request.mock.calls.filter(([options]) => options.path === `/analysis/jobs/${jobId}`)).toHaveLength(1)
  expect(screen.getByText('Dòng đã quét')).toBeDefined()
  expect(screen.queryByText('Tiến trình phân tích AI')).toBeNull()
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

it('shows a persisted feedback check before opening a finding on a fresh page', async () => {
  const findingPath = `/analyses/${analysisRunId}/findings/${encodeURIComponent('DQ-01:Email')}/feedback`
  const { request } = renderPanel(options => options.path === findingPath
    ? {
      items: [{ id: 'saved-feedback', label: 'correct' }],
      meta: { hasMore: false, nextCursor: null },
    }
    : { ...result, dqSummary: { columns: [{ column: 'Email', missingCount: 12 }] } })

  const check = await screen.findByLabelText('Đã có phản hồi · Thiếu dữ liệu · Cột Email')
  expect(check.textContent).toBe('✓')
  expect(check.closest('details')?.open).toBe(false)
  expect(request.mock.calls.filter(([options]) => options.path === findingPath).map(([options]) => options.params))
    .toEqual([{ limit: 1 }])
})

it('posts feedback for the selected data quality finding and refreshes only that finding', async () => {
  const findingPath = `/analyses/${analysisRunId}/findings/${encodeURIComponent('DQ-01:Email')}/feedback`
  let created = false
  const { request } = renderPanel(options => {
    if (options.path === '/feedback/finding-feedback-1' && options.method === 'DELETE') {
      created = false
      return { deleted: true }
    }
    if (options.path === findingPath) {
      if (options.method === 'POST') {
        created = true
        return {}
      }
      return {
        items: created ? [{ id: 'finding-feedback-1', label: 'correct', reason: 'Đã kiểm tra cột Email', isMine: true }] : [],
        meta: { hasMore: false, nextCursor: null },
      }
    }
    return { ...result, dqSummary: { totalScanned: 50, duplicateRowCount: 2, columns: [{ column: 'Email', missingCount: 12 }] } }
  })
  const quality = await screen.findByRole('region', { name: 'Chất lượng dữ liệu' })
  const finding = within(quality).getAllByRole('listitem').find(row => row.textContent?.includes('Cột Email'))
  if (!finding) throw new Error('Expected Email finding')
  await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: findingPath, params: { limit: 1 } })))
  expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ path: findingPath, params: { limit: 20 } }))

  fireEvent.click(within(finding).getByText('Feedback'))
  const form = within(finding)
  await form.findByLabelText('Đánh giá')
  expect(form.queryByRole('option', { name: 'Bỏ sót vấn đề' })).toBeNull()
  fireEvent.change(form.getByLabelText('Lý do'), { target: { value: 'Đã kiểm tra cột Email' } })
  fireEvent.click(form.getByRole('button', { name: 'Gửi phản hồi' }))

  expect(await form.findByRole('button', { name: 'Gửi phản hồi thành công' })).toBeDefined()
  expect(form.getByLabelText('Đã có phản hồi · Thiếu dữ liệu · Cột Email').textContent).toBe('✓')
  expect(within(screen.getByRole('status', { name: 'Kết quả thao tác' })).getByText('Đã gửi phản hồi.')).toBeDefined()
  expect(form.queryByText('Đã gửi phản hồi.')).toBeNull()
  expect(await form.findByText('Đã kiểm tra cột Email')).toBeDefined()
  expect(request).toHaveBeenCalledWith(expect.objectContaining({
    path: findingPath, method: 'POST',
    data: { label: 'correct', reason: 'Đã kiểm tra cột Email', suggestedSeverity: null },
  }))
  expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ path: `/analyses/${analysisRunId}/feedback` }))
  fireEvent.click(form.getByLabelText('Đã có phản hồi · Thiếu dữ liệu · Cột Email'))
  fireEvent.click(form.getByLabelText('Đã có phản hồi · Thiếu dữ liệu · Cột Email'))
  fireEvent.click(await form.findByRole('button', { name: 'Thao tác phản hồi của Bạn' }))
  fireEvent.click(form.getByRole('button', { name: 'Xóa' }))
  fireEvent.click(form.getByRole('button', { name: 'Xác nhận xóa' }))
  expect(await form.findByText('Feedback')).toBeDefined()
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
