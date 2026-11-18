import { Button, Input } from '../../../../components/ui/controls'
import { Dialog } from '../../../../components/ui/overlay/dialog'
import { useManagementStore } from '../../../../hooks/preview/use-preview-store'
import { usePreviewSession } from '../../../preview/preview-session-context'
import { validateCsvFile } from '../../../../services/management/upload-validation'
import { useId, useState } from 'react'
import type { ConfirmedProjectResult } from '../../../../types'
import { Panel } from '../../../preview/components/preview-primitives'
import { ResultReviewDialog } from '../../../preview/components/result-review-dialog'
import styles from './project-data-actions.module.css'
import { PreviewIcon } from '../../../preview/components/preview-icons'

export function ProjectResultDownload({ result }: { result: ConfirmedProjectResult | null }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const id = useId()
  const note = !result?.download ? 'Chưa có file kết quả sau xử lý để tải xuống.' : 'Tải file kết quả sau xử lý xuống máy tính.'
  const download = async () => {
    if (!result?.download || busy) return
    setBusy(true)
    setError(false)
    try { await result.download() }
    catch { setError(true) }
    finally { setBusy(false) }
  }
  return <span className="project-download">
    <Button type="button" className="icon-button" aria-label="Tải file kết quả" title={note}
      disabled={!result?.download || busy} aria-describedby={id} onClick={() => { void download() }}>
      <PreviewIcon name="file" />
    </Button>
    <span id={id} className="visually-hidden">{busy ? 'Đang tải…' : note}</span>
    {error && <span role="alert">Không tải được kết quả. Hãy thử lại.</span>}
  </span>
}

export function ProjectUploadDialog({ onClose }: { onClose: () => void }) {
  const store = useManagementStore()
  const session = usePreviewSession()
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const projectId = session.state.selection.projectId
  const upload = async () => {
    if (!file || busy || !store.uploadDataset) return
    setBusy(true); setError('')
    try {
      validateCsvFile(file)
      const result = await store.uploadDataset(projectId, file)
      session.notify(result.message, 'success'); onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'Không tải được tệp.') }
    finally { setBusy(false) }
  }
  const id = useId()
  return <Dialog open onClose={onClose} busy={busy} className={styles['screen']} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Upload data</h2>
    <label className="dialog-field"><span>Chọn tệp dữ liệu</span><Input type="file" accept=".csv,text/csv" disabled={busy} onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    {file && <p>Đã chọn trên thiết bị: {file.name}</p>}
    <p className="action-note">CSV UTF-8, tối đa 50 MB. Mỗi project có một dataset.</p>
    {!store.uploadDataset && <p className="action-note">Chưa kết nối dịch vụ upload trong chế độ xem trước.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="dialog-actions"><Button className="button-secondary" disabled={busy} onClick={onClose}>Đóng</Button><Button className="button-primary" aria-busy={busy} disabled={busy || !file || !store.uploadDataset} onClick={() => { void upload() }}>Upload data</Button></div>
  </Dialog>
}

export function ProjectResultActions({ result, reviewOnly = false }: { result: ConfirmedProjectResult | null; reviewOnly?: boolean }) {
  const id = useId()
  const [reviewing, setReviewing] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saved = result !== null && result.id === savedId
  const canDownload = saved && Boolean(result?.download)
  const download = async () => {
    if (!canDownload || !result?.download || downloading) return
    setDownloading(true)
    setError(null)
    try { await result.download() }
    catch { setError('Không tải được tệp. Kết quả đã lưu trong hệ thống; hãy thử tải lại.') }
    finally { setDownloading(false) }
  }
  return <>
    <Panel title={reviewOnly ? 'Đánh giá' : 'Kết quả xử lý'} className={`${styles['screen']} project-result-actions`}>
      <p id={`${id}-save-note`} className="action-note">{!result
        ? 'Chưa có kết quả xử lý được xác nhận từ hệ thống. Chưa thể đánh giá hoặc lưu kết quả.'
        : saved ? 'Đã lưu đánh giá và kết quả vào hệ thống.' : 'Bạn cần đánh giá 1–5 sao và nhập nội dung trước khi lưu kết quả vào hệ thống.'}</p>
      <div className="project-result-buttons">
        <Button type="button" className="button-primary" disabled={!result || saved} aria-describedby={`${id}-save-note`}
          onClick={() => setReviewing(true)}>Đánh giá và lưu kết quả</Button>
        {!reviewOnly && <Button type="button" className="button-secondary" disabled={!canDownload || downloading}
          aria-describedby={`${id}-download-note`} onClick={() => { void download() }}>{downloading ? 'Đang tải…' : 'Tải file (tùy chọn)'}</Button>}
      </div>
      {!reviewOnly && <p id={`${id}-download-note`} className="panel-sub">Tải file chỉ khả dụng sau khi lưu thành công và dịch vụ xuất dữ liệu sẵn sàng.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Panel>
    {reviewing && result && <ResultReviewDialog key={result.id} result={result} onClose={() => setReviewing(false)}
      onSaved={() => { setSavedId(result.id); setReviewing(false) }} />}
  </>
}
