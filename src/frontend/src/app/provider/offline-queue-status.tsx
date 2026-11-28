import { useState, useSyncExternalStore } from 'react'
import { useAuth } from '../../hooks/auth/use-auth'
import type { OfflineWriteStatus } from '../../types/offline'

const empty: OfflineWriteStatus = Object.freeze({ entries: [], syncing: false, revision: 0, error: null })
const labels = { queued: 'Đang chờ', sending: 'Đang gửi', uncertain: 'Cần đối chiếu', blocked: 'Cần kiểm tra', confirmed: 'Đã xác nhận' } as const

export function OfflineQueueStatus() {
  const { offlineWrites } = useAuth()
  const [actionError, setActionError] = useState<string | null>(null)
  const status = useSyncExternalStore(offlineWrites?.subscribe ?? (() => () => {}), offlineWrites?.getSnapshot ?? (() => empty), () => empty)
  if (!status.entries.length && !status.error && !status.syncing) return null

  const actionStyle = { border: '1px solid #d0d5dd', borderRadius: 8, padding: '5px 9px', background: 'white', color: '#344054', cursor: 'pointer' }
  const run = async (action: () => Promise<void>) => {
    setActionError(null)
    try { await action() }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Không thể cập nhật hàng đợi.') }
  }
  return <aside role="region" aria-label="Hàng đợi đồng bộ" style={{
    position: 'fixed', inset: 'auto 12px 12px auto', zIndex: 19_998, width: 'min(440px, calc(100vw - 24px))',
    maxHeight: 'min(55vh, 520px)', overflow: 'auto', padding: 14, border: '1px solid #98a2b3',
    borderRadius: 12, background: '#fff', color: '#101828', boxShadow: '0 8px 24px rgba(16,24,40,.18)',
    font: '500 13px/1.45 system-ui, sans-serif',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <strong>Hàng đợi đồng bộ {status.syncing ? '· đang chạy' : ''}</strong>
      {offlineWrites && <button type="button" style={actionStyle} disabled={status.syncing} onClick={() => { void run(() => offlineWrites.sync()) }}>
        Đồng bộ ngay
      </button>}
    </div>
    {status.error && <p role="alert" style={{ margin: '8px 0', color: '#b42318' }}>{status.error}</p>}
    {actionError && <p role="alert" style={{ margin: '8px 0', color: '#b42318' }}>{actionError}</p>}
    {status.entries.length > 0 && <ul style={{ display: 'grid', gap: 8, listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
      {[...status.entries].sort((left, right) => Number(left.state === 'confirmed') - Number(right.state === 'confirmed'))
        .map(entry => <li key={entry.id} style={{ borderTop: '1px solid #eaecf0', paddingTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <span><strong>{labels[entry.state]}</strong> · {entry.label}</span>
          {offlineWrites && entry.state === 'confirmed' && <button type="button" style={actionStyle} aria-label={`Xóa ${entry.label} khỏi lịch sử queue`}
            onClick={() => { void run(() => offlineWrites.cancel(entry.id, 'confirmed')) }}>Xóa khỏi lịch sử</button>}
          {offlineWrites && (entry.state === 'blocked' || entry.state === 'uncertain') && <button type="button" style={actionStyle}
            disabled={status.syncing} onClick={() => { void run(() => offlineWrites.recheck(entry.id)) }}>Đối chiếu lại</button>}
          {offlineWrites && entry.state === 'queued' && entry.attempts === 0 && <button type="button" style={actionStyle}
            disabled={status.syncing} onClick={() => { void run(() => offlineWrites.cancel(entry.id, 'queued')) }}>Bỏ yêu cầu</button>}
        </div>
        {entry.error && <p role="alert" style={{ margin: '4px 0 0', color: '#b42318' }}>{entry.error}</p>}
      </li>)}
    </ul>}
  </aside>
}
