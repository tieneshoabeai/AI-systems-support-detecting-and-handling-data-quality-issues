import type { ReactNode } from 'react'
import type { ManagementLoading } from '../../hooks/management/management-loading-context'

export function DataRegionStatus({ status, label, children }: {
  status: ManagementLoading
  label: string
  children: ReactNode
}) {
  if (status.phase === 'error') return <div className="panel-sub">
    <p role="alert">{status.message}</p>
    {status.retry && <button type="button" className="button-secondary" onClick={status.retry}>Thử lại</button>}
  </div>
  return <div role="status" aria-label={label}>{children}</div>
}
