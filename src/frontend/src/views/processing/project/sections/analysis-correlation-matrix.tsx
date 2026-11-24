import { useCallback, useId, useMemo, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { isRecord } from '../../../../lib/api-error'
import { Button } from '../../../../components/ui/primitives/button'
import { Dialog } from '../../../../components/ui/overlay/dialog'
import styles from './analysis-correlation-matrix.module.css'

const windowSize = 12
const coefficient = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 })
const methods = { pearson: 'Pearson', spearman: 'Spearman', cramers_v: 'Cramér’s V', eta_squared: 'η²' }
const arrowOffsets: Partial<Record<string, readonly [number, number]>> = {
  ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
}
const reasonLabels: Record<string, string> = {
  insufficient_pairwise_n_lt_3: 'Cần ít nhất 3 mẫu hợp lệ.',
  insufficient_pairwise_n_lt_4: 'Cần ít nhất 4 mẫu hợp lệ.',
  constant_column_or_undefined: 'Có cột không biến thiên hoặc hệ số không xác định.',
  single_group_or_constant_numeric: 'η² cần ít nhất hai nhóm, mỗi nhóm có ít nhất hai mẫu hợp lệ và cột số có biến thiên.',
  single_group_no_variation: 'Cramér’s V cần ít nhất hai mức ở mỗi cột.',
  no_diagonal_for_categorical: 'Backend chỉ trả hệ số trên đường chéo cho cột số.',
}

function parseCell(value: unknown) {
  if (!isRecord(value) || typeof value['colA'] !== 'string' || typeof value['colB'] !== 'string') return null
  const { colA, colB, kind, coef, n, reason, computable } = value
  const method = typeof kind === 'string' && Object.hasOwn(methods, kind) ? kind as keyof typeof methods : null
  const strength = method === 'cramers_v' || method === 'eta_squared'
  const score = computable !== false && method && typeof coef === 'number' && Number.isFinite(coef)
    && coef >= (strength ? 0 : -1) && coef <= 1 ? coef : null
  return {
    colA, colB, method, score,
    tone: score === null ? 'missing' : strength ? 'strength' : score < 0 ? 'negative' : 'positive',
    samples: typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : null,
    reason: typeof reason === 'string' && reason !== 'diagonal'
      ? (Object.hasOwn(reasonLabels, reason) ? reasonLabels[reason] : reason) : '',
  }
}

type Cell = NonNullable<ReturnType<typeof parseCell>>
type Position = { row: number; column: number }

function readMatrix(matrix: Record<string, unknown>) {
  const cells = new Map<string, Map<string, Cell>>()
  const names = new Set<string>()
  if (Array.isArray(matrix['cells'])) {
    for (const value of matrix['cells'] as unknown[]) {
      const cell = parseCell(value)
      if (!cell) continue
      names.add(cell.colA)
      names.add(cell.colB)
      const row = cells.get(cell.colA) ?? new Map<string, Cell>()
      row.set(cell.colB, cell)
      cells.set(cell.colA, row)
    }
  }
  const declared = Array.isArray(matrix['columns']) ? (matrix['columns'] as unknown[])
    .filter((name): name is string => typeof name === 'string' && name.length > 0) : []
  return { cells, columns: declared.length ? [...new Set(declared)] : [...names] }
}

export function AnalysisCorrelationMatrix({ matrix }: { matrix: Record<string, unknown> }) {
  const { cells, columns } = useMemo(() => readMatrix(matrix), [matrix])
  const [rowPage, setRowPage] = useState(0)
  const [columnPage, setColumnPage] = useState(0)
  const [focused, setFocused] = useState<Position>({ row: 0, column: 0 })
  const [hovered, setHovered] = useState<Position | null>(null)
  const [dialogRoot, setDialogRoot] = useState<Element | null>(null)
  const dialogTitle = useId()
  const closeDialog = useCallback(() => {
    setHovered(null)
    setDialogRoot(null)
  }, [])
  if (!columns.length) return null

  const pageSize = dialogRoot ? windowSize * 2 : windowSize
  const pageCount = Math.ceil(columns.length / pageSize)
  const activeRowPage = Math.min(Math.floor(rowPage / pageSize), pageCount - 1)
  const activeColumnPage = Math.min(Math.floor(columnPage / pageSize), pageCount - 1)
  const rowStart = activeRowPage * pageSize
  const columnStart = activeColumnPage * pageSize
  const rows = columns.slice(rowStart, rowStart + pageSize)
  const headers = columns.slice(columnStart, columnStart + pageSize)
  const active = {
    row: Math.max(0, Math.min(focused.row - rowStart, rows.length - 1)),
    column: Math.max(0, Math.min(focused.column - columnStart, headers.length - 1)),
  }
  const inspected = hovered && hovered.row < rows.length && hovered.column < headers.length ? hovered : active
  const rowName = rows[inspected.row] ?? ''
  const columnName = headers[inspected.column] ?? ''
  const selected = cells.get(rowName)?.get(columnName)
  const changePage = (axis: 'row' | 'column', page: number) => {
    const start = page * pageSize
    if (axis === 'row') setRowPage(start)
    else setColumnPage(start)
    setFocused({ row: axis === 'row' ? start : rowStart, column: axis === 'column' ? start : columnStart })
    setHovered(null)
  }
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, row: number, column: number) => {
    if (!Object.hasOwn(arrowOffsets, event.key)) return
    const delta = arrowOffsets[event.key]
    if (!delta) return
    event.preventDefault()
    const nextRow = Math.max(0, Math.min(rows.length - 1, row + delta[0]))
    const nextColumn = Math.max(0, Math.min(headers.length - 1, column + delta[1]))
    event.currentTarget.closest('table')?.querySelector<HTMLButtonElement>(
      `[data-position="${nextRow}:${nextColumn}"]`,
    )?.focus()
  }

  const legend = <>
    <ul className={styles['legend']} aria-label="Chú giải màu">
      <li data-tone="negative">−1 đến 0 · Âm</li>
      <li data-tone="positive">0 đến +1 · Dương</li>
      <li data-tone="strength">0 đến 1 · Độ mạnh liên hệ</li>
    </ul>
    <p className={styles['hint']}>Di chuột, chạm hoặc dùng phím mũi tên để xem chi tiết từng ô.</p>
  </>
  const pager = pageCount > 1 && <div className={styles['pager']}>
      {([{ axis: 'row', label: 'Hàng', page: activeRowPage },
        { axis: 'column', label: 'Cột', page: activeColumnPage }] as const).map(({ axis, label, page }) =>
        <div key={axis}>
          <Button variant="plain" disabled={page === 0} aria-label={`${label} trước`} onClick={() => changePage(axis, page - 1)}>‹</Button>
          <span>{label} {page * pageSize + 1}–{Math.min(columns.length, (page + 1) * pageSize)} / {columns.length}</span>
          <Button variant="plain" disabled={page === pageCount - 1} aria-label={`${label} tiếp theo`} onClick={() => changePage(axis, page + 1)}>›</Button>
        </div>)}
    </div>
  const body = <>
    <div className={styles['viewport']}>
      <table className={styles['table']} aria-label="Bảng màu hệ số theo cặp cột">
        <thead><tr><th scope="col">Cột</th>{headers.map(name => <th scope="col" key={name} title={name}>{name}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={row}>
          <th scope="row" title={row}>{row}</th>
          {headers.map((column, columnIndex) => {
            const cell = cells.get(row)?.get(column)
            const score = cell?.score ?? null
            const value = score === null ? '—' : coefficient.format(score)
            const tone = score === 0 ? 'neutral' : cell?.tone ?? 'missing'
            return <td key={column}>
              <button type="button" className={styles['cell']} data-tone={tone} data-position={`${rowIndex}:${columnIndex}`}
                tabIndex={active.row === rowIndex && active.column === columnIndex ? 0 : -1}
                aria-label={`${row} / ${column}: ${value}${cell?.method ? `, ${methods[cell.method]}` : ''}`}
                style={{ '--intensity': `${Math.abs(score ?? 0) * 65}%` } as CSSProperties}
                onMouseEnter={() => setHovered({ row: rowIndex, column: columnIndex })}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => { setHovered(null); setFocused({ row: rowStart + rowIndex, column: columnStart + columnIndex }) }}
                onClick={() => setFocused({ row: rowStart + rowIndex, column: columnStart + columnIndex })}
                onKeyDown={event => navigate(event, rowIndex, columnIndex)}>{value}</button>
            </td>
          })}
        </tr>)}</tbody>
      </table>
    </div>
    <div className={styles['detail']} aria-live="polite">
      <strong>{rowName} / {columnName}</strong>
      <span>{selected?.method ? methods[selected.method] : 'Phương pháp chưa xác định'} · {selected?.score != null
        ? `Hệ số ${coefficient.format(selected.score)}` : 'Không có hệ số'}
        {selected?.samples != null && ` · ${coefficient.format(selected.samples)} mẫu`}</span>
      {selected?.reason && <span>{selected.reason}</span>}
    </div>
  </>

  return <section className={styles['matrix']} aria-label="Ma trận tương quan">
    {!dialogRoot && legend}
    <div className={styles['toolbar']}>
      {!dialogRoot && pager}
      <Button variant="secondary" className={styles['expand']} aria-haspopup="dialog"
        onClick={event => {
          event.currentTarget.focus()
          setHovered(null)
          setDialogRoot(event.currentTarget.closest('[data-preview="2d"]') ?? document.body)
        }}>
        <span aria-hidden="true">⤢</span> Phóng to
      </Button>
    </div>
    {dialogRoot
      ? createPortal(<Dialog open onClose={closeDialog} aria-labelledby={dialogTitle} className={styles['dialog'] ?? ''}>
          <header className={styles['dialogHeader']}>
            <h2 id={dialogTitle}>Ma trận tương quan</h2>
            <Button variant="secondary" onClick={closeDialog}>Đóng</Button>
          </header>
          <div className={styles['matrix']}>{legend}{pager}{body}</div>
        </Dialog>, dialogRoot)
      : body}
  </section>
}
