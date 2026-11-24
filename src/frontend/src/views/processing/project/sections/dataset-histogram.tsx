import { useState } from 'react'
import type { HistogramBucket } from '../../../../services/processing/dataset.service'
import styles from './project-charts.module.css'

const rangeNumber = new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: 6 })
const exactNumber = new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: 17 })
const countNumber = new Intl.NumberFormat('vi-VN')
const axisNumber = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })
const percentage = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 2 })

export function DatasetHistogram({ buckets }: { buckets: readonly HistogramBucket[] }) {
  const [unit, setUnit] = useState<'count' | 'share'>('count')
  const [pickedIndex, setPickedIndex] = useState<number | null>(null)
  let total = 0
  let peak = 0
  let peakIndex = 0
  buckets.forEach((bucket, index) => {
    total += bucket.count
    if (bucket.count > peak) { peak = bucket.count; peakIndex = index }
  })
  const currentIndex = pickedIndex !== null && pickedIndex < buckets.length ? pickedIndex : peakIndex
  const current = buckets[currentIndex]
  const first = buckets[0]
  const last = buckets.at(-1)
  if (!current || !first || !last) return null

  const tickStep = Math.max(1, Math.ceil(peak / 4))
  const max = unit === 'share' ? total || 1 : tickStep * 4
  const ticks = [4, 3, 2, 1, 0].map(step => unit === 'share' ? percentage.format(step / 4) : axisNumber.format(step * tickStep))

  return <figure className={styles['histogram']} aria-label="Histogram phân bố theo khoảng giá trị">
    <figcaption className={styles['chartCaption']}>
      <div><h4>Phân bố theo khoảng giá trị</h4><p>{countNumber.format(buckets.length)} khoảng · {countNumber.format(total)} bản ghi</p></div>
      <div role="group" aria-label="Đơn vị biểu đồ" className={styles['segments']}>
        <button type="button" aria-pressed={unit === 'count'} onClick={() => setUnit('count')}>Số bản ghi</button>
        <button type="button" aria-pressed={unit === 'share'} onClick={() => setUnit('share')}>Tỷ trọng</button>
      </div>
    </figcaption>
    <div className={styles['chartFrame']}>
      <div className={styles['scale']} aria-hidden="true">{ticks.map((tick, index) => <span key={index}>{tick}</span>)}</div>
      <div className={styles['plotScroller']}>
        <div className={styles['plot']} role="group" aria-label="Các khoảng giá trị">
          {buckets.map(({ bucket_start, bucket_end, count }, index) => {
            const label = `${exactNumber.format(bucket_start)} – ${exactNumber.format(bucket_end)}`
            const share = percentage.format(total ? count / total : 0)
            return <button key={`${label}:${index}`} type="button" aria-pressed={currentIndex === index}
              aria-label={`${label}, ${countNumber.format(count)} bản ghi, ${share}`} onClick={() => setPickedIndex(index)}>
              <span aria-hidden="true" style={{ height: `${count / max * 100}%`, minHeight: count > 0 ? 2 : 0 }} />
            </button>
          })}
        </div>
      </div>
    </div>
    <div className={styles['range']} aria-hidden="true"><span>{rangeNumber.format(first.bucket_start)}</span><span>Khoảng giá trị</span><span>{rangeNumber.format(last.bucket_end)}</span></div>
    <div className={styles['readout']} aria-live="polite">
      <span>Khoảng <strong>{exactNumber.format(current.bucket_start)} – {exactNumber.format(current.bucket_end)}</strong></span>
      <span><strong>{countNumber.format(current.count)}</strong> bản ghi · {percentage.format(total ? current.count / total : 0)}</span>
    </div>
    <details className={styles['dataDetails']}>
      <summary>Xem số liệu theo khoảng</summary>
      <div className={styles['dataViewport']}>
        <table aria-label="Số liệu histogram">
          <thead><tr><th scope="col">Khoảng</th><th scope="col">Số bản ghi</th><th scope="col">Tỷ trọng</th></tr></thead>
          <tbody>{buckets.map((bucket, index) => <tr key={index}>
            <th scope="row">{exactNumber.format(bucket.bucket_start)} – {exactNumber.format(bucket.bucket_end)}</th>
            <td>{countNumber.format(bucket.count)}</td><td>{percentage.format(total ? bucket.count / total : 0)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </figure>
}
