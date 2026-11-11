import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ProjectWorkspaceView } from '../../views/preview/project-workspace-2d.view'
import { ProjectResultActions, ProjectResultDownload } from '../../views/preview/components/project-data-actions'
import { ResultReviewDialog } from '../../views/preview/components/result-review-dialog'
import { validateResultReview } from '../../services/processing/result-review'
import { previewMockStore } from '../../services/preview/preview-mock.service'
import { renderFrame } from './preview-test-kit'
vi.mock('../../views/dataset-3d/dataset-3d.view', () => ({
  Dataset3DView: ({ onFocusComplete }: { onFocusComplete: (theme: string) => void }) => <button onClick={() => onFocusComplete('orange')}>Focus hoàn tất</button>,
}))

beforeEach(() => { previewMockStore.reset(); window.localStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('opens local file selection only when the project has no dataset, without faking upload', () => {
  renderFrame(<ProjectWorkspaceView projectId="prj-empty" />)
  fireEvent.click(screen.getByRole('button', { name: 'Upload data' }))
  const dialog = screen.getByRole('dialog', { name: 'Upload data' })
  const file = new File(['id,value\n1,2'], 'sample.csv', { type: 'text/csv' })
  fireEvent.change(within(dialog).getByLabelText('Chọn tệp dữ liệu'), { target: { files: [file] } })
  expect(within(dialog).getByText(/Đã chọn trên thiết bị: sample.csv/)).toBeDefined()
  expect((within(dialog).getByRole('button', { name: 'Upload data' }) as HTMLButtonElement).disabled).toBe(true)
  expect(previewMockStore.getState().projects.find(project => project.id === 'prj-empty')?.dataset).toBeNull()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('does not infer a confirmed result from a sample dataset status', () => {
  renderFrame(<ProjectWorkspaceView projectId="prj-sales" />)
  expect(screen.queryByRole('button', { name: 'Upload data' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Detection' }))
  expect(screen.queryByRole('button', { name: 'Đánh giá và lưu kết quả' })).toBeNull()
  fireEvent.click(screen.getByText('Focus hoàn tất'))
  expect((screen.getByRole('button', { name: 'Đánh giá và lưu kết quả' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText(/Chưa có kết quả xử lý được xác nhận/)).toBeDefined()
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('downloads only a supplied processed result and exposes failure/retry', async () => {
  const download = vi.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValue(undefined)
  const view = render(<ProjectResultDownload result={null} />)
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
  view.rerender(<ProjectResultDownload result={{ id: 'result', save: vi.fn(), download }} />)
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('alert')).toBeDefined()
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(download).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
})

it.each([0, 6, 1.5, NaN])('rejects invalid star value %s', rating => {
  expect(validateResultReview({ rating, comment: 'Đã kiểm tra' })).toBe('Vui lòng chọn từ 1 đến 5 sao.')
})

it('requires stars and a nonblank comment before invoking persistence', () => {
  const save = vi.fn().mockResolvedValue(undefined)
  render(<ResultReviewDialog result={{ id: 'confirmed-result', save }} onClose={vi.fn()} onSaved={vi.fn()} />)
  const dialog = screen.getByRole('dialog')
  fireEvent.submit(dialog)
  expect(screen.getByRole('alert').textContent).toContain('1 đến 5 sao')
  fireEvent.click(screen.getByRole('radio', { name: '4 sao' }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
  fireEvent.submit(dialog)
  expect(screen.getByRole('alert').textContent).toContain('nội dung đánh giá')
  expect(save).not.toHaveBeenCalled()
})

it('retains the review on persistence failure and enables optional download only after retry succeeds', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(undefined)
  const download = vi.fn().mockResolvedValue(undefined)
  render(<ProjectResultActions result={{ id: 'confirmed-result', save, download }} />)
  const downloadButton = screen.getByRole('button', { name: 'Tải file (tùy chọn)' }) as HTMLButtonElement
  expect(downloadButton.disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Đánh giá và lưu kết quả' }))
  fireEvent.click(screen.getByRole('radio', { name: '5 sao' }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Kết quả phù hợp  ' } })
  fireEvent.submit(screen.getByRole('dialog'))
  expect(await screen.findByRole('alert')).toBeDefined()
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('  Kết quả phù hợp  ')
  expect((screen.getByRole('radio', { name: '5 sao' }) as HTMLInputElement).checked).toBe(true)
  expect(downloadButton.disabled).toBe(true)
  expect(download).not.toHaveBeenCalled()
  fireEvent.submit(screen.getByRole('dialog'))
  await screen.findByText('Đã lưu đánh giá và kết quả vào hệ thống.')
  expect(save).toHaveBeenLastCalledWith({ rating: 5, comment: 'Kết quả phù hợp' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(downloadButton.disabled).toBe(false)
  fireEvent.click(downloadButton)
  await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
})

it('prevents duplicate saves while waiting for server acknowledgement', async () => {
  let acknowledge!: () => void
  const save = vi.fn(() => new Promise<void>(resolve => { acknowledge = resolve }))
  const onSaved = vi.fn()
  const onClose = vi.fn()
  render(<ResultReviewDialog result={{ id: 'confirmed-result', save }} onClose={onClose} onSaved={onSaved} />)
  fireEvent.click(screen.getByRole('radio', { name: '3 sao' }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Cần xem xét thêm' } })
  fireEvent.submit(screen.getByRole('dialog'))
  fireEvent.submit(screen.getByRole('dialog'))
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(save).toHaveBeenCalledTimes(1)
  expect(onClose).not.toHaveBeenCalled()
  expect(onSaved).not.toHaveBeenCalled()
  await act(async () => { acknowledge() })
  expect(onSaved).toHaveBeenCalledTimes(1)
})
