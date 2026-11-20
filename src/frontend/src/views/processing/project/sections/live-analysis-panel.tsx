import { useEffect, useState } from 'react'

import { useManagementStore } from '../../../../hooks/preview/use-preview-store'
import type { DatasetColumn } from '../../../../services/processing/dataset.service'
import type { Project } from '../../../../types/preview/preview.types'
import type { AnalysisConfigInput, CreateFeedbackInput } from '../../../../services/processing/analysis.service'
import styles from '../project-workspace.module.css'

type RecordValue = Record<string, unknown>
const asRecord = (value: unknown): RecordValue | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as RecordValue : null
const readString = (value: unknown): string => typeof value === 'string' ? value : ''
const formatResponse = (value: unknown): string => JSON.stringify(value, null, 2) ?? String(value)
const message = (error: unknown) => error instanceof Error ? error.message : 'Yêu cầu không thành công.'
const labels = [
  ['correct', 'Chính xác'],
  ['partially_correct', 'Đúng một phần'],
  ['false_positive', 'Cảnh báo sai'],
  ['missed_issue', 'Bỏ sót vấn đề'],
  ['other', 'Khác'],
] as const

export function LiveAnalysisPanel({ project, canExecute, onAnalysisRun }: {
  project: Project
  canExecute: boolean
  onAnalysisRun: () => void
}) {
  const store = useManagementStore()
  const service = store.analysisService
  const datasetId = project.dataset?.id
  const [columns, setColumns] = useState<DatasetColumn[]>([])
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [labelColumn, setLabelColumn] = useState('')
  const [timeColumn, setTimeColumn] = useState('')
  const [timeGranularity, setTimeGranularity] = useState<'day' | 'week' | 'month' | 'year'>('day')
  const [valueColumn, setValueColumn] = useState('')
  const [correlationMethod, setCorrelationMethod] = useState<'pearson' | 'spearman'>('pearson')
  const [outlierMethod, setOutlierMethod] = useState<'iqr' | 'modified_zscore' | 'both'>('iqr')
  const [topN, setTopN] = useState(10)
  const [analysisId, setAnalysisId] = useState('')
  const [jobId, setJobId] = useState('')
  const [reportId, setReportId] = useState('')
  const [feedbackId, setFeedbackId] = useState('')
  const [findingId, setFindingId] = useState('')
  const [feedbackLabel, setFeedbackLabel] = useState<CreateFeedbackInput['label']>('correct')
  const [feedbackReason, setFeedbackReason] = useState('')
  const [suggestedSeverity, setSuggestedSeverity] = useState<'low' | 'medium' | 'high' | 'critical' | ''>('')
  const [response, setResponse] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!service || !datasetId || !store.datasetService) { setLoading(false); return }
    const controller = new AbortController()
    const schemaRequest = store.datasetService.schema(datasetId, controller.signal)
    void Promise.all([service.getConfig(project.id, controller.signal), schemaRequest]).then(([saved, schema]) => {
      if (controller.signal.aborted) return
      const config = asRecord(saved)
      setColumns(schema)
      if (config) {
        const keyFor = (value: string) => schema.find(column => column.key === value || column.name === value)?.key ?? value
        setSelectedColumns(Array.isArray(config['selectedColumns'])
          ? config['selectedColumns'].filter((item): item is string => typeof item === 'string').map(keyFor) : [])
        setLabelColumn(keyFor(readString(config['labelColumn'])))
        setTimeColumn(keyFor(readString(config['timeColumn'])))
        setValueColumn(keyFor(readString(config['valueColumn'])))
        if (config['timeGranularity'] === 'week' || config['timeGranularity'] === 'month' || config['timeGranularity'] === 'year') setTimeGranularity(config['timeGranularity'])
        if (config['correlationMethod'] === 'spearman') setCorrelationMethod('spearman')
        if (config['outlierMethod'] === 'modified_zscore' || config['outlierMethod'] === 'both') setOutlierMethod(config['outlierMethod'])
        if (typeof config['topN'] === 'number' && Number.isInteger(config['topN'])) setTopN(config['topN'])
      }
      setError('')
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(message(cause))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [datasetId, project.id, service, store.datasetService])

  const action = async (operation: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setError(''); setStatus('')
    try { await operation() } catch (cause) { setError(message(cause)) } finally { setBusy(false) }
  }
  const configPayload = (): AnalysisConfigInput => ({
    selected_columns: selectedColumns.map(key => columns.find(column => column.key === key)?.name ?? key),
    label_column: labelColumn ? columns.find(column => column.key === labelColumn)?.name ?? labelColumn : null,
    time_column: timeColumn ? columns.find(column => column.key === timeColumn)?.name ?? timeColumn : null,
    time_granularity: timeGranularity,
    value_column: valueColumn ? columns.find(column => column.key === valueColumn)?.name ?? valueColumn : null,
    correlation_method: correlationMethod,
    outlier_method: outlierMethod,
    top_n: topN,
  })
  const saveConfig = () => action(async () => {
    const saved = await service!.saveConfig(project.id, configPayload())
    setResponse(saved); setStatus('Đã lưu cấu hình phân tích.')
  })
  const runAnalysis = () => action(async () => {
    const result = await service!.run(project.id, {
      selected_columns: configPayload().selected_columns ?? [],
      correlation_method: correlationMethod,
      outlier_method: outlierMethod,
      top_n: topN,
    })
    const record = asRecord(result)
    const id = readString(record?.['analysisId'])
    const pollUrl = readString(record?.['pollUrl'])
    const job = readString(record?.['jobId']) || pollUrl.split('/').filter(Boolean).at(-1) || ''
    if (id) setAnalysisId(id)
    setJobId(job)
    onAnalysisRun()
    setResponse(result); setStatus('Đã nhận kết quả chạy phân tích.')
  })
  const submitFeedback = (finding = false) => action(async () => {
    if (!analysisId) throw new Error('Cần có mã lần phân tích trước khi gửi feedback.')
    if ((feedbackLabel === 'false_positive' || feedbackLabel === 'missed_issue' || feedbackLabel === 'other') && !feedbackReason.trim()) {
      throw new Error('Với nhãn đã chọn, cần nhập lý do.')
    }
    const body: CreateFeedbackInput = {
      label: feedbackLabel,
      reason: feedbackReason.trim() || null,
      suggestedSeverity: suggestedSeverity || null,
    }
    const result = finding
      ? findingId ? await service!.createFindingFeedback(analysisId, findingId, body) : (() => { throw new Error('Nhập mã finding trước.') })()
      : await service!.createRunFeedback(analysisId, body)
    setResponse(result); setStatus('Đã gửi feedback.')
  })

  if (!service) return <p>Analysis API chỉ khả dụng trong chế độ đăng nhập trực tuyến.</p>
  if (!project.dataset) return <p>Project cần có dataset trước khi chạy phân tích.</p>

  return <section className={styles['analysisPanel']} aria-label="Phân tích dữ liệu trực tuyến">
    {loading && <p role="status">Đang tải cấu hình phân tích.</p>}
    {error && <p role="alert">{error}</p>}
    {status && <p role="status">{status}</p>}

    <section className={styles['analysisSection']}>
      <h3>Cấu hình phân tích</h3>
      <fieldset className={styles['analysisColumns']}>
        <legend>Cột cần phân tích</legend>
        {columns.map(column => <label key={column.key}>
          <input type="checkbox" checked={selectedColumns.includes(column.key)} onChange={event => {
            setSelectedColumns(current => event.target.checked
              ? [...current, column.key] : current.filter(key => key !== column.key))
          }} />
          {column.name}
        </label>)}
        {!columns.length && <span>Không có schema cột để chọn.</span>}
      </fieldset>
      <label>Cột nhãn
        <select value={labelColumn} onChange={event => setLabelColumn(event.target.value)}>
          <option value="">Không chọn</option>{columns.map(column => <option key={column.key} value={column.key}>{column.name}</option>)}
        </select>
      </label>
      <label>Cột thời gian
        <select value={timeColumn} onChange={event => setTimeColumn(event.target.value)}>
          <option value="">Tự nhận diện</option>{columns.filter(column => column.dataType === 'date').map(column => <option key={column.key} value={column.key}>{column.name}</option>)}
        </select>
      </label>
      <label>Độ hạt thời gian
        <select value={timeGranularity} onChange={event => setTimeGranularity(event.target.value as typeof timeGranularity)}>
          <option value="day">Ngày</option><option value="week">Tuần</option><option value="month">Tháng</option><option value="year">Năm</option>
        </select>
      </label>
      <label>Cột giá trị
        <select value={valueColumn} onChange={event => setValueColumn(event.target.value)}>
          <option value="">Không chọn</option>{columns.filter(column => column.dataType === 'number').map(column => <option key={column.key} value={column.key}>{column.name}</option>)}
        </select>
      </label>
      <label>Tương quan
        <select value={correlationMethod} onChange={event => setCorrelationMethod(event.target.value as typeof correlationMethod)}>
          <option value="pearson">Pearson</option><option value="spearman">Spearman</option>
        </select>
      </label>
      <label>Phát hiện ngoại lệ
        <select value={outlierMethod} onChange={event => setOutlierMethod(event.target.value as typeof outlierMethod)}>
          <option value="iqr">IQR</option><option value="modified_zscore">Modified Z-score</option><option value="both">Cả hai</option>
        </select>
      </label>
      <label>Top N<input type="number" min={1} max={100} value={topN} onChange={event => setTopN(Number(event.target.value))} /></label>
      <div className={styles['analysisActions']}>
        <button disabled={!canExecute || busy || loading || !columns.length} onClick={() => { void saveConfig() }}>Lưu cấu hình</button>
        <button disabled={!canExecute || project.dataset.status !== 'processed' || busy || loading || !columns.length} onClick={() => { void runAnalysis() }}>Chạy phân tích</button>
        <button disabled={busy} onClick={() => { void action(async () => { const result = await service.getResult(project.id); const id = readString(asRecord(result)?.['analysisId']); if (id) setAnalysisId(id); setResponse(result) }) }}>Tải kết quả</button>
      </div>
    </section>

    <section className={styles['analysisSection']}>
      <h3>AI job</h3>
      <label>Mã job<input value={jobId} onChange={event => setJobId(event.target.value)} /></label>
      <div className={styles['analysisActions']}>
        <button disabled={busy || !jobId} onClick={() => { void action(async () => { setResponse(await service.getJob(jobId)) }) }}>Xem trạng thái</button>
        <button disabled={!canExecute || busy || !jobId} onClick={() => { void action(async () => { setResponse(await service.retryJob(jobId)) }) }}>Thử lại job</button>
      </div>
    </section>

    <section className={styles['analysisSection']}>
      <h3>Tổng kết và PDF</h3>
      <label>Mã report<input value={reportId} onChange={event => setReportId(event.target.value)} /></label>
      <div className={styles['analysisActions']}>
        <button disabled={busy} onClick={() => { void action(async () => { setResponse(await service.getSummary(project.id)) }) }}>Tải tổng kết</button>
        <button disabled={!canExecute || busy} onClick={() => { void action(async () => { setResponse(await service.createSummary(project.id)); setStatus('Đã tạo tổng kết.') }) }}>Tạo tổng kết</button>
        <button disabled={!canExecute || busy} onClick={() => { void action(async () => {
          const result = await service.requestReport(project.id)
          const id = readString(asRecord(result)?.['reportId'])
          if (id) setReportId(id)
          setResponse(result); setStatus(id ? 'Đã yêu cầu tạo PDF.' : 'Đã gửi yêu cầu tạo PDF.')
        }) }}>Yêu cầu PDF</button>
        <button disabled={busy || !reportId} onClick={() => { void action(async () => {
          const result = await service.downloadReport(project.id, reportId)
          if (result.status === 'pending') { setResponse(result.metadata); setStatus('PDF chưa sẵn sàng; có thể kiểm tra lại.') ; return }
          const url = URL.createObjectURL(result.file)
          const link = document.createElement('a'); link.href = url; link.download = `report-${reportId}.pdf`; link.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
          setStatus('Đã tải PDF.')
        }) }}>Tải PDF</button>
      </div>
    </section>

    <section className={styles['analysisSection']}>
      <h3>Feedback</h3>
      <label>Mã lần phân tích<input value={analysisId} onChange={event => setAnalysisId(event.target.value)} /></label>
      <label>Mã finding<input value={findingId} onChange={event => setFindingId(event.target.value)} /></label>
      <label>Nhãn feedback
        <select value={feedbackLabel} onChange={event => setFeedbackLabel(event.target.value as typeof feedbackLabel)}>
          {labels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Lý do<input value={feedbackReason} maxLength={2000} onChange={event => setFeedbackReason(event.target.value)} /></label>
      <label>Mức độ đề xuất
        <select value={suggestedSeverity} onChange={event => setSuggestedSeverity(event.target.value as typeof suggestedSeverity)}>
          <option value="">Không đề xuất</option><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option><option value="critical">Nghiêm trọng</option>
        </select>
      </label>
      <div className={styles['analysisActions']}>
        <button disabled={busy || !analysisId} onClick={() => { void submitFeedback() }}>Gửi feedback lần chạy</button>
        <button disabled={busy || !analysisId || !findingId} onClick={() => { void submitFeedback(true) }}>Gửi feedback finding</button>
        <button disabled={busy || !analysisId} onClick={() => { void action(async () => { setResponse(await service.listRunFeedback(analysisId, { limit: 20 })) }) }}>Xem feedback lần chạy</button>
        <button disabled={busy || !analysisId || !findingId} onClick={() => { void action(async () => { setResponse(await service.listFindingFeedback(analysisId, findingId, { limit: 20 })) }) }}>Xem feedback finding</button>
        <button disabled={busy || !feedbackId} onClick={() => { void action(async () => { setResponse(await service.updateFeedback(feedbackId, { label: feedbackLabel, reason: feedbackReason.trim() || null, suggestedSeverity: suggestedSeverity || null })) }) }}>Cập nhật feedback</button>
        <button disabled={busy || !feedbackId} onClick={() => { void action(async () => { setResponse(await service.deleteFeedback(feedbackId)); setStatus('Đã xóa feedback.') }) }}>Xóa feedback</button>
        <button disabled={busy} onClick={() => { void action(async () => { setResponse(await service.getAiQualityMetrics(project.id)) }) }}>Chỉ số chất lượng AI</button>
      </div>
      <label>Mã feedback cần sửa/xóa<input value={feedbackId} onChange={event => setFeedbackId(event.target.value)} /></label>
    </section>

    {response !== null && <details className={styles['analysisResponse']} open>
      <summary>Kết quả phản hồi API</summary>
      <pre>{formatResponse(response)}</pre>
    </details>}
  </section>
}
