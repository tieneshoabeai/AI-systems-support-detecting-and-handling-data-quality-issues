import { useSyncExternalStore } from 'react'
import { useAuth } from '../../hooks/auth/use-auth'

const time = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' })
const emptySnapshot = Object.freeze({ fallbacks: [], cacheMisses: [] })

export function SessionConnectivityStatus() {
  const { snapshot, localData } = useAuth()
  const localSnapshot = useSyncExternalStore(localData?.subscribe ?? (() => () => {}), localData?.getSnapshot ?? (() => emptySnapshot), () => emptySnapshot)
  const latestFallback = localSnapshot.fallbacks[0]
  const latestMiss = localSnapshot.cacheMisses[0]
  const isLimited = snapshot.phase === 'local-limited'
  if (!isLimited && !latestFallback && !latestMiss) return null

  return <div role="status" aria-live="polite" style={{
    position: 'fixed',
    inset: '12px 12px auto',
    zIndex: 19_999,
    margin: '0 auto',
    maxWidth: 720,
    padding: '12px 16px',
    border: '1px solid #fdb022',
    borderRadius: 12,
    background: '#fffaeb',
    color: '#7a2e0e',
    boxShadow: '0 8px 24px rgba(16, 24, 40, 0.16)',
    font: '500 14px/1.5 system-ui, sans-serif',
  }}>
    {isLimited && <>Backend đang mất kết nối. Phiên và dữ liệu cục bộ được giữ; thao tác cần đăng nhập đang tạm dừng.
      {snapshot.error?.message ? ` ${snapshot.error.message}` : ''}</>}
    {latestFallback && <div>
      Đang hiển thị {localSnapshot.fallbacks.length > 1 ? `${localSnapshot.fallbacks.length} phần dữ liệu đã lưu; gần nhất cho ` : 'bản lưu cho '}
      <code>{latestFallback.path}</code>, lưu lúc <time dateTime={new Date(latestFallback.savedAt).toISOString()}>{time.format(latestFallback.savedAt)}</time>
      {' '}(dùng dự phòng lúc <time dateTime={new Date(latestFallback.fallbackAt).toISOString()}>{time.format(latestFallback.fallbackAt)}</time>).
    </div>}
    {latestMiss && <div>
      {localSnapshot.cacheMisses.length > 1 ? `Chưa có bản lưu cho ${localSnapshot.cacheMisses.length} phần dữ liệu; gần nhất: ` : 'Chưa có bản lưu offline cho '}
      <code>{latestMiss.path}</code>; phần dữ liệu này chưa được tải.
    </div>}
  </div>
}
