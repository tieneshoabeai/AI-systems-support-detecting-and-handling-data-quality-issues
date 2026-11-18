import { useEffect, useState } from 'react'
import { Button, Input, Select } from '../../../../components/ui/controls'
import { useManagementStore } from '../../../../hooks/preview/use-preview-store'
import type { ColumnStats, DatasetColumn, RecordPage, RecordQuery } from '../../../../services/processing/dataset.service'
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

export function LiveDatasetPanel({ project, overview = false }: { project: Project; overview?: boolean }) {
  const service = useManagementStore().datasetService
  const dataset = project.dataset
  const id = dataset?.id
  const [columns, setColumns] = useState<DatasetColumn[]>([])
  const [page, setPage] = useState<RecordPage | null>(null)
  const [query, setQuery] = useState<RecordQuery>({ limit: 50 })
  const [history, setHistory] = useState<RecordQuery[]>([])
  const [search, setSearch] = useState('')
  const [column, setColumn] = useState('')
  const [sort, setSort] = useState('')
  const [filter, setFilter] = useState<FilterOperator | ''>('')
  const [filterValue, setFilterValue] = useState('')
  const [renamed, setRenamed] = useState('')
  const [stats, setStats] = useState<ColumnStats | null>(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!id || !service) return
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
  }, [id, service, query, overview, attempt])
  if (!dataset) return <p>Project chưa có tập dữ liệu. Hãy tải CSV lên trước.</p>
  if (!service || !id) return <p>Dịch vụ dữ liệu chưa sẵn sàng.</p>
  const selectedColumn = column || columns[0]?.key || ''
  const action = async (operation: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setActionError('')
    try { await operation() } catch (cause) { setActionError(message(cause)) } finally { setBusy(false) }
  }
  const reload = () => { setLoading(true); setError(''); setAttempt(value => value + 1) }
  const download = async () => {
    const blob = await service.download(id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = dataset.fileName; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="project-module-review" aria-label={overview ? 'Tổng quan tập dữ liệu' : 'Bản ghi dữ liệu'}>
    <p><strong>{dataset.fileName}</strong> · {dataset.rows.toLocaleString('vi-VN')} dòng · {dataset.columns} cột</p>
    <div className="form-actions">
      <Button disabled={busy} onClick={() => { void action(download) }}>Tải CSV gốc</Button>
      <Button disabled={loading || busy} onClick={reload}>Tải lại</Button>
    </div>
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
      <label>Cột <Select value={selectedColumn} onChange={event => { setColumn(event.target.value); setStats(null); setRenamed('') }}>
        {columns.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
      </Select></label>
      <label>Tìm kiếm <Input value={search} maxLength={200} onChange={event => setSearch(event.target.value)} /></label>
      <label>Sắp xếp <Select value={sort} onChange={event => setSort(event.target.value)}>
        <option value="">Theo thứ tự dòng</option><option value="asc">Tăng dần</option><option value="desc">Giảm dần</option>
      </Select></label>
      <label>Điều kiện lọc <Select value={filter} onChange={event => {
        const selected = operators.find(([operator]) => operator === event.target.value)
        setFilter(selected?.[0] ?? '')
      }}><option value="">Không lọc</option>{operators.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
      {filter && filter !== 'isEmpty' && filter !== 'isNotEmpty' && <label>Giá trị lọc
        <Input value={filterValue} onChange={event => setFilterValue(event.target.value)}
          placeholder={filter === 'between' ? '[10, 20]' : filter === 'in' ? '["A", "B"]' : 'Nhập giá trị'} />
      </label>}
      <Button type="submit" disabled={loading || !selectedColumn}>Áp dụng</Button>
    </form>}
    {overview ? <dl>{columns.map(c => <div key={c.key}><dt>{c.name}</dt><dd>{c.dataType}</dd></div>)}</dl>
      : page && !loading && !error && <>
        <div className="table-scroll"><table className="preview-table"><thead><tr><th>Dòng</th>{columns.map(c => <th key={c.key}>{c.name}</th>)}</tr></thead>
          <tbody>{page.items.map(row => <tr key={row.rowIndex}><td>{row.rowIndex}</td>{columns.map(c => <td key={c.key}>{cell(row.props[c.key])}</td>)}</tr>)}</tbody>
        </table></div>
        {!page.items.length && <p>Không có bản ghi phù hợp.</p>}
        <div className="form-actions">
          <Button disabled={!history.length} onClick={() => {
            const previous = history.at(-1)
            if (previous) { setQuery(previous); setHistory(items => items.slice(0, -1)); setLoading(true) }
          }}>Trang trước</Button>
          <span>Trang {history.length + 1}</span>
          <Button disabled={!page.meta.hasMore} onClick={() => {
            if (!page.meta.nextCursor) return
            if (page.meta.nextCursor === query.cursor || history.some(item => item.cursor === page.meta.nextCursor)) {
              setActionError('Máy chủ trả cursor lặp lại. Hãy tải lại dữ liệu.'); return
            }
            setHistory(items => [...items, query]); setQuery({ ...query, cursor: page.meta.nextCursor }); setLoading(true)
          }}>Trang tiếp</Button>
        </div>
      </>}
    {!overview && selectedColumn && <>
      <Button disabled={busy} onClick={() => { void action(async () => {
        setStats(await service.stats(id, selectedColumn, new AbortController().signal))
      }) }}>Thống kê cột đã chọn</Button>
      {stats && <dl>
        <div><dt>Cột</dt><dd>{stats.column_name}</dd></div>
        <div><dt>Số bản ghi</dt><dd>{stats.total_records}</dd></div>
        <div><dt>Giá trị thiếu</dt><dd>{stats.null_count} ({(stats.missing_ratio * 100).toFixed(2)}%)</dd></div>
        {stats.min !== undefined && <div><dt>Nhỏ nhất</dt><dd>{stats.min}</dd></div>}
        {stats.max !== undefined && <div><dt>Lớn nhất</dt><dd>{stats.max}</dd></div>}
        {stats.average !== undefined && <div><dt>Trung bình</dt><dd>{stats.average}</dd></div>}
      </dl>}
      {project.canManage && <form onSubmit={event => {
        event.preventDefault(); void action(async () => {
          await service.renameColumns(id, { columns: [{ key: selectedColumn, name: renamed.trim() }] })
          setRenamed(''); reload()
        })
      }}>
        <label>Tên hiển thị mới <Input value={renamed} maxLength={120} onChange={event => setRenamed(event.target.value)} /></label>
        <Button type="submit" disabled={busy || !renamed.trim()}>Đổi tên cột</Button>
        <Button type="button" disabled={busy} onClick={() => { void action(async () => { await service.resetColumns(id); reload() }) }}>Khôi phục tên cột gốc</Button>
      </form>}
    </>}
  </section>
}
