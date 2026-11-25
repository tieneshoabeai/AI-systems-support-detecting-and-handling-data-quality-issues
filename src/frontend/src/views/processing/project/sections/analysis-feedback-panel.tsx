import { Button, Select } from '../../../../components/ui/controls'
import { useEffect, useRef, useState } from 'react'
import { CompletionButton } from '../../../../components/ui/primitives/button'
import { usePreviewSession } from '../../../../hooks/preview/preview-session-context'
import { Textarea } from '../../../../components/ui/primitives/textarea'
import { ApiError, isRecord } from '../../../../lib/api-error'
import type { AnalysisService, CreateFeedbackInput } from '../../../../services/processing/analysis.service'
import { ModuleNotice } from './module-notice'
import styles from './module-content.module.css'
import feedbackStyles from './analysis-feedback-panel.module.css'

const labels = {
  correct: 'Chính xác', partially_correct: 'Đúng một phần', false_positive: 'Cảnh báo sai',
  missed_issue: 'Bỏ sót vấn đề', other: 'Khác',
} satisfies Record<CreateFeedbackInput['label'], string>
const severities = { low: 'Thấp', medium: 'Trung bình', high: 'Cao', critical: 'Nghiêm trọng' }
const date = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
const message = (error: unknown) => error instanceof Error ? error.message : 'Thao tác phản hồi thất bại.'
type Severity = keyof typeof severities
type Draft = { label: CreateFeedbackInput['label']; reason: string; severity: Severity | ''; id?: string }
type FeedbackItem = {
  id: string; label: Draft['label']; reason: string; severity: Draft['severity']
  author: string; isMine: boolean; createdAt: Date | null
}

function readItem(value: unknown): FeedbackItem | null {
  if (!isRecord(value) || typeof value['id'] !== 'string' || !value['id']
    || typeof value['label'] !== 'string' || !Object.hasOwn(labels, value['label'])) return null
  const { id, label, reason, suggestedSeverity, authorDisplayName, isMine, createdAt } = value
  const timestamp = typeof createdAt === 'string' ? new Date(createdAt) : null
  return {
    id, label: label as Draft['label'],
    reason: typeof reason === 'string' ? reason : '',
    severity: typeof suggestedSeverity === 'string' && Object.hasOwn(severities, suggestedSeverity)
      ? suggestedSeverity as Severity : '',
    author: typeof authorDisplayName === 'string' && authorDisplayName.trim() ? authorDisplayName : isMine === true ? 'Bạn' : 'Thành viên',
    isMine: isMine === true,
    createdAt: timestamp && Number.isFinite(timestamp.getTime()) ? timestamp : null,
  }
}

function readPage(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value['items']) || !isRecord(value['meta'])) {
    throw new Error('Máy chủ trả danh sách phản hồi không hợp lệ.')
  }
  const { hasMore, nextCursor } = value['meta']
  if (typeof hasMore !== 'boolean' || (hasMore && (typeof nextCursor !== 'string' || !nextCursor))) {
    throw new Error('Máy chủ trả phân trang phản hồi không hợp lệ.')
  }
  const items = (value['items'] as unknown[]).map(readItem)
  if (items.some(item => item === null)) throw new Error('Máy chủ trả phản hồi không hợp lệ.')
  return { items: items.filter(item => item !== null), next: hasMore && typeof nextCursor === 'string' ? nextCursor : null }
}

export function AnalysisFeedbackPanel({ runId, service, finding }: {
  runId: string
  service: AnalysisService
  finding?: { id: string; title: string }
}) {
  const findingId = finding?.id
  const { notify } = usePreviewSession()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [pageRequest, setPageRequest] = useState<{ cursor: string | null }>({ cursor: null })
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'forbidden' | 'error'>('loading')
  const [listError, setListError] = useState('')
  const [draft, setDraft] = useState<Draft | null>(finding ? { label: 'correct', reason: '', severity: '' } : null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [mutationError, setMutationError] = useState('')
  const [notice, setNotice] = useState('')
  const visited = useRef(new Set<string>())
  const mutation = useRef<AbortController | null>(null)
  const completionTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => {
    mutation.current?.abort()
    window.clearTimeout(completionTimer.current)
  }, [])

  useEffect(() => {
    if (!open || !runId) return
    const controller = new AbortController()
    const { cursor } = pageRequest
    if (!cursor) visited.current.clear()
    const query = { limit: 20, ...(cursor ? { cursor } : {}) }
    const request = findingId
      ? service.listFindingFeedback(runId, findingId, query, controller.signal)
      : service.listRunFeedback(runId, query, controller.signal)
    void request
      .then(value => {
        if (controller.signal.aborted) return
        const page = readPage(value)
        if (page.next && (page.next === cursor || visited.current.has(page.next))) {
          throw new Error('Máy chủ trả con trỏ phản hồi lặp lại.')
        }
        if (cursor) visited.current.add(cursor)
        setItems(previous => cursor
          ? [...new Map([...previous, ...page.items].map(item => [item.id, item])).values()] : page.items)
        setNext(page.next)
        setListStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && error.status === 403) {
          setListStatus('forbidden')
          return
        }
        setListError(message(error))
        setListStatus('error')
      })
    return () => controller.abort()
  }, [findingId, open, pageRequest, runId, service])

  const load = (cursor: string | null) => {
    setListStatus('loading')
    setPageRequest({ cursor })
  }

  const mutate = async (operation: (signal: AbortSignal) => Promise<unknown>, done: () => void, refresh = true) => {
    if (mutation.current || submitted) return
    const controller = new AbortController()
    mutation.current = controller
    setSaving(true)
    setMutationError('')
    setNotice('')
    try {
      await operation(controller.signal)
      if (!controller.signal.aborted) {
        done()
        if (refresh) load(null)
      }
    } catch (error) {
      if (!controller.signal.aborted) setMutationError(message(error))
    } finally {
      if (!controller.signal.aborted) {
        mutation.current = null
        setSaving(false)
      }
    }
  }

  const saveDraft = () => {
    if (!draft || saving || submitted) return
    const reason = draft.reason.trim()
    if (!reason && (draft.label === 'false_positive' || draft.label === 'missed_issue' || draft.label === 'other')) {
      setMutationError('Hãy nhập lý do cho đánh giá đã chọn.')
      return
    }
    const body = { label: draft.label, reason: reason || null, suggestedSeverity: draft.severity || null }
    void mutate(signal => {
      if (draft.id) return service.updateFeedback(draft.id, body, signal)
      return findingId ? service.createFindingFeedback(runId, findingId, body, signal) : service.createRunFeedback(runId, body, signal)
    }, () => {
      if (draft.id) {
        setDraft(null)
        setNotice('Đã cập nhật phản hồi.')
        return
      }
      setSubmitted(true)
      notify('Đã gửi phản hồi.', 'success')
      completionTimer.current = window.setTimeout(() => {
        setDraft(null)
        setSubmitted(false)
        load(null)
      }, 700)
    }, Boolean(draft.id))
  }

  return <details className={styles['disclosure']} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className={finding ? feedbackStyles['findingTrigger'] : undefined}>{finding ? 'Feedback' : 'Phản hồi'}</summary>
    {open && <div className={styles['disclosureBody']}>
      {!runId ? <ModuleNotice>Chạy phân tích hoặc tải kết quả trước khi gửi phản hồi.</ModuleNotice>
        : listStatus === 'forbidden' ? <ModuleNotice>Tài khoản này không có quyền xem hoặc gửi phản hồi.</ModuleNotice>
          : <>
            <div className={styles['cardHeading']}>
              <h3>{finding?.title ?? 'Phản hồi lần phân tích'}</h3>
              {listStatus === 'ready' && !draft && !deleteId && <Button className="button-primary" onClick={() => {
                setOpenMenu(null); setNotice(''); setMutationError('')
                setDraft({ label: 'correct', reason: '', severity: '' })
              }}>Viết phản hồi</Button>}
            </div>
            {notice && <p role="status" className={styles['notice']}>{notice}</p>}
            {draft && listStatus === 'ready' && <form className={feedbackStyles['form']} onSubmit={event => { event.preventDefault(); saveDraft() }}>
              <div className={styles['fields']}>
                <label>Đánh giá
                  <Select value={draft.label} disabled={saving || submitted} onChange={event => setDraft({ ...draft, label: event.target.value as Draft['label'] })}>
                    {Object.entries(labels).filter(([value]) => !findingId || value !== 'missed_issue' || draft.label === value)
                      .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>
                </label>
                <label>Mức độ đề xuất
                  <Select value={draft.severity} disabled={saving || submitted} onChange={event => setDraft({ ...draft, severity: event.target.value as Draft['severity'] })}>
                    <option value="">Không đề xuất</option>
                    {Object.entries(severities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>
                </label>
              </div>
              <label className={styles['field']}>Lý do
                <Textarea rows={3} value={draft.reason} disabled={saving || submitted} maxLength={2000}
                  onChange={event => setDraft({ ...draft, reason: event.target.value })} />
              </label>
              {mutationError && <ModuleNotice tone="error">{mutationError}</ModuleNotice>}
              <div className={styles['actions']}>
                <Button className="button-secondary" disabled={saving || submitted} onClick={() => setDraft(null)}>Hủy</Button>
                {draft.id ? <Button className="button-primary" type="submit" loading={saving}>Lưu thay đổi</Button>
                  : <CompletionButton type="submit" state={submitted ? 'success' : saving ? 'pending' : 'idle'}
                    pendingLabel="Đang gửi phản hồi" successLabel="Gửi phản hồi thành công">Gửi phản hồi</CompletionButton>}
              </div>
            </form>}
            {listStatus === 'loading' && <ModuleNotice tone="loading">Đang tải phản hồi…</ModuleNotice>}
            {listStatus === 'error' && <div className={styles['actions']}>
              <ModuleNotice tone="error">{listError}</ModuleNotice>
              <Button className="button-secondary" onClick={() => load(pageRequest.cursor)}>Tải lại</Button>
            </div>}
            {listStatus === 'ready' && !items.length && <ModuleNotice>
              {finding ? 'Chưa có phản hồi cho phát hiện này.' : 'Chưa có phản hồi cho lần phân tích này.'}
            </ModuleNotice>}
            {items.length > 0 && <ul className={feedbackStyles['list']}>
              {items.map(item => <li key={item.id} className={feedbackStyles['item']}>
                <div className={styles['cardHeading']}>
                  <div className={feedbackStyles['identity']}>
                    <strong>{item.author}</strong><span className={styles['pill']}>{labels[item.label]}</span>
                    {item.createdAt && <time dateTime={item.createdAt.toISOString()}>{date.format(item.createdAt)}</time>}
                  </div>
                  {item.isMine && !draft && !deleteId && <Button variant="plain" className={feedbackStyles['more']}
                    aria-expanded={openMenu === item.id} aria-label={`Thao tác phản hồi của ${item.author}`}
                    onClick={() => setOpenMenu(openMenu === item.id ? null : item.id)}>⋯</Button>}
                </div>
                {item.reason && <p className={feedbackStyles['reason']}>{item.reason}</p>}
                {item.severity && <p className={styles['muted']}>Mức độ đề xuất: {severities[item.severity]}</p>}
                {openMenu === item.id && <div className={styles['actions']}>
                  <Button className="button-secondary" onClick={() => {
                    setOpenMenu(null); setMutationError('')
                    setDraft({ id: item.id, label: item.label, reason: item.reason, severity: item.severity })
                  }}>Sửa</Button>
                  <Button variant="plain" className={feedbackStyles['danger']} onClick={() => {
                    setOpenMenu(null); setMutationError(''); setDeleteId(item.id)
                  }}>Xóa</Button>
                </div>}
                {deleteId === item.id && <div className={feedbackStyles['form']}>
                  <p>Xóa phản hồi này?</p>
                  {mutationError && <ModuleNotice tone="error">{mutationError}</ModuleNotice>}
                  <div className={styles['actions']}>
                    <Button className="button-secondary" disabled={saving} onClick={() => setDeleteId(null)}>Hủy</Button>
                    <Button className="button-danger" loading={saving} onClick={() => { void mutate(async signal => {
                      const result = await service.deleteFeedback(item.id, signal)
                      if (!isRecord(result) || result['deleted'] !== true) throw new Error('Chưa xác nhận được phản hồi đã xóa.')
                    }, () => {
                      setItems(previous => previous.filter(entry => entry.id !== item.id))
                      setDeleteId(null)
                      setNotice('Đã xóa phản hồi.')
                    }) }}>Xác nhận xóa</Button>
                  </div>
                </div>}
              </li>)}
            </ul>}
            {next && listStatus === 'ready' && <Button className="button-secondary" onClick={() => load(next)}>Xem thêm</Button>}
          </>}
    </div>}
  </details>
}
