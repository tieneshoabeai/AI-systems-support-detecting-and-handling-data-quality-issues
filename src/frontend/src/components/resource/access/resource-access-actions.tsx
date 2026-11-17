import { useState } from 'react'
import { useManagementStore } from '../../../hooks/preview/use-preview-store'
import { usePreviewSession } from '../../../hooks/preview/preview-session-context'
import type { Workspace, Project } from '../../../types/preview/preview.types'

export function ResourceAccessActions({ resource, kind, onClose }: { resource: Workspace | Project; kind: 'workspace' | 'project'; onClose: () => void }) {
  const store = useManagementStore()
  const session = usePreviewSession()
  const [email, setEmail] = useState('')
  const [confirm, setConfirm] = useState<'transfer' | 'leave' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (session.state.source !== 'api') return null
  const members = 'memberPreview' in resource ? resource.memberPreview : resource.members
  const execute = async () => {
    if (busy || !confirm) return
    setBusy(true); setError('')
    try {
      const result = confirm === 'transfer' ? await store.transferOwner!(kind, resource.id, email) : await store.leaveWorkspace!(resource.id)
      session.notify(result.message, 'success'); onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thực hiện được thao tác.') }
    finally { setBusy(false) }
  }
  return <details className="resource-access-actions"><summary>Quyền sở hữu và rời workspace</summary>
    {resource.canManage && <label className="dialog-field"><span>Nhượng quyền cho thành viên</span>
      <select value={email} disabled={busy} onChange={e => { setEmail(e.target.value); setConfirm(null) }}><option value="">Chọn thành viên</option>
        {members.filter(m => m.id !== resource.owner.id && m.email).map(m => <option key={m.id} value={m.email}>{m.name} — {m.email}</option>)}
      </select><button className="button-secondary" disabled={!email || busy} onClick={() => setConfirm('transfer')}>Nhượng quyền Owner</button>
    </label>}
    {kind === 'workspace' && <><button className="button-secondary" disabled={resource.canManage || busy} onClick={() => setConfirm('leave')}>Rời Workspace</button>
      {resource.canManage && <p className="action-note">Chủ sở hữu cần nhượng quyền trước khi rời workspace.</p>}</>}
    {confirm && <div role="group" aria-label="Xác nhận thay đổi quyền"><p>{confirm === 'transfer' ? 'Xác nhận chuyển quyền chủ sở hữu? Quyền của bạn sẽ thay đổi ngay sau khi lưu.' : 'Xác nhận rời workspace? Bạn sẽ mất quyền truy cập các project trong đó.'}</p>
      <button className="button-secondary" disabled={busy} onClick={() => setConfirm(null)}>Hủy</button><button className="button-primary" disabled={busy} aria-busy={busy} onClick={() => { void execute() }}>Xác nhận</button></div>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </details>
}
