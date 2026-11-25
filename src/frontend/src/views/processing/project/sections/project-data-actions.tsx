import { Button } from '../../../../components/ui/controls'
import { Dialog } from '../../../../components/ui/overlay/dialog'
import { useManagementStore } from '../../../../hooks/management/use-management-store'
import { usePreviewSession } from '../../../../hooks/workbench/workbench-session-context'
import { validateCsvFile } from '../../../../services/management/upload-validation'
import { useEffect, useId, useRef, useState } from 'react'
import type { ConfirmedProjectResult } from '../../../../types'
import { Panel } from '../../../../components/resource/presentation/resource-presentation'
import { ResultReviewDialog } from '../../../../components/processing/result-review/result-review-dialog'
import styles from './project-data-actions.module.css'
import { Icon as PreviewIcon } from '../../../../components/ui/primitives/icon'
import { ProjectCsvDropZone } from './project-csv-drop-zone'
import { ApiError } from '../../../../lib/api-error'
import { mutationRefreshFailedCode } from '../../../../services/management/management.types'
import { useUploadDraft } from '../../../../hooks/offline/use-upload-draft'
import { useLocalData, useOfflineStatus } from '../../../../hooks/offline/use-local-data'
import { UploadDraftNotice } from '../../../../components/offline/upload-draft-notice'

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
  const [phase, setPhase] = useState<'idle' | 'pending' | 'success' | 'refresh-failed'>('idle')
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const projectId = session.state.selection.projectId
  const draft = useUploadDraft(projectId)
  const { offline } = useOfflineStatus()
  const supportsQueue = Boolean(useLocalData()?.writes)
  const busy = phase === 'pending'
  const locked = phase !== 'idle'
  const id = useId()

  useEffect(() => {
    if (phase !== 'success') return
    const timer = window.setTimeout(onClose, 550)
    return () => window.clearTimeout(timer)
  }, [onClose, phase])

  const selectFile = (next: File | null) => {
    setError('')
    try {
      if (next) validateCsvFile(next)
      setFile(next)
      if (next) void draft.save(next)
    } catch (error) {
      setFile(null)
      setError(error instanceof Error ? error.message : 'Tệp không hợp lệ.')
    }
  }

  const upload = async () => {
    if (!file || locked || draft.saving || (offline && !supportsQueue) || inFlight.current || !store.uploadDataset) return
    inFlight.current = true
    setPhase('pending')
    setError('')
    try {
      validateCsvFile(file)
      const localDraft = await draft.flush()
      const result = localDraft
        ? await store.uploadDataset(projectId, file, localDraft)
        : await store.uploadDataset(projectId, file)
      if (result.queued) {
        session.notify(result.message, 'info')
        onClose()
        return
      }
      session.notify(result.message, 'success')
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) onClose()
      else setPhase('success')
    } catch (error) {
      setPhase(error instanceof ApiError && error.code === mutationRefreshFailedCode ? 'refresh-failed' : 'idle')
      setError(error instanceof Error ? error.message : 'Không tải được tệp.')
    } finally {
      inFlight.current = false
    }
  }
  const closingLocked = busy || draft.saving || phase === 'success'
  return <Dialog open onClose={onClose} busy={closingLocked} className={styles['screen']} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Upload data</h2>
    <ProjectCsvDropZone file={file} phase={phase === 'refresh-failed' ? 'idle' : phase} disabled={locked || draft.saving}
      descriptionId={`${id}-note`} onSelect={selectFile} />
    <UploadDraftNotice draft={draft.entry} selected={Boolean(file)} saving={draft.saving} notice={draft.notice}
      onRestore={() => { void draft.restore().then(restored => { if (restored) setFile(restored) }) }}
      onRemove={() => { void draft.remove() }} />
    {offline && <p role="status">{supportsQueue ? 'Tệp sẽ được gửi khi kết nối lại.' : 'Kết nối lại để gửi tệp đã lưu nháp.'}</p>}
    <p id={`${id}-note`} className="action-note">CSV UTF-8, tối đa 50 MB. Mỗi project có một dataset.</p>
    {!store.uploadDataset && <p className="action-note">Chưa kết nối dịch vụ upload trong chế độ xem trước.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="dialog-actions">
      <button type="button" className="button-secondary" disabled={closingLocked} onClick={onClose}>Đóng</button>
      <button type="button" className={`button-primary ${styles['uploadSubmit']}`} aria-busy={busy}
        disabled={locked || draft.saving || (offline && !supportsQueue) || !file || !store.uploadDataset} onClick={() => { void upload() }}>
        {busy ? 'Đang tải lên…' : phase === 'success' ? 'Đã tải lên' : offline && supportsQueue ? 'Lưu chờ upload' : 'Upload data'}
      </button>
    </div>
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
    <Panel title={reviewOnly ? 'Đánh giá' : 'Kết quả xử lý'} className={`project-result-actions ${styles['screen']}`}>
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
