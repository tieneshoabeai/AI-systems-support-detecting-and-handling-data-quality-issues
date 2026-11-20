import { useEffect, useState } from 'react'
import { Dialog } from '../../../../components/ui/overlay/dialog'
import { useManagementStore } from '../../../../hooks/preview/use-preview-store'
import { firstRecordQuery, type ColumnStats, type DatasetColumn, type DatasetPreview, type RecordPage, type RecordQuery } from '../../../../services/processing/dataset.service'
import type { Project } from '../../../../types/preview/preview.types'

const message = (error: unknown) => error instanceof Error ? error.message : 'Không tải được dữ liệu.'
type FilterOperator = NonNullable<RecordQuery['filters']>[number]['operator']
const operators: [FilterOperator, string][] = [
  ['equals', 'Bằng'], ['notEquals', 'Khác'], ['contains', 'Chứa'], ['notContains', 'Không chứa'],
  ['startsWith', 'Bắt đầu bằng'], ['endsWith', 'Kết thúc bằng'], ['greaterThan', 'Lớn hơn'],
  ['greaterThanOrEqual', 'Lớn hơn hoặc bằng'], ['lessThan', 'Nhỏ hơn'], ['lessThanOrEqual', 'Nhỏ hơn hoặc bằng'],
  ['between', 'Trong khoảng'], ['in', 'Thuộc danh sách'], ['isEmpty', 'Trống'], ['isNotEmpty', 'Không trống'],
]
const cell = (value: unknown): string => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  return JSON.stringify(value) ?? '—'
}

export function LiveDatasetPanel({ project, overview = false, initialPreview, onInvalidatePreview }: {
  project: Project; overview?: boolean; initialPreview?: DatasetPreview | null; onInvalidatePreview?: () => void
}) {
  const store = useManagementStore()
  const service = store.datasetService
  const dataset = project.dataset
  const id = dataset?.id
  const [columns, setColumns] = useState<DatasetColumn[]>(initialPreview?.columns ?? [])
  const [page, setPage] = useState<RecordPage | null>(overview ? null : initialPreview?.page ?? null)
  const [query, setQuery] = useState<RecordQuery>(firstRecordQuery)
  const [history, setHistory] = useState<RecordQuery[]>([])
  const [search, setSearch] = useState('')
  const [column, setColumn] = useState('')
  const [sort, setSort] = useState('')
  const [filter, setFilter] = useState<FilterOperator | ''>('')
  const [filterValue, setFilterValue] = useState('')
  const [stats, setStats] = useState<ColumnStats | null>(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [loading, setLoading] = useState(!initialPreview)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [detail, setDetail] = useState<Awaited<ReturnType<NonNullable<typeof service>['detail']>> | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!overview || !id || !service) return
    const controller = new AbortController()
    void service.detail(id, controller.signal).then(value => {
      if (!controller.signal.aborted) setDetail(value)
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setActionError(message(cause))
    })
    return () => controller.abort()
  }, [overview, id, service, attempt])
  useEffect(() => {
    if (!id || !service || (initialPreview && attempt === 0 && query === firstRecordQuery)) return
    const controller = new AbortController()
    void Promise.all([
      service.schema(id, controller.signal),
      overview ? Promise.resolve(null) : service.records(id, query, controller.signal),
    ]).then(([schema, rows]) => {
      if (controller.signal.aborted) return
      setColumns(schema); setPage(rows); setError(''); setLoading(false)
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) { setError(message(cause)); setLoading(false) }
    })
    return () => controller.abort()
  }, [id, service, query, overview, attempt, initialPreview])
  if (!dataset) return <p>Project chưa có tập dữ liệu. Hãy tải CSV lên trước.</p>
  if (!service || !id) return <p>Dịch vụ dữ liệu chưa sẵn sàng.</p>
  const activeColumn = columns.find(item => item.key === column) ?? columns[0]
  const selectedColumn = activeColumn?.key ?? ''
  const action = async (operation: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setActionError('')
    try { await operation() } catch (cause) { setActionError(message(cause)) } finally { setBusy(false) }
  }
  const reload = () => { onInvalidatePreview?.(); setLoading(true); setError(''); setAttempt(value => value + 1) }
  const download = async () => {
    const blob = await service.download(id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = dataset.fileName; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="project-module-review" aria-label={overview ? 'Tổng quan tập dữ liệu' : 'Bản ghi dữ liệu'}>
    <p><strong>{detail?.name ?? dataset.fileName}</strong> · {(detail?.rowCount ?? dataset.rows).toLocaleString('vi-VN')} dòng · {detail?.columnCount ?? dataset.columns} cột</p>
    <div className="form-actions">
      <button disabled={busy} onClick={() => { void action(download) }}>Tải CSV gốc</button>
      <button disabled={loading || busy} onClick={reload}>Tải lại</button>
      {project.canManage && store.refreshProject && <button disabled={busy} onClick={() => setConfirmDelete(true)}>Xóa dataset</button>}
    </div>
    <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} busy={busy} aria-labelledby="delete-dataset-title">
      <h2 id="delete-dataset-title">Xóa dataset?</h2>
      <p>Dataset sẽ bị xóa mềm khỏi Project. Dữ liệu không thể dùng trong Data View sau thao tác này.</p>
      {actionError && <p role="alert">{actionError}</p>}
      <div className="form-actions">
        <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>Hủy</button>
        <button type="button" disabled={busy} onClick={() => {
          void action(async () => {
            await service.delete(id)
            onInvalidatePreview?.()
            try { await store.refreshProject?.(project.id, new AbortController().signal) } catch {
              setConfirmDelete(false)
              throw new Error('Đã xóa dataset trên máy chủ nhưng chưa tải lại được Project. Hãy tải lại trang, không gửi lại thao tác.')
            }
            setConfirmDelete(false)
          })
        }}>Xác nhận xóa</button>
      </div>
    </Dialog>
    {loading && <p role="status">Đang tải dữ liệu từ máy chủ.</p>}
    {error && <p role="alert">{error}</p>}
    {actionError && <p role="alert">{actionError}</p>}
    {!overview && <form className="settings-form" onSubmit={event => {
      event.preventDefault()
      let filters: NonNullable<RecordQuery['filters']> = []
      try {
        if (filter && selectedColumn) {
          let value: unknown = filterValue
          if (filter !== 'isEmpty' && filter !== 'isNotEmpty') {
            if (!filterValue.trim()) throw new Error('Hãy nhập giá trị lọc.')
            if (filter === 'between' || filter === 'in') {
              value = JSON.parse(filterValue) as unknown
              if (!Array.isArray(value) || !value.length || (filter === 'between' && value.length !== 2)) throw new Error('Nhập mảng JSON hợp lệ; khoảng cần đúng 2 giá trị.')
            } else if (columns.find(c => c.key === selectedColumn)?.dataType === 'number') {
              value = Number(filterValue)
              if (!Number.isFinite(value)) throw new Error('Giá trị lọc phải là số hợp lệ.')
            }
          }
          filters = [{ column: selectedColumn, operator: filter, ...(filter === 'isEmpty' || filter === 'isNotEmpty' ? {} : { value }) }]
        }
      } catch (cause) { setActionError(message(cause)); return }
      setActionError(''); setHistory([]); setLoading(true); setPage(null)
      setQuery({ limit: 50, ...(search && selectedColumn ? { search: { columns: [selectedColumn], value: search } } : {}),
        filters, ...(sort && selectedColumn ? { sort: [{ column: selectedColumn, order: sort === 'desc' ? 'desc' : 'asc' }] } : {}) })
    }}>
      <label>Cột <select value={selectedColumn} onChange={event => { setColumn(event.target.value); setStats(null) }}>
        {columns.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
      </select></label>
      <label>Tìm kiếm <input value={search} maxLength={200} onChange={event => setSearch(event.target.value)} /></label>
      <label>Sắp xếp <select value={sort} onChange={event => setSort(event.target.value)}>
        <option value="">Theo thứ tự dòng</option><option value="asc">Tăng dần</option><option value="desc">Giảm dần</option>
      </select></label>
      <label>Điều kiện lọc <select value={filter} onChange={event => {
        const selected = operators.find(([operator]) => operator === event.target.value)
        setFilter(selected?.[0] ?? '')
      }}><option value="">Không lọc</option>{operators.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {filter && filter !== 'isEmpty' && filter !== 'isNotEmpty' && <label>Giá trị lọc
        <input value={filterValue} onChange={event => setFilterValue(event.target.value)}
          placeholder={filter === 'between' ? '[10, 20]' : filter === 'in' ? '["A", "B"]' : 'Nhập giá trị'} />
      </label>}
      <button type="submit" disabled={loading || !selectedColumn}>Áp dụng</button>
    </form>}
    {overview ? <dl>{columns.map(c => <div key={c.key}><dt>{c.name}</dt><dd>{c.dataType}{c.isPii && ' · PII'}</dd></div>)}</dl>
      : page && !loading && !error && <>
        <div className="table-scroll"><table className="preview-table"><thead><tr><th>Dòng</th>{columns.map(c => <th key={c.key}>{c.name}</th>)}</tr></thead>
          <tbody>{page.items.map(row => <tr key={row.rowIndex}><td>{row.rowIndex}</td>{columns.map(c => <td key={c.key}>{cell(row.props[c.key])}</td>)}</tr>)}</tbody>
        </table></div>
        {!page.items.length && <p>Không có bản ghi phù hợp.</p>}
        <div className="form-actions">
          <button disabled={!history.length} onClick={() => {
            const previous = history.at(-1)
            if (previous) { setQuery(previous); setHistory(items => items.slice(0, -1)); setLoading(true) }
          }}>Trang trước</button>
          <span>Trang {history.length + 1}</span>
          <button disabled={!page.meta.hasMore} onClick={() => {
            if (!page.meta.nextCursor) return
            if (page.meta.nextCursor === query.cursor || history.some(item => item.cursor === page.meta.nextCursor)) {
              setActionError('Máy chủ trả cursor lặp lại. Hãy tải lại dữ liệu.'); return
            }
            setHistory(items => [...items, query]); setQuery({ ...query, cursor: page.meta.nextCursor }); setLoading(true)
          }}>Trang tiếp</button>
        </div>
      </>}
    {!overview && selectedColumn && <>
      <button disabled={busy} onClick={() => { void action(async () => {
        setStats(await service.stats(id, selectedColumn, new AbortController().signal))
      }) }}>Thống kê cột đã chọn</button>
      {stats && <dl>
        <div><dt>Cột</dt><dd>{stats.column_name}</dd></div>
        <div><dt>Số bản ghi</dt><dd>{stats.total_records}</dd></div>
        <div><dt>Giá trị thiếu</dt><dd>{stats.null_count} ({(stats.missing_ratio * 100).toFixed(2)}%)</dd></div>
        {stats.min !== undefined && <div><dt>Nhỏ nhất</dt><dd>{stats.min}</dd></div>}
        {stats.max !== undefined && <div><dt>Lớn nhất</dt><dd>{stats.max}</dd></div>}
        {stats.average !== undefined && <div><dt>Trung bình</dt><dd>{stats.average}</dd></div>}
      </dl>}
      {activeColumn && <p>{activeColumn.isPii ? 'Cột được đánh dấu là PII.' : 'Cột chưa được đánh dấu là PII.'}</p>}
      {project.canUpdateDatasetMetadata && activeColumn && <button disabled={busy || loading || Boolean(error)} onClick={() => {
        void action(async () => {
          await service.updateColumnPii(id, activeColumn.key, !activeColumn.isPii)
          reload()
        })
      }}>{activeColumn.isPii ? 'Bỏ đánh dấu PII' : 'Đánh dấu là PII'}</button>}
    </>}
  </section>
}
