import { isRecord } from '../../../../lib/api-error'
import styles from './module-content.module.css'
import { AnalysisCorrelationMatrix } from './analysis-correlation-matrix'
import { AnalysisFeedbackPanel } from './analysis-feedback-panel'
import type { AnalysisService } from '../../../../services/processing/analysis.service'

const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 })
const formatNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? number.format(value) : '—'
const records = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter(isRecord) : []

const columnChecks = [
  { code: 'DQ-01', field: 'missingCount', label: 'Thiếu dữ liệu' },
  { code: 'DQ-03', field: 'invalidCount', label: 'Sai kiểu hoặc định dạng' },
  { code: 'DQ-04', field: 'outlierCount', label: 'Giá trị ngoại lệ' },
] as const

export function AnalysisResultOverview({ result, runId, service }: {
  result: Record<string, unknown>
  runId: string
  service: AnalysisService
}) {
  const quality = isRecord(result['dqSummary']) ? result['dqSummary'] : null
  const description = records(result['descriptive'])
  const matrix = isRecord(result['correlationMatrix']) ? result['correlationMatrix'] : null
  const correlations = records(matrix?.['cells']).filter(cell =>
    typeof cell['colA'] === 'string' && typeof cell['colB'] === 'string'
    && cell['colA'] !== cell['colB'] && typeof cell['coef'] === 'number' && Number.isFinite(cell['coef']))
  const qualityMetrics = quality ? [
    ['Dòng đã quét', quality['totalScanned']],
    ['Dòng trùng', quality['duplicateRowCount']],
    ['Dòng thiếu một phần', quality['partiallyMissingRows']],
    ['Dòng thiếu toàn bộ', quality['fullyMissingRows']],
  ] as const : []
  const findings = records(quality?.['columns']).flatMap(row => {
    const column = row['column']
    if (typeof column !== 'string' || !column.trim()) return []
    return columnChecks.flatMap(({ code, field, label }) => {
      const id = `${code}:${column}`
      const count = row[field]
      if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return []
      return [{ id, title: `${label} · Cột ${column}`, count, unit: 'ô' }]
    })
  })
  const duplicates = quality?.['duplicateRowCount']
  if (typeof duplicates === 'number' && Number.isFinite(duplicates) && duplicates > 0) {
    findings.unshift({ id: 'DQ-02', title: 'Dòng trùng', count: duplicates, unit: 'dòng' })
  }

  return <>
    {qualityMetrics.length > 0 && <section aria-label="Chất lượng dữ liệu">
      <h4>Chất lượng dữ liệu</h4>
      <dl className={styles['metrics']}>
        {qualityMetrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{formatNumber(value)}</dd></div>)}
      </dl>
      {runId && findings.length > 0 && <ul className={styles['qualityFindings']}>
        {findings.map(finding => <li key={finding.id} className={styles['qualityFinding']}>
          <p><strong>{finding.title}</strong> · {formatNumber(finding.count)} {finding.unit}</p>
          {finding.id.length <= 200 && <AnalysisFeedbackPanel key={runId} runId={runId} service={service} finding={finding} />}
        </li>)}
      </ul>}
    </section>}
    {description.length > 0 && <details className={styles['disclosure']}>
      <summary>Thống kê mô tả · {number.format(description.length)} cột</summary>
      <div className={styles['tableViewport']} tabIndex={0} role="region" aria-label="Thống kê theo cột">
        <table className={styles['table']}>
          <thead><tr><th scope="col">Cột</th><th scope="col">Hợp lệ</th><th scope="col">Thiếu</th><th scope="col">Sai kiểu</th><th scope="col">Trung bình</th></tr></thead>
          <tbody>{description.map((row, index) => <tr key={index}>
            <th scope="row">{typeof row['column'] === 'string' ? row['column'] : '—'}</th>
            <td>{formatNumber(row['count'])}</td><td>{formatNumber(row['missingCount'])}</td>
            <td>{formatNumber(row['invalidCount'])}</td><td>{formatNumber(row['mean'])}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>}
    {matrix && <details className={styles['disclosure']}>
      <summary>Tương quan · {number.format(correlations.length)} cặp tính được</summary>
      <AnalysisCorrelationMatrix matrix={matrix} />
      <details className={styles['disclosure']}>
        <summary>Bảng hệ số</summary>
      {correlations.length === 0 ? <p className={styles['muted']}>Chưa có cặp cột đủ dữ liệu để tính tương quan.</p>
        : <div className={styles['tableViewport']} tabIndex={0} role="region" aria-label="Hệ số tương quan">
          <table className={styles['table']}>
            <thead><tr><th scope="col">Cặp cột</th><th scope="col">Phương pháp</th><th scope="col">Hệ số</th></tr></thead>
            <tbody>{correlations.slice(0, 20).map((cell, index) => <tr key={index}>
              <th scope="row">{String(cell['colA'])} / {String(cell['colB'])}</th>
              <td>{typeof cell['kind'] === 'string' ? cell['kind'] : '—'}</td><td>{formatNumber(cell['coef'])}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      {correlations.length > 20 && <p className={styles['muted']}>Hiển thị 20 cặp đầu. Xem toàn bộ trong Chi tiết kỹ thuật.</p>}
      </details>
    </details>}
    {!quality && description.length === 0 && !matrix &&
      <p className={styles['muted']}>Kết quả này chưa có số liệu tổng quan.</p>}
  </>
}
