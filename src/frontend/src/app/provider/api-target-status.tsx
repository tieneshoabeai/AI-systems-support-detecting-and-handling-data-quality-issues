import { useSyncExternalStore } from 'react'
import type { ApiTargetManager } from '../../lib/api-target-manager'

export function ApiTargetStatus({ manager }: { manager: ApiTargetManager }) {
  const snapshot = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot)
  if (snapshot.phase !== 'error' || !snapshot.error) return null
  const attemptedUrl = snapshot.pendingTarget
    ? `${snapshot.pendingTarget.baseUrl}${snapshot.pendingTarget.prefix}`
    : null

  return <div role="alert" aria-live="assertive" style={{
    position: 'fixed',
    inset: '12px 12px auto',
    zIndex: 20_000,
    margin: '0 auto',
    maxWidth: 720,
    padding: '12px 16px',
    border: '1px solid #fda29b',
    borderRadius: 12,
    background: '#fff4f2',
    color: '#7a271a',
    boxShadow: '0 8px 24px rgba(16, 24, 40, 0.16)',
    font: '500 14px/1.5 system-ui, sans-serif',
  }}>
    Chuyển API URL{attemptedUrl ? ` sang ${attemptedUrl}` : ''}: {snapshot.error}
  </div>
}
