import { useEffect, useState } from 'react'
import { Button, Select } from '../../../components/ui/controls'
import { useManagementStore } from '../../../hooks/management/use-management-store'
import type { AdminIssue, AdminUser } from '../../../services/management/admin.service'
import { Panel } from '../../../components/resource/presentation'

type AdminTab = 'users' | 'issues'
const statuses: AdminIssue['status'][] = ['new', 'needs_info', 'in_progress', 'resolved', 'closed']
const dateLabel = (value: string): string => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

export function AdminApiPanel() {
  const service = useManagementStore().adminService
  const [tab, setTab] = useState<AdminTab>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [issues, setIssues] = useState<AdminIssue[]>([])
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [selectedIssue, setSelectedIssue] = useState<AdminIssue | null>(null)
  const [status, setStatus] = useState<AdminIssue['status']>('new')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  useEffect(() => {
    if (!service) return
    let active = true
    const request = tab === 'users' ? service.listUsersPage() : service.listIssuesPage()
    void request.then(page => {
      if (!active) return
      if (tab === 'users') setUsers(page.items as AdminUser[])
      else setIssues(page.items as AdminIssue[])
      setNextCursor(page.nextCursor); setLoading(false)
    }).catch((cause: unknown) => {
      if (active) {
        setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu quản trị.')
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [service, attempt, tab])

  if (!service) return null
  const changeTab = (next: AdminTab) => {
    if (next === tab || busy || loading) return
    setTab(next); setLoading(true); setError(''); setNextCursor(null)
    setSelectedIssue(null); setSelectedUser(null)
  }
  const loadMore = async () => {
    if (!nextCursor || busy || loading) return
    setBusy(true); setError('')
    try {
      if (tab === 'users') {
        const page = await service.listUsersPage(nextCursor)
        setUsers(current => [...current, ...page.items.filter(row => !current.some(item => item.id === row.id))])
        setNextCursor(page.nextCursor)
      } else {
        const page = await service.listIssuesPage(nextCursor)
        setIssues(current => [...current, ...page.items.filter(row => !current.some(item => item.id === row.id))])
        setNextCursor(page.nextCursor)
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được trang tiếp theo.') }
    finally { setBusy(false) }
  }
  const openUser = async (user: AdminUser): Promise<void> => {
    setSelectedUser(user); setSelectedIssue(null); setBusy(true); setError('')
    try { setSelectedUser(await service.getUser(user.id)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được hồ sơ tài khoản.') }
    finally { setBusy(false) }
  }
  const openIssue = async (issue: AdminIssue): Promise<void> => {
    setSelectedIssue(issue); setSelectedUser(null); setStatus(issue.status); setBusy(true); setError('')
    try {
      const detail = await service.getIssue(issue.id)
      setSelectedIssue(detail); setStatus(detail.status)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được issue.') }
    finally { setBusy(false) }
  }
  const saveStatus = async (): Promise<void> => {
    if (!selectedIssue || busy || selectedIssue.status === status) return
    setBusy(true); setError('')
    try {
      const updated = await service.updateIssueStatus(selectedIssue.id, status, selectedIssue.version)
      setSelectedIssue(updated)
      setIssues(current => current.map(issue => issue.id === updated.id ? updated : issue))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không cập nhật được trạng thái issue.') }
    finally { setBusy(false) }
  }

  return <Panel title="Quản trị" className="admin-api-panel">
    <div className="form-actions" role="tablist" aria-label="Dữ liệu quản trị">
      <Button type="button" role="tab" aria-selected={tab === 'users'} disabled={busy || loading} className={tab === 'users' ? 'button-primary' : 'button-secondary'} onClick={() => changeTab('users')}>Tài khoản</Button>
      <Button type="button" role="tab" aria-selected={tab === 'issues'} disabled={busy || loading} className={tab === 'issues' ? 'button-primary' : 'button-secondary'} onClick={() => changeTab('issues')}>Báo cáo vấn đề</Button>
      <Button type="button" className="button-secondary" disabled={loading || busy} onClick={() => { setLoading(true); setError(''); setAttempt(value => value + 1) }}>Tải lại</Button>
    </div>
    {loading && <p role="status">Đang tải dữ liệu quản trị.</p>}
    {error !== '' && <p role="alert">{error}</p>}
    {!loading && tab === 'users' && <div className="table-scroll">
      <table className="preview-table"><thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Trạng thái</th></tr></thead>
        <tbody>{users.map(user => <tr key={user.id}>
          <th scope="row"><Button type="button" className="row-link" onClick={() => { void openUser(user) }}>{user.firstName} {user.lastName}<span className="row-sub">{user.email}</span></Button></th>
          <td>{user.role}</td><td>{user.status}</td>
        </tr>)}</tbody>
      </table>
      {users.length === 0 && <p>Chưa có tài khoản để hiển thị.</p>}
      {selectedUser && <dl className="detail-meta">
        <div><dt>Email</dt><dd>{selectedUser.email}</dd></div>
        <div><dt>Tên</dt><dd>{selectedUser.firstName} {selectedUser.lastName}</dd></div>
        <div><dt>Vai trò</dt><dd>{selectedUser.role}</dd></div>
        <div><dt>Trạng thái</dt><dd>{selectedUser.status}</dd></div>
        <div><dt>Tạo lúc</dt><dd>{dateLabel(selectedUser.createdAt)}</dd></div>
      </dl>}
    </div>}
    {!loading && tab === 'issues' && <div className="table-scroll">
      <table className="preview-table"><thead><tr><th>Báo cáo</th><th>Loại</th><th>Trạng thái</th><th>Tạo lúc</th></tr></thead>
        <tbody>{issues.map(issue => <tr key={issue.id}>
          <th scope="row"><Button type="button" className="row-link" onClick={() => { void openIssue(issue) }}>{issue.title}<span className="row-sub">{issue.id}</span></Button></th>
          <td>{issue.issueType}</td><td>{issue.status}</td><td>{dateLabel(issue.createdAt)}</td>
        </tr>)}</tbody>
      </table>
      {issues.length === 0 && <p>Chưa có báo cáo vấn đề để hiển thị.</p>}
      {selectedIssue && <div className="detail-meta">
        <p>{selectedIssue.description}</p>
        <label>Trạng thái <Select value={status} disabled={busy} onChange={event => setStatus(event.target.value as AdminIssue['status'])}>
          {statuses.map(value => <option key={value} value={value}>{value}</option>)}
        </Select></label>
        <Button type="button" className="button-primary" disabled={busy || status === selectedIssue.status} onClick={() => { void saveStatus() }}>Lưu trạng thái</Button>
      </div>}
    </div>}
    {!loading && nextCursor && <Button className="button-secondary" busy={busy} onClick={() => { void loadMore() }}>Tải thêm</Button>}
  </Panel>
}
