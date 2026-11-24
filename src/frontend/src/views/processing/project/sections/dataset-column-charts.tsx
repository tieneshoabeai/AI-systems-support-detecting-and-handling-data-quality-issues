import type { ColumnBoxPlot, ColumnCategoryChart } from '../../../../services/processing/dataset.service'
import styles from '../../../../components/ui/diagnostics.module.css'
import chartStyles from './project-charts.module.css'

const number = new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: 6 })
const integer = new Intl.NumberFormat('vi-VN')
const percent = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 2 })

export function DatasetBoxPlot({ plot }: { plot: ColumnBoxPlot }) {
  const { whiskerLow, q1, median, q3, whiskerHigh, outsideCount, n } = plot
  const low = Math.min(whiskerLow, q1)
  const high = Math.max(whiskerHigh, q3)
  const scale = Math.max(Math.abs(low), Math.abs(high)) || 1
  const span = high / scale - low / scale
  const position = (value: number) => span > 0 ? (value / scale - low / scale) / span * 100 : 50
  const metrics = [
    ['Râu dưới', whiskerLow], ['Tứ phân vị 25%', q1], ['Trung vị', median],
    ['Tứ phân vị 75%', q3], ['Râu trên', whiskerHigh],
  ] as const

  return <section className={styles['chart']} aria-label="Biểu đồ hộp">
    <h4>Biểu đồ hộp (Box Plot)</h4>
    <div className={styles['boxPlot']} aria-hidden="true">
      <div className={styles['whiskers']} style={{ left: `${position(whiskerLow)}%`, width: `${position(whiskerHigh) - position(whiskerLow)}%` }} />
      <div className={styles['quartileBox']} style={{ left: `${position(q1)}%`, width: `${position(q3) - position(q1)}%` }} />
      <span className={styles['medianMark']} style={{ left: `${position(median)}%` }} />
    </div>
    <div className={chartStyles['boxScale']} aria-hidden="true">
      <span>{number.format(low)}</span><span>{number.format(high)}</span>
    </div>
    <p className={chartStyles['rangeLegend']}>Hộp là khoảng 50% dữ liệu ở giữa, vạch trong hộp là trung vị.</p>
    <dl className={styles['metrics']}>
      {metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{number.format(value)}</dd></div>)}
    </dl>
    <p className={styles['note']}>
      {integer.format(outsideCount)}/{integer.format(n)} giá trị nằm ngoài râu. Đây là các điểm có thể bất thường, cần xem xét thêm.
    </p>
  </section>
}

export function DatasetTopCategories({ category, hidden }: { category: ColumnCategoryChart; hidden: boolean }) {
  const masked = hidden || category.masked
  return <section className={styles['chart']} aria-label="Các giá trị phổ biến">
    <h4>{masked ? 'Các giá trị phổ biến' : `Top ${integer.format(category.topN)} giá trị phổ biến`}</h4>
    {masked ? <p className={styles['note']}>Giá trị phân loại của cột này được ẩn.</p>
      : category.items.length === 0 && !category.other ? <p className={styles['note']}>Chưa có giá trị để xếp hạng.</p>
        : <>
          <p className={styles['note']}>{integer.format(category.distinctCount)} giá trị khác nhau. Tỷ trọng tính trên các bản ghi có giá trị.</p>
          <ul className={`${styles['bars']} ${styles['categoryBars']}`} aria-label="Số bản ghi và tỷ trọng theo nhóm">
            {category.items.map(({ value, count, rate }, index) => <li key={`${index}:${value}`}>
              <span>{value || 'Giá trị rỗng'}</span>
              <span className={styles['track']} aria-hidden="true"><span className={styles['bar']} style={{ width: `${rate * 100}%` }} /></span>
              <span>{integer.format(count)} ({percent.format(rate)})</span>
            </li>)}
            {category.other && <li>
              <span>Các giá trị còn lại</span>
              <span className={styles['track']} aria-hidden="true"><span className={styles['bar']} style={{ width: `${category.other.rate * 100}%` }} /></span>
              <span>{integer.format(category.other.count)} ({percent.format(category.other.rate)})</span>
            </li>}
          </ul>
        </>}
  </section>
}
