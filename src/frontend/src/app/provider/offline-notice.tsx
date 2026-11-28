import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useAuth } from '../../hooks/auth/use-auth'
import type { ApiTargetManagerSnapshot } from '../../lib/api-target-manager'
import type { OfflineDataSnapshot, OfflineWriteStatus } from '../../types/offline'

const emptyLocal: OfflineDataSnapshot = Object.freeze({ fallbacks: [], cacheMisses: [] })
const emptyQueue: OfflineWriteStatus = Object.freeze({ entries: [], syncing: false, revision: 0, error: null })
const emptyTarget: ApiTargetManagerSnapshot = Object.freeze({
  phase: 'ready',
  target: Object.freeze({ baseUrl: '', prefix: '/api/v1', environmentId: '', revision: 0 }),
  pendingTarget: null,
  error: null,
})
const noSubscription = () => () => {}
const getEmptyLocal = () => emptyLocal
const getEmptyQueue = () => emptyQueue
const getEmptyTarget = () => emptyTarget
const time = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' })
const stateLabels = {
  queued: 'Đang chờ',
  sending: 'Đang gửi',
  uncertain: 'Chưa rõ kết quả',
  blocked: 'Bị chặn · cần kiểm tra',
  confirmed: 'Backend đã xác nhận',
} as const

const apiUrl = (target: { baseUrl: string; prefix: string } | null) => target
  ? `${target.baseUrl}${target.prefix}` : ''

export function OfflineNotice() {
  const { snapshot, localData, offlineWrites, apiTargetManager, retryConnection } = useAuth()
  const localSnapshot = useSyncExternalStore(localData?.subscribe ?? noSubscription,
    localData?.getSnapshot ?? getEmptyLocal, getEmptyLocal)
  const queue = useSyncExternalStore(offlineWrites?.subscribe ?? noSubscription,
    offlineWrites?.getSnapshot ?? getEmptyQueue, getEmptyQueue)
  const target = useSyncExternalStore(apiTargetManager?.subscribe ?? noSubscription,
    apiTargetManager?.getSnapshot ?? getEmptyTarget, getEmptyTarget)
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [reconnecting, setReconnecting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [targetNotice, setTargetNotice] = useState('')
  const [recoveredNotice, setRecoveredNotice] = useState('')
  const previousTarget = useRef(target.target)
  const wasLimited = useRef(snapshot.phase === 'local-limited')

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  useEffect(() => {
    const previous = previousTarget.current
    previousTarget.current = target.target
    if (!previous.baseUrl || (previous.baseUrl === target.target.baseUrl && previous.prefix === target.target.prefix)) return undefined
    setTargetNotice('Backend mới đã được xác nhận.')
    const timer = window.setTimeout(() => setTargetNotice(''), 8_000)
    return () => window.clearTimeout(timer)
  }, [target.target])

  useEffect(() => {
    if (wasLimited.current && snapshot.phase === 'authenticated') {
      setRecoveredNotice('Kết nối backend đã được khôi phục.')
      const timer = window.setTimeout(() => setRecoveredNotice(''), 8_000)
      wasLimited.current = false
      return () => window.clearTimeout(timer)
    }
    wasLimited.current = snapshot.phase === 'local-limited'
    return undefined
  }, [snapshot.phase])

  const pendingEntries = queue.entries.filter(entry => entry.state !== 'confirmed')
  const latestFallback = localSnapshot.fallbacks[0]
  const latestMiss = localSnapshot.cacheMisses[0]
  const targetSwitching = target.phase === 'switching'
  const targetError = target.phase === 'error'
  const sessionLimited = snapshot.phase === 'local-limited'
  const sessionChecking = snapshot.phase === 'checking-health' || snapshot.phase === 'refreshing'
  const waitingForConsent = snapshot.phase === 'awaiting-consent'
  const hasOfflineState = !online || sessionLimited || sessionChecking || waitingForConsent
    || targetSwitching || targetError || Boolean(targetNotice || recoveredNotice)
    || Boolean(latestFallback || latestMiss || queue.entries.length || queue.error || queue.syncing || actionError)

  if (!hasOfflineState) return null

  const reconnect = async () => {
    if (reconnecting) return
    setReconnecting(true)
    setActionError(null)
    try {
      if (!retryConnection) throw new Error('Chưa có thao tác khôi phục kết nối trong runtime này.')
      await retryConnection()
    }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Không thể kết nối lại backend.') }
    finally { setReconnecting(false) }
  }
  const run = async (action: () => Promise<void>) => {
    setActionError(null)
    try { await action() }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Không thể cập nhật hàng đợi.') }
  }

  const actionStyle = {
    border: '1px solid #d0d5dd', borderRadius: 8, padding: '5px 9px', background: '#fff',
    color: '#344054', cursor: 'pointer', font: 'inherit',
  }
  const hasReconnectIssue = !online || sessionLimited || targetError
  const targetSwitchUrl = target.pendingTarget ? apiUrl(target.pendingTarget) : ''

  return <aside role="region" aria-label="Trạng thái offline và đồng bộ" style={{
    position: 'fixed', inset: '12px 12px auto auto', zIndex: 19_998,
    width: 'min(540px, calc(100vw - 24px))', maxHeight: 'min(62vh, 640px)', overflow: 'auto',
    padding: 14, border: `1px solid ${targetError || actionError ? '#fda29b' : hasReconnectIssue ? '#fdb022' : '#98a2b3'}`,
    borderRadius: 12, background: targetError || actionError ? '#fff4f2' : hasReconnectIssue ? '#fffaeb' : '#fff',
    color: '#101828', overflowWrap: 'anywhere', boxShadow: '0 8px 24px rgba(16,24,40,.18)', font: '500 13px/1.45 system-ui, sans-serif',
  }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div>
        <strong>Trạng thái kết nối và đồng bộ</strong>
        {target.target.baseUrl && <div style={{ color: '#667085', marginTop: 2 }}>API hiện tại: <code>{apiUrl(target.target)}</code></div>}
      </div>
      {(hasReconnectIssue || queue.entries.some(entry => entry.state !== 'confirmed')) && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {hasReconnectIssue && <button type="button" style={actionStyle} disabled={reconnecting || targetSwitching || !retryConnection} onClick={() => { void reconnect() }}>
          {targetSwitching ? 'Đang kiểm tra…' : reconnecting ? 'Đang kết nối…' : 'Kết nối lại'}
        </button>}
        {!hasReconnectIssue && offlineWrites && pendingEntries.length > 0 && <button type="button" style={actionStyle}
          disabled={queue.syncing || targetSwitching} onClick={() => { void run(() => offlineWrites.sync()) }}>
          {queue.syncing ? 'Đang đồng bộ…' : 'Đồng bộ ngay'}
        </button>}
      </div>}
    </header>

    <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
      {targetSwitching && <p role="status" style={{ margin: 0 }}>
        Đang kiểm tra backend mới{targetSwitchUrl ? `: ${targetSwitchUrl}` : ''}. Queue đang tạm dừng cho tới khi backend và phiên được xác nhận.
      </p>}
      {targetError && <p role="alert" style={{ margin: 0, color: '#b42318' }}>
        Không xác nhận được API target{targetSwitchUrl ? ` ${targetSwitchUrl}` : ''}. Vẫn giữ API hiện tại và queue; {target.error ?? 'hãy kiểm tra lại cấu hình.'}
      </p>}
      {sessionChecking && <p role="status" style={{ margin: 0 }}>Đang kiểm tra kết nối backend và phiên đăng nhập.</p>}
      {waitingForConsent && <p role="status" style={{ margin: 0 }}>Backend đã phản hồi; cần xác nhận gia hạn phiên trước khi queue tiếp tục.</p>}
      {sessionLimited && <p role="alert" style={{ margin: 0, color: '#7a2e0e' }}>
        Backend hoặc mạng đang mất kết nối. Cache và queue vẫn được giữ trên thiết bị; request cần phiên hợp lệ đang tạm dừng.
        {snapshot.error?.message ? ` ${snapshot.error.message}` : ''}
      </p>}
      {!online && !sessionLimited && <p role="status" style={{ margin: 0 }}>Thiết bị đang offline. Request được giữ trong queue để thử lại khi có mạng.</p>}
      {targetNotice && target.phase === 'ready' && <p role="status" style={{ margin: 0 }}>
        {queue.syncing ? 'Backend mới đã nối lại; đang đồng bộ queue.' : targetNotice}
      </p>}
      {recoveredNotice && !sessionLimited && <p role="status" style={{ margin: 0 }}>
        {queue.syncing ? 'Đã nối lại; đang đồng bộ các request đang chờ.' : recoveredNotice}
      </p>}
      {queue.syncing && !targetSwitching && !targetNotice && !recoveredNotice && <p role="status" style={{ margin: 0 }}>
        Đang đồng bộ {pendingEntries.length} request còn chờ.
      </p>}
      {queue.error && <p role="alert" style={{ margin: 0, color: '#b42318' }}>{queue.error}</p>}
      {actionError && <p role="alert" style={{ margin: 0, color: '#b42318' }}>{actionError}</p>}
    </div>

    {(latestFallback || latestMiss) && <section aria-label="Dữ liệu đọc offline" style={{ borderTop: '1px solid #eaecf0', marginTop: 10, paddingTop: 8 }}>
      <strong>Dữ liệu trên giao diện</strong>
      {latestFallback && <p style={{ margin: '4px 0' }}>
        Đang dùng cache cho <code>{latestFallback.path}</code>; lưu lúc {time.format(latestFallback.savedAt)}, dùng dự phòng lúc {time.format(latestFallback.fallbackAt)}.
        {localSnapshot.fallbacks.length > 1 ? ` Còn ${localSnapshot.fallbacks.length - 1} phần dữ liệu đang dùng cache.` : ''}
      </p>}
      {latestMiss && <p style={{ margin: '4px 0' }}>
        Chưa có bản lưu cho <code>{latestMiss.path}</code>; phần dữ liệu này chưa được tải.
        {localSnapshot.cacheMisses.length > 1 ? ` Còn ${localSnapshot.cacheMisses.length - 1} phần dữ liệu chưa có cache.` : ''}
      </p>}
    </section>}

    {queue.entries.length > 0 && <section aria-label="Danh sách request đồng bộ" style={{ borderTop: '1px solid #eaecf0', marginTop: 10, paddingTop: 8 }}>
      <strong>Request trong queue ({pendingEntries.length} đang chờ, {queue.entries.length - pendingEntries.length} đã xác nhận)</strong>
      <ul style={{ display: 'grid', gap: 8, listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
        {[...queue.entries].sort((left, right) => Number(left.state === 'confirmed') - Number(right.state === 'confirmed'))
          .map(entry => <li key={entry.id} style={{ borderTop: '1px solid #eaecf0', paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <strong>{entry.label}</strong> · {stateLabels[entry.state]}
                {entry.fileName && <div>File: <code>{entry.fileName}</code></div>}
                <div style={{ color: '#667085' }}>Tạo lúc {time.format(entry.createdAt)} · lần gửi {entry.attempts}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {offlineWrites && (entry.state === 'blocked' || entry.state === 'uncertain') && <button type="button" style={actionStyle}
                  disabled={queue.syncing || targetSwitching} onClick={() => { void run(() => offlineWrites.recheck(entry.id)) }}>Đối chiếu lại</button>}
                {offlineWrites && entry.state === 'queued' && entry.attempts === 0 && <button type="button" style={actionStyle}
                  disabled={queue.syncing || targetSwitching} title="Chỉ bỏ request chưa gửi; không hoàn tác thao tác backend đã nhận."
                  onClick={() => { void run(() => offlineWrites.cancel(entry.id, 'queued')) }}>Bỏ khỏi queue</button>}
                {offlineWrites && entry.state === 'confirmed' && <button type="button" style={actionStyle}
                  title="Chỉ xóa lịch sử trên thiết bị; không thay đổi dữ liệu backend."
                  onClick={() => { void run(() => offlineWrites.cancel(entry.id, 'confirmed')) }}>Xóa lịch sử</button>}
              </div>
            </div>
            {entry.error && <p role="alert" style={{ margin: '4px 0 0', color: '#b42318' }}>{entry.error}</p>}
          </li>)}
      </ul>
      <p style={{ color: '#667085', margin: '8px 0 0' }}>
        Bỏ khỏi queue chỉ áp dụng trước lần gửi đầu. Nếu backend đã nhận request, xóa khỏi danh sách không hoàn tác hành động đó.
      </p>
    </section>}
  </aside>
}
