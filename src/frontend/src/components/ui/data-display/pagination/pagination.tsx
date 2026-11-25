import { Icon } from '../../primitives/icon'
import styles from './pagination.module.css'

export type PaginationProps = {
  label: string
  total: number
  page: number
  perPage: number
  onPage: (page: number) => void
  unit?: string
  perPageOptions?: readonly number[]
  onPerPage?: (size: number) => void
  hideWhenEmpty?: boolean
  hideWhenSinglePage?: boolean
}

export function Pagination({ label, total, page, perPage, onPage, unit, perPageOptions, onPerPage, hideWhenEmpty, hideWhenSinglePage }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / perPage))
  const safePage = Math.min(page, pageCount)
  if (total === 0 && hideWhenEmpty) return null
  if (pageCount <= 1 && hideWhenSinglePage) return null
  return <nav className={`${styles['root']} pagination`} aria-label={label}>
    {unit && <span className="pagination-info">Hiển thị {total === 0 ? 0 : (safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, total)} của {total} {unit}</span>}
    <div className="pagination-controls">
      <button type="button" className="icon-button flip" aria-label="Trang trước" disabled={safePage === 1}
        onClick={() => onPage(Math.max(1, safePage - 1))}><Icon name="chevron" /></button>
      {Array.from({ length: pageCount }, (_unused, index) => index + 1).map(number =>
        <button type="button" key={number} className={`page-button${number === safePage ? ' is-active' : ''}`}
          aria-current={number === safePage ? 'page' : undefined} onClick={() => onPage(number)}>{number}</button>)}
      <button type="button" className="icon-button" aria-label="Trang sau" disabled={safePage === pageCount}
        onClick={() => onPage(Math.min(pageCount, safePage + 1))}><Icon name="chevron" /></button>
    </div>
    {perPageOptions && onPerPage && <label className="chip-select inline">
      <span className="chip-label" aria-hidden="true">Số dòng</span>
      <select aria-label="Số dòng mỗi trang" value={String(perPage)} onChange={event => onPerPage(Number(event.target.value))}>
        {perPageOptions.map(size => <option key={size} value={size}>{size}</option>)}
      </select>
    </label>}
  </nav>
}
