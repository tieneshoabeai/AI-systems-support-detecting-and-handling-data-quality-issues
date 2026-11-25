import { Button } from '../../../../components/ui/primitives/button'
import { Input } from '../../../../components/ui/primitives/input'
import { Select } from '../../../../components/ui/form/select'
import { useEffect, useRef, useState } from 'react'
import { Dialog } from '../../../../components/ui/overlay/dialog'
import { useManagementStore } from '../../../../hooks/management/use-management-store'
import { firstRecordQuery, type RecordQuery } from '../../../../services/processing/dataset.service'
import type { ColumnChart, ColumnStats, DatasetColumn, DatasetPreview, RecordPage } from '../../../../types/processing/dataset-records.types'
import type { Project } from '../../../../types/management/management.types'
import { DatasetDistribution } from './dataset-distribution'
import { Icon } from '../../../../components/ui/primitives/icon'
import { ModuleNotice } from './module-notice'
import styles from './module-content.module.css'
import { QueuedWriteError } from '../../../../services/offline/queued-write-error'

const message = (error: unknown) => error instanceof Error ? error.message : 'Không tải được dữ liệu.'
const count = new Intl.NumberFormat('vi-VN')
const typeLabels: Record<string, string> = { number: 'Số', string: 'Văn bản', date: 'Ngày giờ', boolean: 'Đúng/Sai' }
const labelForType = (type: string) => Object.hasOwn(typeLabels, type) ? typeLabels[type] : type

function SchemaTypes({ columns }: { columns: readonly DatasetColumn[] }) {
  const types = new Map<string, number>()
  for (const column of columns) types.set(column.dataType, (types.get(column.dataType) ?? 0) + 1)
  return <ul className={styles['schemaTypes']} aria-label="Số cột theo kiểu dữ liệu">
    {Array.from(types.entries()).sort((a, b) => b[1] - a[1]).map(([type, value]) => <li key={type}>
      <span>{labelForType(type)}</span>
      <span className={styles['typeTrack']} aria-hidden="true"><span style={{ width: `${value / columns.length * 100}%` }} /></span>
      <strong>{count.format(value)} cột</strong>
    </li>)}
  </ul>
}
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
  const [stats, setStats] = useState<{ datasetId: string; column: string; value: ColumnStats; chart: ColumnChart | null } | null>(null)
  const [statsRequestColumn, setStatsRequestColumn] = useState<string | null>(null)
  const statsRequest = useRef<AbortController | null>(null)
  useEffect(() => () => statsRequest.current?.abort(), [id, service])
  const [statsError, setStatsError] = useState<{ column: string; message: string } | null>(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [pendingNotice, setPendingNotice] = useState('')
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
  if (!dataset) return <ModuleNotice>Project chưa có tập dữ liệu. Hãy tải CSV lên trước.</ModuleNotice>
  if (!service || !id) return <ModuleNotice>Dịch vụ dữ liệu chưa sẵn sàng.</ModuleNotice>
  const activeColumn = columns.find(item => item.key === column) ?? columns[0]
  const selectedColumn = activeColumn?.key ?? ''
  const action = async (operation: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setActionError(''); setPendingNotice('')
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
  return <section className={styles['stack']} aria-label={overview ? 'Tổng quan tập dữ liệu' : 'Bản ghi dữ liệu'}>
    {pendingNotice && <p role="status">{pendingNotice}</p>}
    <section className={styles['card']} aria-label="Thông tin tập dữ liệu">
      <div className={styles['datasetName']}>
        <span className={styles['iconTile']}><Icon name="file" /></span>
        <div><h3>{detail?.name ?? dataset.fileName}</h3><p className={styles['muted']}>Tập dữ liệu của Project</p></div>
      </div>
      <dl className={styles['metrics']}>
        <div><dt>Số dòng</dt><dd>{count.format(detail?.rowCount ?? dataset.rows)}</dd></div>
        <div><dt>Số cột</dt><dd>{count.format(detail?.columnCount ?? dataset.columns)}</dd></div>
        {overview && columns.length > 0 && <div><dt>Cột có cờ PII</dt><dd>{count.format(columns.filter(item => item.isPii).length)}</dd></div>}
      </dl>
      <div className={styles['actions']}>
        <Button variant="secondary" disabled={busy} onClick={() => { void action(download) }}><Icon name="export" /> Tải CSV gốc</Button>
        <Button variant="secondary" disabled={loading || busy} onClick={reload}><Icon name="reset" /> Tải lại</Button>
        {project.canManage && store.refreshProject && <Button variant="plain" className="ghost-button" disabled={busy} onClick={() => setConfirmDelete(true)}><Icon name="trash" /> Xóa dataset</Button>}
      </div>
    </section>
    <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} busy={busy} aria-labelledby="delete-dataset-title">
      <h2 id="delete-dataset-title">Xóa dataset?</h2>
      <p>Dataset sẽ bị xóa mềm khỏi Project. Dữ liệu không thể dùng trong Data View sau thao tác này.</p>
      {actionError && <p role="alert">{actionError}</p>}
      <div className="form-actions">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirmDelete(false)}>Hủy</Button>
        <Button type="button" variant="danger" disabled={busy} onClick={() => {
          void action(async () => {
            try { await service.delete(id) } catch (cause) {
              if (!(cause instanceof QueuedWriteError)) throw cause
              setPendingNotice(cause.message); setConfirmDelete(false); return
            }
            onInvalidatePreview?.()
            try { await store.refreshProject?.(project.id, new AbortController().signal) } catch {
              setConfirmDelete(false)
              throw new Error('Đã xóa dataset trên máy chủ nhưng chưa tải lại được Project. Hãy tải lại trang, không gửi lại thao tác.')
            }
            setConfirmDelete(false)
          })
        }}>Xác nhận xóa</Button>
      </div>
    </Dialog>
    {loading && <ModuleNotice tone="loading">Đang tải dữ liệu từ máy chủ…</ModuleNotice>}
    {error && <ModuleNotice tone="error">{error}</ModuleNotice>}
    {actionError && !confirmDelete && <ModuleNotice tone="error">{actionError}</ModuleNotice>}
    {!overview && <form className={styles['card']} onSubmit={event => {
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
      <h3>Truy vấn bản ghi</h3>
      <div className={styles['fields']}>
        <label>Cột <Select value={selectedColumn} onChange={event => { statsRequest.current?.abort(); statsRequest.current = null; setStatsRequestColumn(null); setColumn(event.target.value); setStats(null); setStatsError(null) }}>
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
      </div>
      <div className={styles['actions']}><Button type="submit" disabled={loading || !selectedColumn}><Icon name="filter" /> Áp dụng</Button></div>
    </form>}
    {overview ? <section className={styles['card']}>
      <h3>Cấu trúc cột</h3>
      {columns.length ? <>
        <SchemaTypes columns={columns} />
        <div className={styles['tableViewport']} tabIndex={0} role="region" aria-label="Cấu trúc cột của tập dữ liệu">
          <table className={`${styles['table']} ${styles['schema']}`}>
            <thead><tr><th scope="col">Tên cột</th><th scope="col">Kiểu dữ liệu</th><th scope="col">Cờ PII</th></tr></thead>
            <tbody>{columns.map(item => <tr key={item.key}>
              <th scope="row">{item.name}</th>
              <td><span className={styles['pill']}>{labelForType(item.dataType)}</span></td>
              <td>{item.isPii ? <span className={styles['pill']} data-tone="warning">PII</span> : '—'}</td>
            </tr>)}</tbody>
          </table>
      </div></> : !loading && !error ? <ModuleNotice>Chưa có thông tin cấu trúc cột.</ModuleNotice> : null}
    </section> : page && !loading && !error && <section className={styles['card']}>
        <div className={styles['cardHeading']}>
          <h3>Bản ghi</h3><span className={styles['pill']}>{count.format(page.items.length)} dòng trên trang</span>
        </div>
        {page.items.length ? <div className={styles['tableViewport']} tabIndex={0} role="region" aria-label="Bảng bản ghi dữ liệu">
          <table className={styles['table']}><thead><tr><th scope="col">Dòng</th>{columns.map(c => <th scope="col" key={c.key}>{c.name}</th>)}</tr></thead>
            <tbody>{page.items.map(row => <tr key={row.rowIndex}><th scope="row">{count.format(row.rowIndex)}</th>{columns.map(c => <td key={c.key}>{cell(row.props[c.key])}</td>)}</tr>)}</tbody>
          </table>
        </div> : <ModuleNotice>Không có bản ghi phù hợp.</ModuleNotice>}
        <div className={styles['pageControls']}>
          <Button variant="secondary" disabled={!history.length} onClick={() => {
            const previous = history.at(-1)
            if (previous) { setQuery(previous); setHistory(items => items.slice(0, -1)); setLoading(true) }
          }}>Trang trước</Button>
          <span>Trang {history.length + 1}</span>
          <Button variant="secondary" disabled={!page.meta.hasMore} onClick={() => {
            if (!page.meta.nextCursor) return
            if (page.meta.nextCursor === query.cursor || history.some(item => item.cursor === page.meta.nextCursor)) {
              setActionError('Máy chủ trả cursor lặp lại. Hãy tải lại dữ liệu.'); return
            }
            setHistory(items => [...items, query]); setQuery({ ...query, cursor: page.meta.nextCursor }); setLoading(true)
          }}>Trang tiếp</Button>
        </div>
      </section>}
    {!overview && selectedColumn && <>
      <DatasetDistribution column={activeColumn?.name ?? selectedColumn} columnIsPii={activeColumn?.isPii === true}
        busy={busy || loading || statsRequestColumn === selectedColumn} loading={statsRequestColumn === selectedColumn}
        error={statsError?.column === selectedColumn ? statsError.message : ''}
        stats={stats?.datasetId === id && stats.column === selectedColumn ? stats.value : null}
        chart={stats?.datasetId === id && stats.column === selectedColumn ? stats.chart : null}
        onLoad={() => {
          statsRequest.current?.abort()
          const controller = new AbortController()
          statsRequest.current = controller
          setStatsRequestColumn(selectedColumn)
          setStatsError(null)
          void Promise.allSettled([
            service.stats(id, selectedColumn, controller.signal),
            service.charts(id, selectedColumn, controller.signal),
          ]).then(([statistics, chart]) => {
            if (controller.signal.aborted) return
            if (statistics.status === 'rejected') {
              setStatsError({ column: selectedColumn, message: message(statistics.reason) })
              return
            }
            setStats({ datasetId: id, column: selectedColumn, value: statistics.value,
              chart: chart.status === 'fulfilled' ? chart.value : null })
          }).finally(() => {
            if (statsRequest.current === controller) {
              statsRequest.current = null
              setStatsRequestColumn(null)
            }
          })
        }} />
      <section className={styles['card']}>
        <h3>Quyền riêng tư của cột</h3>
        {activeColumn && <p className={styles['muted']}>{activeColumn.isPii ? 'Cột được đánh dấu là PII.' : 'Cột chưa được đánh dấu là PII.'}</p>}
      </section>
    </>}
  </section>
}
