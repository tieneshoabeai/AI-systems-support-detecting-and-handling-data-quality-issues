import { useId } from 'react'
import { Button } from '../../../../components/ui/primitives/button'
import { Icon } from '../../../../components/ui/primitives/icon'
import styles from '../../../../components/ui/diagnostics.module.css'
import type { ColumnChart, ColumnStats } from '../../../../services/processing/dataset.service'
import { DatasetBoxPlot, DatasetTopCategories } from './dataset-column-charts'
import { DatasetHistogram } from './dataset-histogram'

const number = new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: 6 })
const countFormat = new Intl.NumberFormat('vi-VN')
const percent = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 2 })

export function DatasetDistribution({ column, columnIsPii, stats, chart, busy, loading, error, onLoad }: {
  column: string
  columnIsPii: boolean
  stats: ColumnStats | null
  chart: ColumnChart | null
  busy: boolean
  loading: boolean
  error: string
  onLoad: () => void
}) {
  const heading = useId()
  const buckets = chart?.histogram ?? stats?.histogram ?? []
  return <section className={styles['panel']} aria-labelledby={heading} aria-busy={loading}>
    <header className={styles['header']}>
      <div><h3 id={heading}>Phân bố dữ liệu</h3><p>Cột {column}</p></div>
      <Button className="button-secondary" disabled={busy} onClick={onLoad}>
        <Icon name={loading ? 'clock' : 'chart'} /> {loading ? 'Đang tải…' : stats ? 'Cập nhật biểu đồ' : 'Tải thống kê cột'}
      </Button>
    </header>
    {error && <p role="alert" className={styles['empty']}>{error}</p>}
    {stats ? <>
      <dl className={styles['metrics']}>
        <div><dt>Số bản ghi</dt><dd>{countFormat.format(stats.total_records)}</dd></div>
        <div><dt>Giá trị thiếu</dt><dd>{countFormat.format(stats.null_count)} ({percent.format(stats.missing_ratio)})</dd></div>
        {stats.min !== undefined && <div><dt>Nhỏ nhất</dt><dd>{number.format(stats.min)}</dd></div>}
        {stats.max !== undefined && <div><dt>Lớn nhất</dt><dd>{number.format(stats.max)}</dd></div>}
        {stats.average !== undefined && <div><dt>Trung bình</dt><dd>{number.format(stats.average)}</dd></div>}
      </dl>
      {chart?.truncated && <p className={styles['note']}>Biểu đồ dựa trên mẫu {countFormat.format(chart.sampledRecords)} bản ghi.</p>}
      {buckets.length > 0 && <DatasetHistogram key={column} buckets={buckets} />}
      {chart?.boxPlot && <DatasetBoxPlot plot={chart.boxPlot} />}
      {chart?.category && <DatasetTopCategories category={chart.category} hidden={columnIsPii} />}
      {!buckets.length && !chart?.boxPlot && !chart?.category && <p className={styles['empty']}>Chưa có dữ liệu biểu đồ cho cột này.</p>}
      {!chart && <p className={styles['note']}>Không tải được biểu đồ chuyên dụng. Đang hiển thị dữ liệu từ thống kê cột.</p>}
    </> : !loading && !error && <p className={styles['empty']}>Tải thống kê để xem độ phân bố và số giá trị thiếu trong cột đã chọn.</p>}
  </section>
}
