import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { AnalysisService } from '../../services/processing/analysis.service'
import { AnalysisEvidenceSamples } from '../../views/processing/project/sections/analysis-evidence-samples'

const runId = '123456789012345678901234'
const findingId = 'DQ-01:Email'
const emptyPage = { items: [], meta: { limit: 20, hasMore: false, nextCursor: null } }

afterEach(cleanup)

function service(respond: () => unknown | Promise<unknown> = () => undefined) {
  const listEvidenceSamples = vi.fn(async () => await respond())
  return { listEvidenceSamples } as unknown as AnalysisService
}

it('loads samples only when opened, validates the response and displays masked evidence with a one-based row', async () => {
  const analysisService = service(() => ({
    items: [{ findingId, kind: 'missing', column: 'Email', rowIndex: 0, reason: 'DQ01_MISSING', valueMasked: null }],
    meta: { limit: 20, hasMore: false, nextCursor: null },
  }))
  render(<AnalysisEvidenceSamples runId={runId} findingId={findingId} service={analysisService} />)

  expect(analysisService.listEvidenceSamples).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Xem samples' }))

  const table = await screen.findByRole('table')
  expect(within(table).getByRole('row', { name: /1 Email Ô trống Thiếu dữ liệu/ })).toBeDefined()
  expect(screen.getByText(/API dùng rowIndex bắt đầu từ 0/)).toBeDefined()
  expect(analysisService.listEvidenceSamples).toHaveBeenCalledExactlyOnceWith(
    runId,
    { findingId, limit: 20 },
    expect.any(AbortSignal),
  )
})

it('distinguishes an empty saved-samples result from a failed request and retries the failed request', async () => {
  const emptyService = service(() => emptyPage)
  const emptyView = render(<AnalysisEvidenceSamples runId={runId} findingId={findingId} service={emptyService} />)
  fireEvent.click(screen.getByRole('button', { name: 'Xem samples' }))
  expect(await screen.findByText('Không có sample được lưu cho finding này.')).toBeDefined()
  emptyView.unmount()

  const failedList = vi.fn<AnalysisService['listEvidenceSamples']>()
    .mockRejectedValueOnce(new Error('Máy chủ tạm thời không khả dụng'))
    .mockResolvedValueOnce(emptyPage as never)
  const failedService = { listEvidenceSamples: failedList } as unknown as AnalysisService
  render(<AnalysisEvidenceSamples runId={runId} findingId={findingId} service={failedService} />)
  fireEvent.click(screen.getByRole('button', { name: 'Xem samples' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Không tải được samples.')
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Không có sample được lưu cho finding này.')).toBeDefined()
  expect(failedService.listEvidenceSamples).toHaveBeenCalledTimes(2)
})

it('requests subsequent pages with the returned cursor and appends the validated results', async () => {
  const listEvidenceSamples = vi.fn()
    .mockResolvedValueOnce({
      items: [{ findingId, kind: 'missing', column: 'Email', rowIndex: 4, reason: 'Thiếu', valueMasked: null }],
      meta: { limit: 1, hasMore: true, nextCursor: 'page-cursor-1' },
    })
    .mockResolvedValueOnce({
      items: [{ findingId, kind: 'missing', column: 'Email', rowIndex: 8, reason: 'Thiếu', valueMasked: null }],
      meta: { limit: 1, hasMore: false, nextCursor: null },
    })
  const analysisService = { listEvidenceSamples } as unknown as AnalysisService
  render(<AnalysisEvidenceSamples runId={runId} findingId={findingId} service={analysisService} />)
  fireEvent.click(screen.getByRole('button', { name: 'Xem samples' }))
  const table = await screen.findByRole('table')
  expect(within(table).getByRole('row', { name: /5 Email Ô trống Thiếu/ })).toBeDefined()

  fireEvent.click(screen.getByRole('button', { name: 'Xem thêm samples' }))
  expect(await within(table).findByRole('row', { name: /9 Email Ô trống Thiếu/ })).toBeDefined()
  expect(listEvidenceSamples.mock.calls[1]?.[1]).toEqual({ findingId, limit: 20, cursor: 'page-cursor-1' })
  expect(screen.queryByRole('button', { name: 'Xem thêm samples' })).toBeNull()
})

it('rejects a response containing a raw value instead of rendering it', async () => {
  const rawValue = 'alice@example.com'
  const analysisService = service(() => ({
    items: [{ findingId, kind: 'missing', column: 'Email', rowIndex: 2, reason: 'reason', valueMasked: rawValue }],
    meta: { limit: 20, hasMore: false, nextCursor: null },
  }))
  render(<AnalysisEvidenceSamples runId={runId} findingId={findingId} service={analysisService} />)
  fireEvent.click(screen.getByRole('button', { name: 'Xem samples' }))

  expect((await screen.findByRole('alert')).textContent).toContain('Không tải được samples.')
  expect(screen.queryByText(rawValue)).toBeNull()
  expect(screen.queryByRole('table')).toBeNull()
})
