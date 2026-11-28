import type { RecordValue } from './type'
import { useEffect, useRef, useState } from 'react'

import { useManagementStore } from '../../../../hooks/management/use-management-store'
import type { Project } from '../../../../types/management/management.types'
import { AnalysisFeedbackPanel } from './analysis-feedback-panel'
import { ApiError } from '../../../../lib/api-error'
import { ModuleNotice } from './module-notice'
import { AnalysisResultOverview } from './analysis-result-overview'
import { AnalysisJobPanel } from './analysis-job-panel'
import type { AnalysisService } from '../../../../services/processing/analysis.service'
import { Button } from '../../../../components/ui/primitives/button'
import { Input } from '../../../../components/ui/primitives/input'
import { Select } from '../../../../components/ui/form/select'
import styles from './module-content.module.css'

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

async function readJobRecord(service: AnalysisService, jobId: string, analysisId: string, signal?: AbortSignal): Promise<RecordValue> {
  const record = asRecord(await service.getJob(jobId, signal))
  if (record?.['jobId'] !== jobId || record['analysisRunId'] !== analysisId) {
    throw new Error('Máy chủ trả về tác vụ không khớp với lần phân tích hiện tại.')
  }
  return record
}

export function LiveAnalysisPanel({ project, canExecute }: {
  project: Project
  canExecute: boolean
}) {
  const store = useManagementStore()
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
  const [jobRecord, setJobRecord] = useState<RecordValue | null>(null)
  const [jobError, setJobError] = useState('')
  const [jobOperation, setJobOperation] = useState<'check' | 'retry' | null>(null)
  const [jobPolling, setJobPolling] = useState(false)
  const [jobCheckedAt, setJobCheckedAt] = useState<Date | null>(null)
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)
  const mutationActive = useRef(false)
  const [reportId, setReportId] = useState('')
  const [response, setResponse] = useState<unknown>(null)
  const [technicalOpen, setTechnicalOpen] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const updateConnection = () => setOffline(!navigator.onLine)
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
    }
  }, [])
  useEffect(() => {
    if (!service || !datasetId) return
    const controller = new AbortController()
    void service.getResult(project.id, controller.signal).then(result => {
      if (!controller.signal.aborted) {
        const record = asRecord(result)
        setLatestResult(record)
        setJobId(jobFromResult(record))
      }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted && !missingResult(cause)) setResultError(message(cause))
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingResult(false)
    })
    return () => controller.abort()
  }, [datasetId, project.id, service])

  useEffect(() => {
    setJobPolling(false)
    if (!service || !jobId || !analysisId || offline) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let checks = 0

    const check = async () => {
      setJobPolling(true)
      let continuePolling = false
      try {
        const record = await readJobRecord(service, jobId, analysisId, controller.signal)
        if (controller.signal.aborted) return
        setJobRecord(record)
        setJobCheckedAt(new Date())
        setJobError('')
        const jobStatus = record['status']
        if (jobStatus === 'pending' || jobStatus === 'running') {
          checks += 1
          if (checks < maxJobChecks) {
            timer = setTimeout(() => { void check() }, pollIntervalMs)
            continuePolling = true
            return
          }
          setJobError('Đã tạm dừng theo dõi tự động. Bạn có thể kiểm tra lại trạng thái.')
        } else if (jobStatus === 'succeeded') {
          const result = asRecord(await service.getResult(project.id, controller.signal))
          if (!controller.signal.aborted && result?.['analysisRunId'] === analysisId) {
            setLatestResult(result)
            setResultError('')
          }
        }
      } catch (cause) {
        if (!controller.signal.aborted) setJobError(message(cause))
      } finally {
        if (!controller.signal.aborted) setJobPolling(continuePolling)
      }
    }

    timer = setTimeout(() => { void check() }, 0)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [analysisId, jobId, offline, project.id, service])

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
    setJobRecord(null)
    setJobError('')
    setJobCheckedAt(null)
    setResponse(null); setStatus('Đã nhận kết quả chạy phân tích.')
  })
  const loadResult = () => action(async () => {
    const result = await service!.getResult(project.id)
    const record = asRecord(result)
    const nextJobId = jobFromResult(record)
    if (objectId(record?.['analysisRunId']) !== analysisId) setReportId('')
    setLatestResult(record)
    if (nextJobId !== jobId) {
      setJobId(nextJobId)
      setJobRecord(null)
      setJobCheckedAt(null)
      setJobError('')
    }
    setResultError('')
    setResponse(null)
  })

  const checkJob = async () => {
    if (!service || !jobId || !analysisId || jobOperation || offline) return
    setJobOperation('check')
    setJobError('')
    try {
      const record = await readJobRecord(service, jobId, analysisId)
      setJobRecord(record)
      setJobCheckedAt(new Date())
      if (record['status'] === 'succeeded') {
        const result = asRecord(await service.getResult(project.id))
        if (result?.['analysisRunId'] === analysisId) {
          setLatestResult(result)
          setResultError('')
        }
      }
    } catch (cause) {
      setJobError(message(cause))
    } finally {
      setJobOperation(null)
    }
  }

  const retryJob = async () => {
    if (!service || !jobId || !canExecute || offline || mutationActive.current) return
    mutationActive.current = true
    setBusy(true)
    setJobOperation('retry')
    setJobError('')
    setError('')
    try {
      const response = asRecord(await service.retryJob(jobId))
      const nextJobId = objectId(response?.['jobId'])
      if (!nextJobId) throw new Error('Máy chủ không trả mã job mới để theo dõi.')
      setJobId(nextJobId)
      setJobRecord(null)
      setJobCheckedAt(null)
      setStatus('Đã gửi yêu cầu chạy lại phân tích AI.')
    } catch (cause) {
      setJobError(message(cause))
    } finally {
      setJobOperation(null)
      mutationActive.current = false
      setBusy(false)
    }
  }

  if (!service) return <ModuleNotice>Analysis API chỉ khả dụng trong chế độ đăng nhập trực tuyến.</ModuleNotice>
  if (!project.dataset) return <ModuleNotice>Project cần có dataset trước khi chạy phân tích.</ModuleNotice>

  const validOptions = Number.isInteger(topN) && topN >= 1 && topN <= 100
    && Number.isInteger(chartTopN) && chartTopN >= 1 && chartTopN <= 20
  const runBlocked = project.dataset.status !== 'processed' ? 'Tập dữ liệu cần xử lý xong trước khi phân tích.'
    : !canExecute ? 'Bạn có quyền xem nhưng chưa có quyền chạy phân tích.'
      : !validOptions ? 'Top N cần từ 1–100 và Top N biểu đồ từ 1–20.' : ''

  return <section className={styles['stack']} aria-label="Phân tích dữ liệu trực tuyến">
    {error && <ModuleNotice tone="error">{error}</ModuleNotice>}
    {status && <p role="status">{status}</p>}

    <section className={styles['card']}>
      <div className={styles['cardHeading']}>
        <div><h3>{project.dataset.fileName}</h3><p>{runBlocked || 'Tập dữ liệu đã sẵn sàng.'}</p></div>
        <Button disabled={Boolean(runBlocked) || busy || loadingResult}
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

    {(jobId || asRecord(latestResult?.['aiCorrelationAssessment'])) && <AnalysisJobPanel
      jobId={jobId} job={jobRecord} assessment={latestResult?.['aiCorrelationAssessment'] ?? null}
      busy={busy} operation={jobOperation} polling={jobPolling} offline={offline} checkedAt={jobCheckedAt}
      error={jobError} canRetry={canExecute} onCheck={() => { void checkJob() }} onRetry={() => { void retryJob() }}
      onResult={() => { void loadResult() }} />}

    <section className={styles['card']} aria-label="Kết quả phân tích">
      <div className={styles['cardHeading']}>
        <h3>Kết quả gần nhất</h3>
        <Button variant="secondary" disabled={busy || loadingResult} onClick={() => { void loadResult() }}>Tải lại kết quả</Button>
      </div>
      {loadingResult ? <ModuleNotice tone="loading">Đang tải kết quả…</ModuleNotice>
        : resultError ? <ModuleNotice tone="error">{resultError}</ModuleNotice>
          : latestResult ? <AnalysisResultOverview result={latestResult} runId={analysisId} service={service} />
            : <ModuleNotice>Chưa có kết quả phân tích cho project này.</ModuleNotice>}
    </section>

    <details className={styles['disclosure']}>
      <summary>Tổng kết và PDF</summary>
      <div className={styles['disclosureBody']}>
        <label className={styles['field']}>Mã report<Input value={reportId} onChange={event => setReportId(event.target.value)} /></label>
        <div className={styles['actions']}>
          <Button variant="secondary" disabled={busy} onClick={() => { void action(async () => { setResponse(await service.getSummary(project.id)) }) }}>Tải tổng kết</Button>
          <Button variant="secondary" disabled={!canExecute || busy} onClick={() => { void action(async () => { setResponse(await service.createSummary(project.id)); setStatus('Đã tạo tổng kết.') }) }}>Tạo tổng kết</Button>
          <Button variant="secondary" disabled={!canExecute || busy} onClick={() => { void action(async () => {
            const result = await service.requestReport(project.id)
            const id = readString(asRecord(result)?.['reportId'])
            if (id) setReportId(id)
            setResponse(result); setStatus(id ? 'Đã yêu cầu tạo PDF.' : 'Đã gửi yêu cầu tạo PDF.')
          }) }}>Yêu cầu PDF</Button>
          <Button variant="secondary" disabled={busy || !reportId} onClick={() => { void action(async () => {
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
