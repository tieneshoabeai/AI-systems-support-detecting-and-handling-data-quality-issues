import { useId, useRef, useState } from 'react'
import type { ConfirmedProjectResult } from '../../../types/processing/result-review.types'
import { Panel } from './preview-primitives'
import { ResultReviewDialog } from './result-review-dialog'
import { useDialogFocus } from './preview-surface'
import './project-data-actions.css'
import { PreviewIcon } from './preview-icons'

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
    <button type="button" className="icon-button" aria-label="Tải file kết quả" title={note}
      disabled={!result?.download || busy} aria-describedby={id} onClick={() => { void download() }}>
      <PreviewIcon name="file" />
    </button>
    <span id={id} className="visually-hidden">{busy ? 'Đang tải…' : note}</span>
    {error && <span role="alert">Không tải được kết quả. Hãy thử lại.</span>}
  </span>
}

export function ProjectUploadDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  const [file, setFile] = useState<File | null>(null)
  useDialogFocus(ref, onClose)
  return <div className="preview-dialog-scrim">
    <div ref={ref} className="preview-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Upload data</h2>
      <label className="dialog-field"><span>Chọn tệp dữ liệu</span>
        <input type="file" onChange={event => setFile(event.target.files?.[0] ?? null)} />
      </label>
      {file && <p className="project-file-selection">Đã chọn trên thiết bị: {file.name}</p>}
      <p id={`${id}-unavailable`} className="action-note">Chưa kết nối dịch vụ upload. Tệp chưa được gửi lên hệ thống và chưa được gắn vào Project.</p>
      <div className="dialog-actions">
        <button type="button" className="button-secondary" onClick={onClose}>Đóng</button>
        <button type="button" className="button-primary" disabled aria-describedby={`${id}-unavailable`}>Upload data</button>
      </div>
    </div>
  </div>
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
    <Panel title={reviewOnly ? 'Đánh giá' : 'Kết quả xử lý'} className="project-result-actions">
      <p id={`${id}-save-note`} className="action-note">{!result
        ? 'Chưa có kết quả xử lý được xác nhận từ hệ thống. Chưa thể đánh giá hoặc lưu kết quả.'
        : saved ? 'Đã lưu đánh giá và kết quả vào hệ thống.' : 'Bạn cần đánh giá 1–5 sao và nhập nội dung trước khi lưu kết quả vào hệ thống.'}</p>
      <div className="project-result-buttons">
        <button type="button" className="button-primary" disabled={!result || saved} aria-describedby={`${id}-save-note`}
          onClick={() => setReviewing(true)}>Đánh giá và lưu kết quả</button>
        {!reviewOnly && <button type="button" className="button-secondary" disabled={!canDownload || downloading}
          aria-describedby={`${id}-download-note`} onClick={() => { void download() }}>{downloading ? 'Đang tải…' : 'Tải file (tùy chọn)'}</button>}
      </div>
      {!reviewOnly && <p id={`${id}-download-note`} className="panel-sub">Tải file chỉ khả dụng sau khi lưu thành công và dịch vụ xuất dữ liệu sẵn sàng.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Panel>
    {reviewing && result && <ResultReviewDialog key={result.id} result={result} onClose={() => setReviewing(false)}
      onSaved={() => { setSavedId(result.id); setReviewing(false) }} />}
  </>
}
