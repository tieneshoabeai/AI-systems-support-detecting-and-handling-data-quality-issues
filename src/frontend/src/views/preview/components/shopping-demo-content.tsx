import { requireDefined } from '../../../utils/required-value'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { analysis, detection, metadata, loadShoppingRows, downloadShopping, shoppingRecordsHref } from '../../../mocks/shopping-trends/data'
import { detectionSteps } from '../../../hooks/preview/use-shopping-detection'
import type { useShoppingDetection } from '../../../hooks'
import type { ProjectModuleId } from '../../../types'
import './shopping-demo.css'

export function ShoppingTable({ full = false }: { full?: boolean }) {
  const [rows, setRows] = useState<string[][]>([])
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(-1)
  const [direction, setDirection] = useState(1)
  const [page, setPage] = useState(1)
  useEffect(() => {
    let active = true
    loadShoppingRows().then(value => { if (active) setRows(value) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [])
  const filtered = useMemo(() => {
    const selected = rows.map((values, index) => ({ values, index: index + 1 }))
      .filter(row => !full || row.values.some(value => value.toLowerCase().includes(search.trim().toLowerCase())))
    if (full && sort >= 0) selected.sort((a, b) => direction * requireDefined(a.values[sort], 'shopping-demo-content.tsx:25').localeCompare(requireDefined(b.values[sort], 'shopping-demo-content.tsx:25'), undefined, { numeric: true }))
    return selected
  }, [rows, full, search, sort, direction])
  const pages = Math.max(1, Math.ceil(filtered.length / 50))
  const current = Math.min(page, pages)
  const visible = full ? filtered.slice((current - 1) * 50, current * 50) : filtered.slice(0, 10)
  if (error) return <p role="alert">Không nạp được dữ liệu. Hãy tải lại trang.</p>
  if (!rows.length) return <p role="status">Đang nạp bảng dữ liệu…</p>
  return <div className="shopping-data">
    {full && <div className="shopping-tools">
      <label>Tìm trong dữ liệu <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} /></label>
      <label>Sắp xếp theo <select value={sort} onChange={e => { setSort(Number(e.target.value)); setPage(1) }}>
        <option value={-1}>Thứ tự CSV</option>{metadata.columns.map((column, i) => <option key={column} value={i}>{column}</option>)}
      </select></label>
      <button type="button" onClick={() => setDirection(value => -value)}>{direction === 1 ? 'Tăng dần' : 'Giảm dần'}</button>
    </div>}
    <p>{full ? filtered.length.toLocaleString('vi-VN') + ' dòng phù hợp' : '10 dòng đầu theo thứ tự CSV gốc'}</p>
    <div className="shopping-table-scroll" tabIndex={0} role="region" aria-label="Bảng dữ liệu shopping">
      <table><thead><tr><th>Dòng</th>{metadata.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{visible.map(row => <tr key={row.index}><th>{row.index}</th>{row.values.map((v, i) =>
          <td key={i}>{v === '' ? <span className="shopping-missing" title="Giá trị trống">∅</span> : v}</td>)}</tr>)}</tbody></table>
    </div>
    {!visible.length && <p>Không có dòng phù hợp.</p>}
    {full ? <nav className="shopping-tools" aria-label="Phân trang dữ liệu">
      <button disabled={current === 1} onClick={() => setPage(current - 1)}>Trang trước</button>
      <span>Trang {current} / {pages}</span>
      <button disabled={current === pages} onClick={() => setPage(current + 1)}>Trang sau</button>
    </nav> : <Link to={shoppingRecordsHref}>Xem đầy đủ 3.900 dòng →</Link>}
  </div>
}
type Detection = ReturnType<typeof useShoppingDetection>
const labels: Record<string, string> = { missing: 'Missing', nan: 'NaN', missing_symbol: 'Ký hiệu thiếu', invalid_type: 'Sai kiểu số',
  invalid_domain: 'Sai miền giá trị', invalid_category: 'Categorical không hợp lệ', outlier: 'Outlier', duplicate: 'Dòng trùng' }
export function ShoppingContent({ module, flow, onReview }: { module: ProjectModuleId; flow: Detection; onReview: () => void }) {
  const [findingPage, setFindingPage] = useState(1)
  const [kind, setKind] = useState('')
  const [downloadError, setDownloadError] = useState(false)
  const findings = detection.items.filter(item => !kind || item.kind === kind)
  const pages = Math.max(1, Math.ceil(findings.length / 20))
  const page = Math.min(findingPage, pages)
  const download = (type: 'csv' | 'report') => {
    setDownloadError(false)
    void downloadShopping(type).catch(() => setDownloadError(true))
  }
  if (module === 'data-view') return <ShoppingTable />
  if (module === 'overview') return <div className="shopping-module">
    <p>{metadata.fileName}</p>
    <dl className="shopping-metrics"><div><dt>Dòng</dt><dd>3.900</dd></div><div><dt>Cột</dt><dd>18</dd></div>
      <div><dt>Dung lượng</dt><dd>{metadata.bytes.toLocaleString('vi-VN')} byte</dd></div><div><dt>Ô trống</dt><dd>{analysis.missingCells}</dd></div></dl>
    <p>Giữ nguyên dữ liệu nguồn. Các phép thống kê và bằng chứng được chuẩn bị từ cùng một CSV.</p>
    <button onClick={() => download('csv')}>Tải CSV gốc</button>
    {downloadError && <p role="alert">Không tải được file. Hãy thử lại.</p>}
    <h3>Schema</h3><ul>{analysis.columns.map(c => <li key={c.column}>{c.column} — {c.type}; {c.missing} ô trống; {c.unique} giá trị phân biệt (gồm ô trống nếu có)</li>)}</ul>
  </div>
  if (module === 'data-analysis') return <div className="shopping-module">
    {analysis.notes.map(note => <p key={note}>{note}</p>)}
    {analysis.columns.map(column => <section key={column.column} className="shopping-stat">
      <h3>{column.column}</h3>
      {'mean' in column && <p>Min: {column.minimum} · Max: {column.maximum} · Mean: {column.mean} · Median: {column.median}</p>}
      <p>Missing: {column.missing} · Unique: {column.unique}</p>
      {column.top.map(top => <div key={top.value} className="shopping-frequency"><span>{top.value}</span>
        <meter min={0} max={metadata.rows} value={top.count} /><span>{top.count}</span></div>)}
    </section>)}
  </div>
  return <div className="shopping-module">
    {flow.error && <p role="alert">{flow.error}</p>}
    {flow.state.status === 'idle' && <button onClick={flow.start}>Chạy Detection</button>}
    {flow.state.status === 'running' && <section aria-label="Tiến trình Detection">
      <div className="shopping-progress" role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={flow.step + 1}><span style={{ transform: 'scaleX(' + (flow.step + 1) / 5 + ')' }} /></div>
      <div role="status" aria-live="polite">{detectionSteps[flow.step]}</div>
      <ol>{detectionSteps.slice(0, flow.step + 1).map(text => <li key={text}>{text}</li>)}</ol>
    </section>}
    {(flow.state.status === 'complete' || flow.state.status === 'reviewed') && <>
      <p><strong>{detection.findingCount} findings</strong> trên {detection.affectedRows} dòng. Một ô có thể thuộc nhiều nhóm; không cộng số findings thành số ô lỗi.</p>
      <p>Outlier là cảnh báo cần xem xét. Quy tắc miền/categorical là đề xuất demo, có nguồn ghi tại từng finding.</p>
      {flow.state.status === 'complete'
        ? <button className="button-primary" onClick={onReview}>Đánh giá</button>
        : <p role="status">Đã đánh giá {flow.state.review?.rating}/5 — {flow.state.review?.comment}</p>}
      <div className="shopping-tools">{Object.entries(detection.counts).map(([key, value]) => <span key={key}>{labels[key] ?? key}: {value}</span>)}</div>
      <label>Lọc vấn đề <select value={kind} onChange={e => { setKind(e.target.value); setFindingPage(1) }}>
        <option value="">Tất cả</option>{Object.keys(detection.counts).map(k => <option key={k} value={k}>{labels[k] ?? k}</option>)}
      </select></label>
      {findings.slice((page - 1) * 20, page * 20).map((item, i) => <article className="shopping-finding" key={item.row + '-' + item.column + '-' + i}>
        <strong>{labels[item.kind] ?? item.kind} · Dòng {item.row} · {item.column}</strong>
        <p>Giá trị: <code>{item.value || '∅'}</code> · Dòng CSV: {item.csvLine}</p><p>{item.reason}</p><small>Nguồn quy tắc: {item.origin}</small>
      </article>)}
      <nav className="shopping-tools" aria-label="Phân trang findings">
        <button disabled={page === 1} onClick={() => setFindingPage(page - 1)}>Trước</button><span>{page} / {pages}</span>
        <button disabled={page === pages} onClick={() => setFindingPage(page + 1)}>Sau</button>
      </nav>
      <button onClick={() => download('report')}>Tải báo cáo JSON</button>
      {downloadError && <p role="alert">Không tải được báo cáo. Hãy thử lại.</p>}
    </>}
  </div>
}
