import { Dialog } from '../../../../components/ui/overlay/dialog'
import { useManagementStore } from '../../../../hooks/management/use-management-store'
import { usePreviewSession } from '../../../../hooks/workbench/workbench-session-context'
import { validateCsvFile } from '../../../../services/management/upload-validation'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { ConfirmedProjectResult, OfflineWriteStatus } from '../../../../types'
import { Panel } from '../../../../components/resource/presentation/resource-presentation'
import { ResultReviewDialog } from '../../../../components/processing/result-review/result-review-dialog'
import styles from './project-data-actions.module.css'
import { Icon as PreviewIcon } from '../../../../components/ui/primitives/icon'
import { ProjectCsvDropZone } from './project-csv-drop-zone'
import { ApiError } from '../../../../lib/api-error'
import { mutationRefreshFailedCode } from '../../../../services/management/management.types'
import { useUploadDraft } from '../../../../hooks/datasets/use-upload-draft'
import { useAuth } from '../../../../hooks/auth/use-auth'

const emptyQueueStatus: OfflineWriteStatus = Object.freeze({ entries: [], syncing: false, revision: 0, error: null })

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
  const store = useManagementStore()
  const session = usePreviewSession()
  const [file, setFile] = useState<File | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftSaving, setDraftSaving] = useState(false)
  const [queueId, setQueueId] = useState<string | null>(null)
  const { offlineWrites } = useAuth()
  const queueStatus = useSyncExternalStore(offlineWrites?.subscribe ?? (() => () => {}), offlineWrites?.getSnapshot ?? (() => emptyQueueStatus), () => emptyQueueStatus)
  const uploadDrafts = useUploadDraft({ kind: 'project-upload', projectId: session.state.selection.projectId })
  const [phase, setPhase] = useState<'idle' | 'pending' | 'queued' | 'success' | 'refresh-failed'>('idle')
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const projectId = session.state.selection.projectId
  const activeDraft = draftId ? uploadDrafts.allDrafts.find(draft => draft.id === draftId) : undefined
  const queuedEntry = queueId ? queueStatus.entries.find(entry => entry.id === queueId) : undefined
  const busy = phase === 'pending'
  const locked = phase !== 'idle'
  const id = useId()

  useEffect(() => {
    if (phase !== 'success') return
    const timer = window.setTimeout(onClose, 550)
    return () => window.clearTimeout(timer)
  }, [onClose, phase])

  useEffect(() => {
    if (queuedEntry?.state !== 'confirmed' || phase === 'success') return
    setFile(null)
    setDraftId(null)
    setPhase('success')
    void uploadDrafts.refresh()
    session.notify('Backend đã xác nhận upload; bản nháp cục bộ đang được dọn.', 'success')
  }, [queuedEntry?.state, phase, session.notify, uploadDrafts.refresh])

  useEffect(() => {
    if (phase !== 'queued' || !queueId || queuedEntry) return
    void uploadDrafts.refresh().then(drafts => {
      const draft = drafts.find(item => item.id === draftId)
      if (draft?.status !== 'pending' || draft.queueId !== undefined) return
      setQueueId(null)
      setPhase('idle')
      setError('Yêu cầu đã được bỏ khỏi queue; draft vẫn còn và có thể upload lại.')
    })
  }, [phase, queueId, queuedEntry, draftId, uploadDrafts.refresh])

  const selectFile = async (next: File | null) => {
    if (draftSaving) return
    setError('')
    if (!next) { setFile(null); setDraftId(null); return }
    setDraftSaving(true)
    try {
      validateCsvFile(next)
      // Save and hash before enabling upload. A device save is shown as a draft only, never as upload success.
      const draft = await uploadDrafts.save({ projectId, file: next })
      setFile(next)
      setDraftId(draft.id)
    } catch (error) {
      setFile(null)
      setDraftId(null)
      setError(error instanceof Error ? error.message : 'Tệp không hợp lệ.')
    } finally { setDraftSaving(false) }
  }

  const restoreDraft = async (id: string) => {
    try {
      const restored = await uploadDrafts.restoreFile(id)
      validateCsvFile(restored)
      setFile(restored)
      setDraftId(id)
      setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không khôi phục được bản nháp.') }
  }

  const upload = async () => {
    if (!file || locked || draftSaving || inFlight.current || !store.uploadDataset) return
    inFlight.current = true
    setPhase('pending')
    setError('')
    try {
      validateCsvFile(file)
      if (!draftId) throw new Error('Hãy lưu lại bản nháp trên thiết bị trước khi tải lên.')
      const result = await store.uploadDataset(projectId, file, draftId)
      if (result.queued && result.queueId) {
        setQueueId(result.queueId)
        setPhase('queued')
        await uploadDrafts.refresh()
        session.notify(result.message, 'info')
        return
      }
      setDraftId(null)
      setFile(null)
      await uploadDrafts.refresh()
      session.notify(result.message, 'success')
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) onClose()
      else setPhase('success')
    } catch (error) {
      const latest = (await uploadDrafts.refresh()).find(draft => draft.id === draftId)
      if (latest?.status === 'uploaded') { setDraftId(null); setFile(null) }
      setPhase(error instanceof ApiError && error.code === mutationRefreshFailedCode ? 'refresh-failed' : 'idle')
      setError(error instanceof Error ? error.message : 'Không tải được tệp.')
    } finally {
      inFlight.current = false
    }
  }
  const closingLocked = busy || draftSaving || phase === 'success'
  return <Dialog open onClose={onClose} busy={closingLocked} className={styles['screen']} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Upload data</h2>
    {uploadDrafts.drafts.length > 0 && <section aria-label="Bản nháp upload đã lưu" className="action-note">
      <strong>Bản nháp trên thiết bị</strong>
      <ul>
        {uploadDrafts.drafts.map(draft => <li key={draft.id}>
          <span>{draft.fileName} · {Math.ceil(draft.sizeBytes / 1024)} KB · {draft.status === 'acknowledged' ? 'Đã nhận ACK, chờ xác minh' : draft.status === 'uploaded' ? 'Đã xác nhận trên server' : draft.status === 'uploading' ? 'Upload chưa rõ kết quả' : draft.status === 'queued' ? 'Đang chờ queue' : 'Chưa upload'}</span>{' '}
          {draft.status !== 'uploaded' && <button type="button" className="button-secondary" disabled={busy} onClick={() => { void restoreDraft(draft.id) }}>Khôi phục</button>}{' '}
          <button type="button" className="button-secondary" disabled={busy || ['queued', 'uploading', 'acknowledged'].includes(draft.status)} onClick={() => { void uploadDrafts.remove(draft.id).catch(reason => setError(reason instanceof Error ? reason.message : 'Không xóa được bản nháp.')) }}>Xóa</button>
        </li>)}
      </ul>
      {uploadDrafts.error && <span role="alert">{uploadDrafts.error}</span>}
    </section>}
    <ProjectCsvDropZone file={file} phase={phase === 'pending' ? 'pending' : phase === 'success' ? 'success' : 'idle'} disabled={locked || draftSaving}
      descriptionId={`${id}-note`} onSelect={selectFile} />
    <p id={`${id}-note`} className="action-note">CSV UTF-8, tối đa 50 MB. Mỗi project có một dataset. {queuedEntry?.state === 'blocked' || queuedEntry?.state === 'uncertain'
      ? 'Request đang cần đối chiếu; bản nháp vẫn được giữ.'
      : phase === 'queued' ? 'Request đã commit vào IndexedDB và đang chờ backend xác nhận.'
      : activeDraft?.status === 'acknowledged'
      ? 'Server đã ACK upload; đang chờ đối chiếu dataset trước khi dọn file.'
      : activeDraft?.status === 'uploading' ? 'Kết quả request chưa rõ; bản nháp được giữ để tránh upload trùng.'
        : activeDraft?.status === 'queued' ? 'Request đang ở queue; file bản nháp vẫn được giữ.'
          : draftId ? 'Đã lưu bản nháp trên thiết bị; chưa tải lên server.' : 'Chọn tệp để lưu bản nháp trước khi upload.'}</p>
    {!store.uploadDataset && <p className="action-note">Chưa kết nối dịch vụ upload trong chế độ xem trước.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="dialog-actions">
      <button type="button" className="button-secondary" disabled={closingLocked} onClick={onClose}>Đóng</button>
      <button type="button" className={`button-primary ${styles['uploadSubmit']}`} aria-busy={busy}
        disabled={locked || draftSaving || !draftId || !file || !store.uploadDataset} onClick={() => { void upload() }}>
        {busy ? 'Đang tải lên…' : phase === 'queued' ? 'Đã lưu chờ đồng bộ' : phase === 'success' ? 'Đã tải lên' : 'Upload data'}
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
