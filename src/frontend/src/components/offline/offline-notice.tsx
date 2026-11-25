import { useLocalData, useOfflineStatus, useOfflineWrites } from '../../hooks/offline/use-local-data'
import { useState } from 'react'
import { Button } from '../ui/primitives/button'
import styles from './offline-notice.module.css'

export function OfflineNotice() {
  const local = useLocalData()
  const status = useOfflineStatus()
  const writes = useOfflineWrites()
  const [error, setError] = useState('')
  if (!local || (!status.offline && !status.storageError && !writes.entries.length && !writes.error)) return null
  const act = (operation: Promise<void>) => { setError(''); void operation.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Chưa xử lý được hàng đợi.')) }
  const states = { queued: 'Chờ đồng bộ', sending: 'Đang gửi', uncertain: 'Đang kiểm tra lần gửi trước', blocked: 'Cần kiểm tra', confirmed: 'Server đã nhận · Đang cập nhật bản lưu' }
  return <aside role="status" className={styles['notice']}>
    <div>{status.offline ? <>
      <strong>{local.writes ? 'Đang ngoại tuyến · Thay đổi hỗ trợ sẽ lưu chờ đồng bộ' : 'Đang xem ngoại tuyến · Chỉ đọc'}</strong>
      <p>{status.savedAt !== null ? `Bản lưu trên thiết bị: ${new Date(status.savedAt).toLocaleString('vi-VN')}. ` : ''}
        {local.writes ? 'Xem dữ liệu đã tải trước đó; upload CSV, sửa tên/mô tả và yêu cầu xóa sẽ tự gửi khi backend hoạt động lại.' : 'Chỉ xem được dữ liệu đã tải trước đó. Kết nối lại để cập nhật hoặc thay đổi dữ liệu.'}</p>
    </> : null}
    {status.storageError && <p>{status.storageError}</p>}
    {writes.entries.length > 0 && <details>
      <summary>{writes.syncing ? 'Đang đồng bộ' : 'Hàng đợi đồng bộ'} · {writes.entries.length} yêu cầu</summary>
      <p>Chỉ xác nhận hoàn tất sau phản hồi server. Bỏ khỏi hàng đợi không hoàn tác thao tác server đã nhận.</p>
      <ul>{writes.entries.map(entry => <li key={entry.id}>
        <strong>{entry.label}</strong> — {states[entry.state]}
        {entry.error && <p>{entry.error}</p>}
        {entry.state === 'blocked' && <Button variant="secondary" disabled={writes.syncing} onClick={() => { if (local.writes) act(local.writes.recheck(entry.id)) }}>Kiểm tra lại</Button>}
        {entry.state !== 'sending' && entry.state !== 'confirmed' && <Button variant="secondary" disabled={writes.syncing} onClick={() => { if (local.writes) act(local.writes.cancel(entry.id)) }}>Bỏ khỏi hàng đợi</Button>}
      </li>)}</ul>
    </details>}
    {writes.error && <p>{writes.error}</p>}
    {error && <p role="alert">{error}</p>}
    </div>
    {status.offline && <Button variant="secondary" onClick={local.offline.reconnect}>Kết nối lại</Button>}
  </aside>
}
