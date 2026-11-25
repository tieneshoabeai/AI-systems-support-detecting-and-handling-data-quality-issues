import { Button } from '../../../../components/ui/controls'
import { useId } from 'react'
import styles from '../../../../components/ui/diagnostics.module.css'
import { isRecord } from '../../../../lib/api-error'
import chartStyles from './project-charts.module.css'

const stages = ['Đã xếp hàng', 'Đang phân tích', 'Có kết quả']
const coefficient = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 })
const clock = new Intl.DateTimeFormat('vi-VN', { timeStyle: 'medium' })
const textItems = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : []
const statusLabels: Record<string, { title: string; stage: number; error?: boolean }> = {
  pending: { title: 'Đang chờ xử lý', stage: 0 },
  running: { title: 'Đang phân tích', stage: 1 },
  succeeded: { title: 'Đã có kết quả', stage: 2 },
  failed: { title: 'Phân tích thất bại', stage: -1, error: true },
  skipped: { title: 'Tác vụ đã được bỏ qua', stage: -1 },
}

export function AnalysisJobPanel({ jobId, job, assessment, busy, operation, polling, offline, checkedAt, error, canRetry, onCheck, onRetry, onResult }: {
  jobId: string
  job: unknown
  assessment: unknown
  busy: boolean
  operation: 'check' | 'retry' | null
  polling: boolean
  offline: boolean
  checkedAt: Date | null
  error: string
  canRetry: boolean
  onCheck: () => void
  onRetry: () => void
  onResult: () => void
}) {
  const heading = useId()
  const record = isRecord(job) && job['jobId'] === jobId.trim() ? job : null
  const key = record?.['status']
  const jobFailure = key === 'failed' && isRecord(record?.['error']) ? record['error']['message'] : null
  const summary = typeof key === 'string' && Object.hasOwn(statusLabels, key) ? statusLabels[key] : undefined
  const attempt = record?.['attempt']
  const result = isRecord(assessment) && assessment['status'] === 'succeeded' ? assessment : null
  const pairs = Array.isArray(result?.['notablePairs']) ? result['notablePairs'].flatMap((pair: unknown) => {
    if (!isRecord(pair) || typeof pair['colA'] !== 'string' || typeof pair['colB'] !== 'string'
      || typeof pair['coef'] !== 'number' || !Number.isFinite(pair['coef']) || Math.abs(pair['coef']) > 1) return []
    return [{ colA: pair['colA'], colB: pair['colB'], value: pair['coef'] }]
  }) : []
  const nextSteps = textItems(result?.['nextSteps'])
  const limits = textItems(result?.['limits'])
  return <section className={styles['panel']} data-accent="violet" aria-labelledby={heading} aria-busy={Boolean(operation)}>
    <header className={styles['header']}>
      <div><h3 id={heading}>Tiến trình phân tích AI</h3><p>Theo dõi tác vụ phân tích tương quan của project.</p></div>
      <span className={styles['status']} data-tone={summary?.error ? 'error' : summary ? 'normal' : 'neutral'} role="status">
        {operation === 'retry' ? 'Đang gửi yêu cầu…' : summary?.title
          ?? (polling || operation === 'check' ? 'Đang kiểm tra…' : jobId ? 'Chưa kiểm tra trạng thái' : 'Không có mã tác vụ để theo dõi')}
      </span>
    </header>
    {offline && <p className={styles['note']} role="status">Đang ngoại tuyến. Kết quả đã tải vẫn xem được; tự động theo dõi sẽ tiếp tục khi có kết nối.</p>}
    {summary && summary.stage >= 0 && <ol className={styles['steps']} aria-label="Các bước phân tích">
      {stages.map((label, index) => <li key={label} data-reached={index <= summary.stage}
        aria-current={index === summary.stage ? 'step' : undefined}><span className={styles['stepMark']} aria-hidden="true">{index < summary.stage ? '✓' : index + 1}</span>{label}</li>)}
    </ol>}
    {record && <div className={styles['meta']}>
      {typeof attempt === 'number' && Number.isSafeInteger(attempt) && attempt >= 0 && <span>Số lần thử lại: {attempt}</span>}
      {checkedAt && <span>Cập nhật lúc <time dateTime={checkedAt.toISOString()}>{clock.format(checkedAt)}</time></span>}
    </div>}
    <div className={styles['actions']}>
      {jobId && <Button className="button-secondary" disabled={offline || busy || polling} onClick={onCheck}>Kiểm tra lại trạng thái</Button>}
      {jobId && canRetry && (key === 'failed' || key === 'skipped') &&
        <Button className="button-secondary" disabled={offline || busy} onClick={onRetry}>Thử lại job</Button>}
      {key === 'succeeded' && <Button className="button-secondary" disabled={offline || busy} onClick={onResult}>Tải lại kết quả</Button>}
    </div>
    {error && <p role="alert" className={styles['empty']}>{error}</p>}
    {typeof jobFailure === 'string' && jobFailure && <p className={styles['empty']}>{jobFailure}</p>}
    {result && <div className={styles['findings']}>
      <h4>Nhận xét AI mới nhất của project</h4>
      {pairs.length > 0 && <section className={chartStyles['correlation']} aria-label="Biểu đồ tương quan">
        <div className={chartStyles['correlationAxis']} aria-hidden="true"><span>−1</span><span>0</span><span>+1</span></div>
        <ul>{pairs.map(({ colA, colB, value }, index) => <li key={index}>
          <div className={chartStyles['pairLabel']}><span>{colA} / {colB}</span><strong>{coefficient.format(value)}</strong></div>
          <div className={chartStyles['correlationTrack']} aria-hidden="true">
            <span data-negative={value < 0} style={{ left: `${50 + Math.min(0, value) * 50}%`, width: `${Math.abs(value) * 50}%` }} />
          </div>
        </li>)}</ul>
        <p className={styles['note']}>Thanh sang trái là tương quan âm, sang phải là tương quan dương.</p>
      </section>}
      {nextSteps.length > 0 && <><strong>Đề xuất tiếp theo</strong><ul>{nextSteps.map((step, index) => <li key={index}>{step}</li>)}</ul></>}
      {limits.length > 0 && <><strong>Giới hạn khi đọc kết quả</strong><ul>{limits.map((limit, index) => <li key={index}>{limit}</li>)}</ul></>}
      {!pairs.length && !nextSteps.length && !limits.length && <p>Không có cặp tương quan nổi bật hoặc đề xuất bổ sung.</p>}
    </div>}
  </section>
}
