import { useLocalData, useOfflineStatus } from '../../hooks/offline/use-local-data'
import { Button } from '../ui/primitives/button'
import styles from './offline-notice.module.css'

export function OfflineNotice() {
  const local = useLocalData()
  const status = useOfflineStatus()
  if (!local || (!status.offline && !status.storageError)) return null
  return <aside role="status" className={styles['notice']}>
    <div>{status.offline ? <>
      <strong>Đang xem ngoại tuyến · Chỉ đọc</strong>
      <p>{status.savedAt !== null ? `Bản lưu trên thiết bị: ${new Date(status.savedAt).toLocaleString('vi-VN')}. ` : ''}
        Chỉ xem được dữ liệu đã tải trước đó. Kết nối lại để cập nhật hoặc thay đổi dữ liệu.</p>
    </> : <p>{status.storageError}</p>}</div>
    {status.offline && <Button variant="secondary" onClick={local.offline.reconnect}>Kết nối lại</Button>}
  </aside>
}
