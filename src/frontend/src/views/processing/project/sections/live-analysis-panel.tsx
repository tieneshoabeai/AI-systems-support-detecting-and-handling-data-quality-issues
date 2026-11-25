import { Button, Input, Select } from '../../../../components/ui/controls'
import { useEffect, useRef, useState } from 'react'

import { useManagementStore } from '../../../../hooks/preview/use-preview-store'
import type { Project } from '../../../../types/preview/preview.types'
import { AnalysisFeedbackPanel } from './analysis-feedback-panel'
import { ApiError } from '../../../../lib/api-error'
import { ModuleNotice } from './module-notice'
import { AnalysisResultOverview } from './analysis-result-overview'
import { AnalysisJobPanel } from './analysis-job-panel'
import styles from './module-content.module.css'
import { useLocalData, useOfflineStatus } from '../../../../hooks/offline/use-local-data'

type RecordValue = Record<string, unknown>
const asRecord = (value: unknown): RecordValue | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as RecordValue : null
const readString = (value: unknown): string => typeof value === 'string' ? value : ''
const objectId = (value: unknown) => /^[a-f\d]{24}$/i.test(readString(value)) ? readString(value) : ''
const missingResult = (error: unknown) => error instanceof ApiError && error.status === 404
  && /Chưa có lần phân tích|Chưa có kết quả phân tích/.test(error.message)
const jobFromResult = (result: RecordValue | null) => objectId(result?.['jobId'])
  || objectId(readString(result?.['pollUrl']).match(/\/analysis\/jobs\/([a-f\d]{24})$/i)?.[1])
const pollIntervalMs = 2000
const maxJobChecks = 30

const formatResponse = (value: unknown): string => JSON.stringify(value, null, 2) ?? String(value)
const message = (error: unknown) => error instanceof Error ? error.message : 'Yêu cầu không thành công.'

export function LiveAnalysisPanel({ project, canExecute }: {
  project: Project
  canExecute: boolean
}) {
  const store = useManagementStore()
  const local = useLocalData()
  const { offline } = useOfflineStatus()
  const service = store.analysisService
  const [correlationMethod, setCorrelationMethod] = useState<'pearson' | 'spearman'>('pearson')
  const [outlierMethod, setOutlierMethod] = useState<'iqr' | 'modified_zscore' | 'both'>('iqr')
  const [topN, setTopN] = useState(10)
  const [chartTopN, setChartTopN] = useState(5)
  const datasetId = project.dataset?.id
  const [latestResult, setLatestResult] = useState<RecordValue | null>(null)
  const [loadingResult, setLoadingResult] = useState(true)
  const [resultError, setResultError] = useState('')
  const analysisId = objectId(latestResult?.['analysisRunId'])
  const [jobId, setJobId] = useState('')
  const [job, setJob] = useState<unknown>(null)
  const assessment = latestResult?.['aiCorrelationAssessment']
  const [polling, setPolling] = useState(false)
  const mutationActive = useRef(false)
  const [jobOperation, setJobOperation] = useState<'check' | 'retry' | null>(null)
  const [jobCheckedAt, setJobCheckedAt] = useState<Date | null>(null)
  const [jobError, setJobError] = useState('')
  const [reportId, setReportId] = useState('')
  const [savedReports, setSavedReports] = useState<{ reportId: string; savedAt: number }[]>([])
  useEffect(() => {
    if (!local) return
    let active = true
    void local.offline.listReports(project.id).then(rows => { if (active) setSavedReports(rows) }).catch(() => {})
    return () => { active = false }
  }, [local, project.id, offline])
  const [response, setResponse] = useState<unknown>(null)
  const [technicalOpen, setTechnicalOpen] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!service || !datasetId) return
    const controller = new AbortController()
    void service.getResult(project.id, controller.signal).then(result => {
      if (!controller.signal.aborted) setLatestResult(asRecord(result))
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted && !missingResult(cause)) setResultError(message(cause))
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingResult(false)
    })
    return () => controller.abort()
  }, [datasetId, project.id, service])

  useEffect(() => {
    if (!service || !jobId || !analysisId || jobOperation !== null || offline) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let checks = 0
    const serviceForJob = service

    const check = async () => {
      setPolling(true)
      try {
        const payload = await serviceForJob.getJob(jobId, controller.signal)
        if (controller.signal.aborted) return
        const record = asRecord(payload)
        if (record?.['jobId'] !== jobId || record['analysisRunId'] !== analysisId) {
          throw new Error('Máy chủ trả về tác vụ không khớp với lần phân tích hiện tại.')
        }
        setJob(record)
        setJobCheckedAt(new Date())
        const jobStatus = record['status']
        if (jobStatus === 'pending' || jobStatus === 'running') {
          checks += 1
          if (checks < maxJobChecks) {
            timer = setTimeout(() => { void check() }, pollIntervalMs)
            return
          }
          setJobError('Đã tạm dừng theo dõi. Bạn có thể kiểm tra lại trạng thái.')
        } else if (jobStatus === 'succeeded') {
          const result = asRecord(await serviceForJob.getResult(project.id, controller.signal))
          if (!controller.signal.aborted && result?.['analysisRunId'] === analysisId) {
            setLatestResult(result)
          }
        }
      } catch (cause) {
        if (!controller.signal.aborted) setJobError(message(cause))
      }
      if (!controller.signal.aborted) setPolling(false)
    }

    timer = setTimeout(() => { void check() }, 0)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [analysisId, jobId, jobOperation, offline, project.id, service])

  const action = async (operation: () => Promise<void>) => {
    if (mutationActive.current) return
    mutationActive.current = true
    setBusy(true); setError(''); setStatus('')
    try { await operation() } catch (cause) { setError(message(cause)) } finally { mutationActive.current = false; setBusy(false) }
  }
  const runAnalysis = () => action(async () => {
    const result = await service!.run(project.id, {
      correlation_method: correlationMethod,
      outlier_method: outlierMethod,
      top_n: topN,
      chart_top_n: chartTopN,
    })
    const record = asRecord(result)
    setLatestResult(record)
    setResultError('')
    setReportId('')
    setJobId(jobFromResult(record))
    setJob(null)
    setPolling(false)
    setJobCheckedAt(null)
    setJobError('')
    setResponse(null); setStatus('Đã nhận kết quả chạy phân tích.')
  })
  const loadResult = () => action(async () => {
    if (offline) return
    const result = await service!.getResult(project.id)
    const record = asRecord(result)
    if (objectId(record?.['analysisRunId']) !== analysisId) {
      setReportId('')
      setJobId('')
      setJob(null)
      setPolling(false)
    }
    setLatestResult(record)
    setResultError('')
    setResponse(null)
  })

  const changeJob = (operation: 'check' | 'retry') => action(async () => {
    const id = jobId.trim()
    if (offline || !service || !id || (operation === 'retry' && !canExecute)) return
    setPolling(false)
    setJobOperation(operation)
    setJobError('')
    try {
      const result = operation === 'check' ? await service.getJob(id) : await service.retryJob(id)
      const record = asRecord(result)
      const nextId = objectId(record?.['jobId'])
      if (operation === 'retry') {
        if (!nextId) throw new Error('Máy chủ chưa trả mã tác vụ mới.')
        setJobId(nextId)
      } else if (nextId !== id || record?.['analysisRunId'] !== analysisId) {
        throw new Error('Máy chủ trả về tác vụ không khớp với lần phân tích hiện tại.')
      }
      setJob(result)
      setJobCheckedAt(new Date())
    } catch (cause) {
      setJobError(message(cause))
    } finally {
      setJobOperation(null)
    }
  })

  if (!service) return <p>Analysis API chỉ khả dụng trong chế độ đăng nhập trực tuyến.</p>
  if (!project.dataset) return <p>Project cần có dataset trước khi chạy phân tích.</p>

  const validOptions = Number.isInteger(topN) && topN >= 1 && topN <= 100
    && Number.isInteger(chartTopN) && chartTopN >= 1 && chartTopN <= 20
  const runBlocked = offline ? 'Kết nối lại để chạy phân tích mới.'
    : project.dataset.status !== 'processed' ? 'Tập dữ liệu cần xử lý xong trước khi phân tích.'
    : !canExecute ? 'Bạn có quyền xem nhưng chưa có quyền chạy phân tích.'
      : !validOptions ? 'Top N cần từ 1–100 và Top N biểu đồ từ 1–20.' : ''

  return <section className={styles['stack']} aria-label="Phân tích dữ liệu">
    {error && <p role="alert">{error}</p>}
    {status && <p role="status">{status}</p>}

    <section className={styles['card']}>
      <div className={styles['cardHeading']}>
        <div><h3>{project.dataset.fileName}</h3><p>{runBlocked || 'Tập dữ liệu đã sẵn sàng.'}</p></div>
        <Button className="button-primary" disabled={Boolean(runBlocked) || busy || loadingResult}
          onClick={() => { void runAnalysis() }}>Chạy phân tích</Button>
      </div>
      <details className={styles['disclosure']}>
        <summary>Tùy chỉnh phân tích</summary>
        <div className={styles['disclosureBody']}>
          <div className={styles['fields']}>
            <label>Tương quan
              <Select value={correlationMethod} onChange={event => setCorrelationMethod(event.target.value as typeof correlationMethod)}>
                <option value="pearson">Pearson</option><option value="spearman">Spearman</option>
              </Select>
            </label>
            <label>Phát hiện ngoại lệ
              <Select value={outlierMethod} onChange={event => setOutlierMethod(event.target.value as typeof outlierMethod)}>
                <option value="iqr">IQR</option><option value="modified_zscore">Modified Z-score</option><option value="both">Cả hai</option>
              </Select>
            </label>
            <label>Top N<Input type="number" min={1} max={100} value={topN} onChange={event => setTopN(Number(event.target.value))} /></label>
            <label>Top N biểu đồ<Input type="number" min={1} max={20} value={chartTopN} onChange={event => setChartTopN(Number(event.target.value))} /></label>
          </div>
        </div>
      </details>
    </section>

    <section className={styles['card']} aria-label="Kết quả phân tích">
      <div className={styles['cardHeading']}>
        <h3>Kết quả gần nhất</h3>
        <Button className="button-secondary" disabled={offline || busy || loadingResult} onClick={() => { void loadResult() }}>Tải lại kết quả</Button>
      </div>
      {loadingResult ? <ModuleNotice tone="loading">Đang tải kết quả…</ModuleNotice>
        : resultError ? <ModuleNotice tone="error">{resultError}</ModuleNotice>
          : latestResult ? <AnalysisResultOverview result={latestResult} runId={analysisId} service={service} />
            : <ModuleNotice>Chưa có kết quả phân tích cho project này.</ModuleNotice>}
    </section>

    {(Boolean(jobId) || asRecord(assessment) !== null) && <AnalysisJobPanel jobId={jobId} job={job} assessment={assessment} busy={busy} operation={jobOperation} polling={polling && !offline} offline={offline}
      checkedAt={jobCheckedAt} error={jobError} canRetry={canExecute}
      onCheck={() => { void changeJob('check') }} onRetry={() => { void changeJob('retry') }}
      onResult={() => { void loadResult() }} />}

    <details className={styles['disclosure']}>
      <summary>Tổng kết và PDF</summary>
      <div className={styles['disclosureBody']}>
        {savedReports.length > 0 && <label className={styles['field']}>PDF đã lưu trên thiết bị
          <Select aria-label="PDF đã lưu trên thiết bị" value={reportId} onChange={event => setReportId(event.target.value)}>
            <option value="">Chọn bản đã lưu</option>
            {savedReports.map(report => <option key={report.reportId} value={report.reportId}>{new Date(report.savedAt).toLocaleString('vi-VN')}</option>)}
          </Select>
        </label>}
        <label className={styles['field']}>Mã report<Input value={reportId} onChange={event => setReportId(event.target.value)} /></label>
        <div className={styles['actions']}>
          <Button className="button-secondary" disabled={busy} onClick={() => { void action(async () => { setResponse(await service.getSummary(project.id)) }) }}>Tải tổng kết</Button>
          <Button className="button-secondary" disabled={!canExecute || busy} onClick={() => { void action(async () => { setResponse(await service.createSummary(project.id)); setStatus('Đã tạo tổng kết.') }) }}>Tạo tổng kết</Button>
          <Button className="button-secondary" disabled={!canExecute || busy} onClick={() => { void action(async () => {
            const result = await service.requestReport(project.id)
            const id = readString(asRecord(result)?.['reportId'])
            if (id) setReportId(id)
            setResponse(result); setStatus(id ? 'Đã yêu cầu tạo PDF.' : 'Đã gửi yêu cầu tạo PDF.')
          }) }}>Yêu cầu PDF</Button>
          <Button className="button-secondary" disabled={busy || !reportId} onClick={() => { void action(async () => {
            const result = await service.downloadReport(project.id, reportId)
            if (result.status === 'pending') {
              const metadata = asRecord(result.metadata)
              setResponse(result.metadata)
              if (metadata?.['status'] === 'failed') {
                const detail = readString(asRecord(metadata['error'])?.['message']) || readString(metadata['error'])
                throw new Error(detail ? `Không tạo được PDF. ${detail}` : 'Không tạo được PDF. Hãy yêu cầu tạo lại.')
              }
              setStatus('PDF đang được tạo. Kiểm tra lại sau.')
              return
            }
            const url = URL.createObjectURL(result.file)
            const link = document.createElement('a'); link.href = url; link.download = `report-${reportId}.pdf`; link.click()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
            setStatus('Đã tải PDF.')
            if (local) setSavedReports(await local.offline.listReports(project.id).catch(() => []))
          }) }}>Tải PDF</Button>
        </div>
      </div>
    </details>

    <AnalysisFeedbackPanel key={analysisId} runId={analysisId} service={service} />

    {(latestResult || response !== null) && <details className={styles['disclosure']}
      onToggle={event => setTechnicalOpen(event.currentTarget.open)}>
      <summary>Chi tiết kỹ thuật</summary>
      {technicalOpen && <div className={styles['disclosureBody']}>
        {latestResult && <pre aria-label="Dữ liệu kết quả phân tích" className={styles['response']} tabIndex={0}>{formatResponse(latestResult)}</pre>}
        {response !== null && response !== latestResult &&
          <pre aria-label="Phản hồi thao tác gần nhất" className={styles['response']} tabIndex={0}>{formatResponse(response)}</pre>}
      </div>}
    </details>}
  </section>
}
