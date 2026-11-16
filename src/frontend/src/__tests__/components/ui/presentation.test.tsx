import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Badge } from '../../../components/ui/primitives/badge'
import { Alert } from '../../../components/ui/feedback/alert'
import { EmptyState } from '../../../components/ui/feedback/empty-state'
import { Skeleton } from '../../../components/ui/feedback/skeleton'
import { Panel } from '../../../components/ui/layout/panel'
import { FullPageStatus } from '../../../components/ui/layout/full-page-status'
import { BrandLockup } from '../../../components/ui/brand/brand-lockup'
import { Tabs } from '../../../components/ui/data-display/tabs'
import { Pagination } from '../../../components/ui/data-display/pagination'

afterEach(cleanup)

it('renders caller-owned badge text and alert semantics without inferring a domain status', () => {
  render(<><Badge tone="warn">Chờ kiểm tra</Badge><Alert role="status">Mất kết nối</Alert></>)
  expect(screen.getByText('Chờ kiểm tra').classList.contains('status-warn')).toBe(true)
  expect(screen.getByRole('status').textContent).toBe('Mất kết nối')
})

it('renders empty state and keeps skeleton decoration out of the accessibility tree', () => {
  const { container } = render(<><EmptyState title="Trống" note="Chưa có bản ghi" /><Skeleton data-testid="skeleton" /></>)
  expect(screen.getByRole('status').textContent).toContain('Chưa có bản ghi')
  expect(screen.getByTestId('skeleton').getAttribute('aria-hidden')).toBe('true')
  expect(container.querySelector('.skeleton-block')).not.toBeNull()
})

it('composes panel actions, full-page content and caller-provided branding', () => {
  render(<FullPageStatus><BrandLockup logo={<svg data-testid="logo" />}>DataVerse</BrandLockup>
    <Panel title="Tổng quan" action={<button>Tạo</button>}>Nội dung</Panel></FullPageStatus>)
  expect(screen.getByRole('main').classList.contains('session-wait')).toBe(true)
  expect(screen.getByTestId('logo').nextElementSibling?.textContent).toBe('DataVerse')
  expect(screen.getByRole('heading', { name: 'Tổng quan' })).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Tạo' })).not.toBeNull()
})

it('preserves filter/detail tab variants and selected state', () => {
  const onChange = vi.fn()
  render(<Tabs label="Bộ lọc" variant="detail" tabs={[{ id: 'all', label: 'Tất cả' }, { id: 'mine', label: 'Của tôi' }]} active="all" onChange={onChange} />)
  expect(screen.getByRole('tab', { name: 'Tất cả' }).getAttribute('aria-selected')).toBe('true')
  expect(screen.getByRole('tablist').classList.contains('detail-tabs')).toBe(true)
  fireEvent.click(screen.getByRole('tab', { name: 'Của tôi' }))
  expect(onChange).toHaveBeenCalledWith('mine')
})

it('preserves pagination boundaries, page-size changes and empty/single-page visibility', () => {
  const onPage = vi.fn()
  const onPerPage = vi.fn()
  const view = render(<Pagination label="Phân trang" total={21} page={1} perPage={10} onPage={onPage} perPageOptions={[10, 20]} onPerPage={onPerPage} />)
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Trang trước' }).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(onPage).toHaveBeenCalledWith(2)
  fireEvent.change(screen.getByRole('combobox', { name: 'Số dòng mỗi trang' }), { target: { value: '20' } })
  expect(onPerPage).toHaveBeenCalledWith(20)
  view.rerender(<Pagination label="Phân trang" total={0} page={1} perPage={10} onPage={onPage} hideWhenEmpty />)
  expect(screen.queryByRole('navigation')).toBeNull()
  view.rerender(<Pagination label="Phân trang" total={1} page={1} perPage={10} onPage={onPage} hideWhenSinglePage />)
  expect(screen.queryByRole('navigation')).toBeNull()
})
