import { useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { Button } from '../../../components/ui/primitives/button'
import styles from '../../../components/ui/diagnostics.module.css'
import { createAxiosClient } from '../../../lib/axios-client'
import { normalizeApiError } from '../../../lib/api-error'
import { createHealthService } from '../../../services/health/health.service'
import { getApiConfig } from '../../../configs/api.config'
import { AuthContext } from '../../../hooks/auth/auth-context'

type Readiness = Awaited<ReturnType<ReturnType<typeof createHealthService>['readiness']>>
type Snapshot = { at: Date; elapsedMs: number } & (
  { data: Readiness } | { code: number | undefined; kind: string; message: string }
)
const time = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' })
const checkLabel = (value: Readiness['mongo']) => value === 'ok' ? 'Hoạt động' : value === 'fail' ? 'Có lỗi' : 'Chưa có thông tin'
const storageLabels = { cloud_s3_r2: 'Đám mây', local_fallback: 'Cục bộ' }
const idleMigration = Object.freeze({ state: 'idle' as const, conflicts: 0, unlistedNamespaces: 0, message: null })
const getIdleMigration = () => idleMigration
const noMigrationSubscription = () => () => {}
const migrationLabels = { idle: 'Chưa chạy', migrating: 'Đang chuyển', complete: 'Đã kiểm tra', attention: 'Cần xác nhận', error: 'Có lỗi' }

export function SystemStatus() {
  const auth = useContext(AuthContext)
  const migration = useSyncExternalStore(auth?.localData?.migration.subscribe ?? noMigrationSubscription,
    auth?.localData?.migration.getSnapshot ?? getIdleMigration, getIdleMigration)
  const connection = (() => {
    try {
      const config = getApiConfig()
      return { environment: import.meta.env.VITE_API_ENVIRONMENT_ID?.trim() || 'Theo URL backend', backend: config.baseUrl }
    } catch { return { environment: import.meta.env.VITE_API_ENVIRONMENT_ID?.trim() || 'Chưa cấu hình', backend: 'URL API không hợp lệ' } }
  })()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ attempt: number; snapshot: Snapshot } | null>(null)
  const snapshot = result?.attempt === attempt ? result.snapshot : null
  const data = snapshot && 'data' in snapshot ? snapshot.data : null
  const failure = snapshot && 'message' in snapshot ? snapshot : null
  const stateLabel = data ? 'Sẵn sàng'
    : !failure ? 'Đang kiểm tra…'
      : failure.code === 503 ? 'Máy chủ chưa sẵn sàng'
        : failure.kind === 'timeout' ? 'Hết thời gian chờ'
          : failure.code === undefined && failure.kind === 'network' ? 'Không kết nối được máy chủ'
            : 'Không xác nhận được trạng thái'

  useEffect(() => {
    const controller = new AbortController()
    const refresh = async () => {
      const startedAt = performance.now()
      const timing = () => ({ at: new Date(), elapsedMs: Math.round(performance.now() - startedAt) })
      let next: Snapshot
      try {
        const data = await createHealthService(createAxiosClient()).readiness(controller.signal)
        next = { ...timing(), data }
      } catch (cause) {
        const error = normalizeApiError(cause)
        next = { ...timing(), code: error.status, kind: error.kind, message: error.message }
      }
      if (!controller.signal.aborted) setResult({ attempt, snapshot: next })
    }
    void refresh()
    return () => controller.abort()
  }, [attempt])

  return <section className={styles['panel']} data-accent="teal" aria-label="Trạng thái hệ thống">
    <header className={styles['header']}>
      <div><h2>Khả năng tiếp nhận yêu cầu</h2><p>Kiểm tra kết nối cơ sở dữ liệu và xem chế độ lưu trữ do máy chủ báo về.</p></div>
      <Button className="button-secondary" disabled={!snapshot} onClick={() => setAttempt(value => value + 1)}>{snapshot ? 'Kiểm tra lại' : 'Đang kiểm tra…'}</Button>
    </header>
    <p className={styles['status']} role="status" data-tone={failure ? 'error' : data ? 'normal' : 'neutral'}>
      {stateLabel}
    </p>
    <dl className={styles['serviceChecks']}>
      <div><dt>Môi trường</dt><dd>{connection.environment}</dd></div>
      <div><dt>Backend API</dt><dd>{connection.backend}</dd></div>
      <div><dt>Migration IndexedDB</dt><dd>{migrationLabels[migration.state]}</dd></div>
      <div><dt>Cơ sở dữ liệu</dt><dd>{snapshot ? checkLabel(data?.mongo ?? null) : 'Đang kiểm tra'}</dd></div>
      <div><dt>Chế độ lưu trữ</dt><dd>{data?.storageMode ? storageLabels[data.storageMode] : snapshot ? 'Chưa có thông tin' : 'Đang kiểm tra'}</dd></div>
    </dl>
    {migration.message && <p className={styles['empty']} role="status" aria-live="polite">{migration.message}</p>}
    {failure && <p className={styles['empty']}>{failure.code ? `HTTP ${failure.code}. ` : ''}{failure.message}</p>}
    {snapshot && <div className={styles['meta']}>
      <span>Kiểm tra lúc <time dateTime={snapshot.at.toISOString()}>{time.format(snapshot.at)}</time></span>
      <span>Thời gian kiểm tra: {snapshot.elapsedMs} ms</span>
    </div>}
  </section>
}
