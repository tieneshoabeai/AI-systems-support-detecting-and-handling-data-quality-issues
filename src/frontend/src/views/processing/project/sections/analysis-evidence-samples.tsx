import { useEffect, useId, useRef, useState } from 'react'
import { isRecord } from '../../../../lib/api-error'
import type { EvidenceSample, EvidenceSampleKind, EvidenceSamplesPage, AnalysisService } from '../../../../services/processing/analysis.service'
import styles from './module-content.module.css'

type Status = 'idle' | 'loading' | 'ready' | 'error'

const kinds: readonly EvidenceSampleKind[] = ['missing', 'duplicate', 'invalid_type', 'outlier']
const kindLabel: Record<EvidenceSampleKind, string> = {
  missing: 'Thiếu dữ liệu',
  duplicate: 'Dòng trùng',
  invalid_type: 'Sai kiểu hoặc định dạng',
  outlier: 'Giá trị ngoại lệ',
}
const isSafeMaskedValue = (value: unknown): value is string | null => value === null
  || value === '' || value === '***'
  || (typeof value === 'string' && value.startsWith('Mẫu: ')
    && /^[Aad *]*$/.test(value.slice('Mẫu: '.length)))

function readPage(value: unknown, expectedFindingId: string): EvidenceSamplesPage {
  if (!isRecord(value) || !Array.isArray(value['items']) || !isRecord(value['meta'])) {
    throw new Error('Máy chủ trả samples không hợp lệ.')
  }
  const { limit, hasMore, nextCursor } = value['meta']
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1
    || typeof hasMore !== 'boolean'
    || (hasMore && (typeof nextCursor !== 'string' || !nextCursor))
    || (!hasMore && nextCursor !== null)) {
    throw new Error('Máy chủ trả phân trang samples không hợp lệ.')
  }

  const items = (value['items'] as unknown[]).map((item): EvidenceSample | null => {
    if (!isRecord(item) || item['findingId'] !== expectedFindingId
      || typeof item['kind'] !== 'string' || !kinds.includes(item['kind'] as EvidenceSampleKind)
      || typeof item['column'] !== 'string'
      || typeof item['rowIndex'] !== 'number' || !Number.isInteger(item['rowIndex']) || item['rowIndex'] < 0
      || (item['reason'] !== null && typeof item['reason'] !== 'string')
      || !isSafeMaskedValue(item['valueMasked'])) return null
    return {
      findingId: item['findingId'],
      kind: item['kind'] as EvidenceSampleKind,
      column: item['column'],
      rowIndex: item['rowIndex'],
      reason: item['reason'] as string | null,
      valueMasked: item['valueMasked'] as string | null,
    }
  })
  if (items.some(item => item === null)) throw new Error('Máy chủ trả sample không hợp lệ.')
  return { items: items.filter((item): item is EvidenceSample => item !== null), meta: { limit, hasMore, nextCursor: typeof nextCursor === 'string' ? nextCursor : null } }
}

function displayReason(reason: string | null, kind: EvidenceSampleKind): string {
  if (!reason || /^dq\d{2}_/i.test(reason)) return kindLabel[kind]
  return reason
}

export function AnalysisEvidenceSamples({ runId, findingId, service }: {
  runId: string
  findingId: string
  service: AnalysisService
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [items, setItems] = useState<EvidenceSample[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [requestCursor, setRequestCursor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const visited = useRef(new Set<string>())

  useEffect(() => {
    if (!open || status !== 'loading') return
    const controller = new AbortController()
    const cursor = requestCursor
    setError('')
    void service.listEvidenceSamples(runId, {
      findingId,
      limit: 20,
      ...(cursor ? { cursor } : {}),
    }, controller.signal).then(value => {
      if (controller.signal.aborted) return
      const page = readPage(value, findingId)
      if (page.meta.nextCursor && (page.meta.nextCursor === cursor || visited.current.has(page.meta.nextCursor))) {
        throw new Error('Máy chủ trả cursor samples bị lặp.')
      }
      if (cursor) visited.current.add(cursor)
      setItems(previous => cursor ? [...previous, ...page.items] : page.items)
      setNextCursor(page.meta.nextCursor)
      setStatus('ready')
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return
      setError(cause instanceof Error ? cause.message : 'Có lỗi khi tải samples.')
      setStatus('error')
    })
    return () => controller.abort()
  }, [findingId, open, requestCursor, runId, service, status])

  const toggle = () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (status === 'idle') setStatus('loading')
  }
  const retry = () => setStatus('loading')
  const loadMore = () => {
    if (!nextCursor || status === 'loading') return
    setRequestCursor(nextCursor)
    setStatus('loading')
  }

  return <section className={styles['evidenceSamples']}>
    <button type="button" className={styles['evidenceToggle']} aria-expanded={open} aria-controls={id} onClick={toggle}>
      {open ? 'Ẩn samples' : 'Xem samples'}
    </button>
    {open && <div className={styles['evidencePanel']} id={id}>
      <p className={styles['sampleHint']}>Số dòng hiển thị bắt đầu từ 1; API dùng rowIndex bắt đầu từ 0 và không tính hàng tiêu đề.</p>
      {status === 'loading' && items.length === 0 && <p role="status" className={styles['muted']}>Đang tải samples…</p>}
      {status === 'error' && <div className={styles['notice']} data-tone="error" role="alert">
        <span>Không tải được samples. {error}</span>
        <button type="button" className={styles['sampleRetry']} onClick={retry}>Thử lại</button>
      </div>}
      {status === 'ready' && items.length === 0 && <p className={styles['muted']}>Không có sample được lưu cho finding này.</p>}
      {items.length > 0 && <div className={styles['tableViewport']} tabIndex={0} role="region" aria-label={`Evidence samples ${findingId}`} aria-busy={status === 'loading'}>
        <table className={styles['table']}>
          <thead><tr><th scope="col">Dòng dữ liệu</th><th scope="col">Cột</th><th scope="col">Giá trị đã che</th><th scope="col">Lý do</th></tr></thead>
          <tbody>{items.map((sample, index) => <tr key={`${sample.kind}:${sample.column}:${sample.rowIndex}:${index}`}>
            <th scope="row">{sample.rowIndex + 1}</th>
            <td>{sample.column === '__row__' ? 'Toàn dòng' : sample.column}</td>
            <td>{sample.valueMasked === null
              ? (sample.kind === 'missing' ? 'Ô trống' : 'Không lưu giá trị ô')
              : sample.valueMasked === '' ? '(giá trị rỗng)' : sample.valueMasked}</td>
            <td>{displayReason(sample.reason, sample.kind)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      {status === 'loading' && items.length > 0 && <p role="status" className={styles['muted']}>Đang tải thêm…</p>}
      {status === 'ready' && nextCursor && <button type="button" className={styles['sampleRetry']} onClick={loadMore}>Xem thêm samples</button>}
    </div>}
  </section>
}
