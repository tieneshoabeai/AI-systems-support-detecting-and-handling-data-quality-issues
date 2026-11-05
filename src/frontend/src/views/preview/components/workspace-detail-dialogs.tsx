import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { Person, PreviewWorkspacePanel, Project, Workspace, WorkspaceEdit } from '../../../types/preview/preview.types'
import {
  directory, emailForPerson, personFromEmail, previewNoteIds, previewReasons, workspaceMemberRows,
} from '../preview-data'
import type { WorkspaceMemberRow } from '../preview-data'
import { PreviewIcon } from './preview-icons'
import { useDialogFocus } from './preview-surface'
import { Avatar } from './preview-shell'
import { CoverArt, Pagination } from './preview-primitives'

// Hai modal của trang chi tiết workspace (Design Board "workspaces detail" · ảnh
// "Neon Workspace Management Panels"): "Thông tin Workspace" (xem + sửa tên/mô tả) và
// "Quản lý thành viên" (roster + tìm/lọc/phân trang). Tái dùng scrim + focus trap của
// dialog đổi tên/xóa (preview-dialog.tsx) nên không mở ra một hệ surface thứ ba.
//
// Hai modal này là surface CẤP PHIÊN (WorkspacePanelSurface cuối file, render bởi
// PreviewSessionProvider) chứ không phải state cục bộ của trang chi tiết, vì ảnh
// "a_detailed_high_fidelity_ui_screenshot_of_the_sam" vẽ chúng nằm trong ⋯ của THẺ
// workspace — ⋯ đó có mặt ở trang danh sách, trên Home và ở header trang chi tiết. Ba lối vào
// mà mỗi nơi tự giữ một bản modal là ba bộ hành vi lệch nhau (xem PreviewWorkspacePanel).
// Workspace được surface tra lại từ id trong store, nên xóa workspace là modal tự biến mất.

// Bấm nền tối = hủy (đặt trên scrim, tự kiểm target → panel không phải stopPropagation).
const scrimMouseDown = (onClose: () => void) => ({
  onMouseDown: (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  },
})

const nameMax = 100
const descMax = 500

export function WorkspaceEditDialog({ workspace, projectCount, ownerEmail, existingNames, onClose, onSave }: {
  workspace: Workspace
  projectCount: number
  ownerEmail: string
  // Tên những workspace KHÁC trong store. Ảnh không vẽ ô lỗi này, nhưng backend có partial
  // unique index "hai workspace đang hoạt động không được trùng tên" — chặn ở form vẫn rẻ
  // hơn báo lỗi SAU khi lưu, và là quy tắc form "Tạo Workspace" đã áp dụng.
  existingNames: readonly string[]
  onClose: () => void
  onSave: (edit: WorkspaceEdit) => void
}) {
  const ref = useRef<HTMLFormElement>(null)
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description)
  const [error, setError] = useState<string | null>(null)
  useDialogFocus(ref, onClose)

  const submit = (): void => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Tên workspace không được để trống.'); return }
    const clash = existingNames.find(item => item.toLowerCase() === trimmed.toLowerCase())
    if (clash) { setError(`Đã có Workspace “${clash}” trùng tên này. Tên workspace phải phân biệt được với nhau.`); return }
    if (trimmed === workspace.name && description.trim() === workspace.description) {
      setError('Chưa có thay đổi nào để lưu.')
      return
    }
    onSave({ name: trimmed, description: description.trim() })
  }

  return <div className="preview-dialog-scrim" {...scrimMouseDown(onClose)}>
    <form ref={ref} className="preview-dialog is-wide" role="dialog" aria-modal="true" aria-labelledby="ws-edit-title"
      onSubmit={event => { event.preventDefault(); submit() }}>
      <header className="dialog-head">
        <span className="dialog-head-icon" aria-hidden="true"><PreviewIcon name="info" /></span>
        <div className="dialog-head-text">
          <h2 id="ws-edit-title">Thông tin Workspace</h2>
          <p>Xem và chỉnh sửa thông tin cơ bản của Workspace.</p>
        </div>
        <button type="button" className="icon-button dialog-close" aria-label="Đóng hộp thoại" onClick={onClose}>
          <PreviewIcon name="close" />
        </button>
      </header>

      <div className="ws-edit-grid">
        <span className="ws-edit-cover"><CoverArt hue={workspace.cover} seed={workspace.id} /></span>
        <div className="ws-edit-fields">
          <div className="ws-edit-field">
            <label className="dialog-field">
              <span>Tên Workspace <em className="field-required" aria-hidden="true">*</em></span>
              <input value={name} onChange={event => { setName(event.target.value); setError(null) }}
                maxLength={nameMax} autoComplete="off"
                aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'ws-edit-error' : undefined} />
            </label>
            <span className="dialog-counter">{name.length} / {nameMax}</span>
          </div>
          <div className="ws-edit-field">
            <label className="dialog-field">
              <span>Mô tả</span>
              <textarea value={description} onChange={event => { setDescription(event.target.value); setError(null) }}
                maxLength={descMax} rows={3} />
            </label>
            <span className="dialog-counter">{description.length} / {descMax}</span>
          </div>
        </div>
      </div>

      <dl className="ws-edit-info">
        <div><dt><PreviewIcon name="shield" /> Chủ sở hữu</dt>
          <dd><span className="info-owner"><Avatar initials={workspace.owner.initials} size="sm" />{workspace.owner.name}</span>
            <span className="info-sub">{ownerEmail}</span></dd></div>
        <div><dt><PreviewIcon name="clock" /> Ngày tạo</dt><dd>{workspace.createdAt}</dd></div>
        <div><dt><PreviewIcon name="reset" /> Cập nhật gần nhất</dt><dd>{workspace.updatedAt}</dd></div>
        <div><dt><PreviewIcon name="users" /> Số lượng thành viên</dt><dd>{workspace.members} thành viên</dd></div>
        <div><dt><PreviewIcon name="box" /> Số lượng Project</dt><dd>{projectCount} Project</dd></div>
      </dl>

      {error && <p className="dialog-error" id="ws-edit-error" role="alert">{error}</p>}
      <footer className="dialog-actions">
        <button type="button" className="button-secondary" onClick={onClose}>Hủy</button>
        <button type="submit" className="button-primary"><PreviewIcon name="check" /> Lưu thay đổi</button>
      </footer>
    </form>
  </div>
}

const roleClass = (role: string): string => `role-badge role-${role.toLowerCase()}`

const memberRoleOptions: readonly string[] = ['Owner', 'Admin', 'Member', 'Viewer']

// Hai ô của MỘT DÒNG người (chủ batch 03/11 yêu cầu bật thật): ô vai trò ghi thẳng vào
// `memberRoles`, nút "Gỡ" ghi thẳng vào `memberPreview` — cả hai optimistic + Hoàn tác như mọi
// thao tác khác của frame.
//
// Vai trò để ở ĐÂY chứ không giấu sau một nút ⋯: modal này có `backdrop-filter` trên thân dialog,
// mà backdrop-filter biến dialog thành containing block của mọi phần tử `position: fixed` bên
// trong nó — popover/menu nổi đặt trong modal sẽ mọc sai chỗ thay vì ngay cạnh nút. Bài học đó
// chính là lý do màn "Đăng nhập & phiên" (4.4) dùng menu inline. Với MỘT giá trị cần đổi thì một
// ô chọn còn trực tiếp hơn ba cú click.
//
// Chủ sở hữu không có hai ô đó (một badge + dấu "—") vì đổi vai trò hay gỡ người duy nhất sở hữu
// ranh giới truy cập là để lại một workspace mồ côi; đó là ràng buộc nghiệp vụ, không phải ô chưa
// làm.
function WorkspaceMemberRowCells({ row, onChangeRole, onRemove }: {
  row: WorkspaceMemberRow
  onChangeRole: (personId: string, role: string) => void
  onRemove: (personId: string) => void
}) {
  if (row.owner) return <>
    <td><span className={roleClass(row.role)}>{row.role}</span></td>
    <td>{row.joinedAt}</td>
    <td className="row-action"><span className="member-owner-dash" aria-label="Chủ sở hữu không có thao tác">—</span></td>
  </>

  return <>
    <td>
      <label className="chip-select inline">
        <span className="visually-hidden">Vai trò của {row.name}</span>
        <select value={row.role} onChange={event => onChangeRole(row.id, event.target.value)}>
          {memberRoleOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    </td>
    <td>{row.joinedAt}</td>
    <td className="row-action">
      <button type="button" className="icon-button sm row-menu" aria-label={`Gỡ ${row.name} khỏi Workspace`}
        onClick={() => onRemove(row.id)}>
        <PreviewIcon name="trash" />
      </button>
    </td>
  </>
}

export function WorkspaceMembersDialog({ workspace, rows, onClose, onAddMember, onChangeMemberRole, onRemoveMember }: {
  workspace: Workspace
  rows: readonly WorkspaceMemberRow[]
  onClose: () => void
  onAddMember: (person: Person) => void
  onChangeMemberRole: (personId: string, role: string) => void
  onRemoveMember: (personId: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<'all' | string>('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(8)
  // "Thêm thành viên" (ảnh "Neon Workspace Management Panels" vẽ nó là nút thật) mở ô tìm
  // người NGAY TRONG modal, theo đúng khuôn ô "Thành viên ban đầu" của ảnh "Workspace Creation
  // with Email Suggestions" — chọn ai là ghi thật luôn (optimistic + Hoàn tác), không có bước
  // trung gian mà ảnh không vẽ.
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  useDialogFocus(ref, onClose)

  // Ứng viên = người trong danh bạ mẫu mà roster CHƯA có. Không loại trừ "tôi" như form Tạo
  // Workspace: ở đó "tôi" mặc định là chủ sở hữu nên chọn mình thành hai dòng, còn đây là
  // workspace của người khác thì "tôi" là một lời mời hợp lệ.
  const inRoster = new Set(rows.map(row => row.id))
  const pick = search.trim().toLowerCase()
  const matches = directory.filter(person => !inRoster.has(person.id)
    && (!pick || person.name.toLowerCase().includes(pick) || emailForPerson(person).toLowerCase().includes(pick)))
  // Email lạ vẫn thêm được (chưa có Users API nên không xác thực): personFromEmail suy tên +
  // avatar từ phần trước dấu @, và email gõ tay được GIỮ NGUYÊN trong bản ghi.
  const typed = search.trim()
  const typedIsKnown = matches.some(person => emailForPerson(person).toLowerCase() === typed.toLowerCase())
  const custom = typed.includes('@') && !typed.startsWith('@') && !typed.endsWith('@') && !typedIsKnown
    ? personFromEmail(typed)
    : null

  const add = (person: Person): void => {
    onAddMember(person)
    setSearch('')
  }

  const filtered = rows.filter(row => {
    const needle = query.trim().toLowerCase()
    const matchRole = role === 'all' || row.role === role
    const matchQuery = !needle || row.name.toLowerCase().includes(needle) || row.email.toLowerCase().includes(needle)
    return matchRole && matchQuery
  })
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  return <div className="preview-dialog-scrim" {...scrimMouseDown(onClose)}>
    <div ref={ref} className="preview-dialog is-wide" role="dialog" aria-modal="true" aria-labelledby="ws-members-title">
      <header className="dialog-head">
        <span className="dialog-head-icon" aria-hidden="true"><PreviewIcon name="users" /></span>
        <div className="dialog-head-text">
          <h2 id="ws-members-title">Quản lý thành viên</h2>
          <p>Xem, thêm và quản lý các thành viên trong Workspace.</p>
        </div>
        <button type="button" className="icon-button dialog-close" aria-label="Đóng hộp thoại" onClick={onClose}>
          <PreviewIcon name="close" />
        </button>
      </header>

      <div className="members-summary">
        <span className="members-count-icon" aria-hidden="true"><PreviewIcon name="users" /></span>
        <div className="members-count-text">
          <strong>{workspace.members} thành viên</strong>
          <span>Trong Workspace “{workspace.name}”</span>
        </div>
        <button type="button" className="button-primary" aria-expanded={adding}
          aria-controls="ws-add-member" onClick={() => { setAdding(value => !value); setSearch('') }}>
          <PreviewIcon name="plus" /> Thêm thành viên
        </button>
      </div>

      {adding && <div className="pv-add-member" id="ws-add-member">
        <label className="members-search">
          <span className="visually-hidden">Tìm người để thêm vào Workspace</span>
          <PreviewIcon name="search" />
          <input value={search} autoFocus onChange={event => setSearch(event.target.value)}
            placeholder="Tìm theo tên hoặc nhập email…" autoComplete="off"
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); const first = matches[0] ?? custom; if (first) add(first) } }} />
        </label>
        {matches.length === 0 && custom === null && <p className="panel-sub">
          {pick ? `Không tìm thấy ai khớp với “${typed}” trong danh bạ mẫu — nhập email đầy đủ (có dấu @) để thêm người mới.`
            : 'Cả danh bạ mẫu đều đã thuộc Workspace này.'}
        </p>}
        {(matches.length > 0 || custom !== null) && <ul className="pv-suggest-list">
          {matches.map(person => <li key={person.id} className="pv-suggest-row">
            <Avatar initials={person.initials} size="sm" />
            <span className="pv-chip-text"><span className="pv-chip-name">{person.name}</span><span className="pv-chip-email">{emailForPerson(person)}</span></span>
            <button type="button" className="button-secondary pv-suggest-add" onClick={() => add(person)}>
              <PreviewIcon name="plus" /> Thêm
            </button>
          </li>)}
          {custom && <li className="pv-suggest-row">
            <Avatar initials={custom.initials} size="sm" />
            <span className="pv-chip-text"><span className="pv-chip-name">{custom.name}</span><span className="pv-chip-email">{typed}</span></span>
            <button type="button" className="button-secondary pv-suggest-add" onClick={() => add(custom)}>
              <PreviewIcon name="plus" /> Thêm
            </button>
          </li>}
        </ul>}
      </div>}

      <div className="members-tools">
        <label className="members-search">
          <span className="visually-hidden">Tìm kiếm thành viên</span>
          <PreviewIcon name="search" />
          <input value={query} onChange={event => { setQuery(event.target.value); setPage(1) }}
            placeholder="Tìm kiếm thành viên theo tên hoặc email…" />
        </label>
        <label className="chip-select inline"><span className="visually-hidden">Lọc theo vai trò</span>
          <select value={role} onChange={event => { setRole(event.target.value); setPage(1) }}>
            <option value="all">Tất cả vai trò</option>
            {memberRoleOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      <div className="table-scroll">
        <table className="preview-table members-table">
          <thead><tr><th scope="col">#</th><th scope="col">Thành viên</th><th scope="col">Vai trò</th>
            <th scope="col">Ngày tham gia</th><th scope="col"><span className="visually-hidden">Thao tác</span></th></tr></thead>
          <tbody>{visible.map((row, index) => <tr key={row.id}>
            <td>{(safePage - 1) * perPage + index + 1}</td>
            <th scope="row"><span className="member-cell"><Avatar initials={row.initials} size="sm" />
              <span className="member-id"><span className="row-name">{row.name}</span><span className="row-sub">{row.email}</span></span></span></th>
            <WorkspaceMemberRowCells row={row} onChangeRole={onChangeMemberRole} onRemove={onRemoveMember} />
          </tr>)}</tbody>
        </table>
        {visible.length === 0 && <p className="panel-sub">Không có thành viên nào khớp bộ lọc.</p>}
      </div>

      <Pagination label="Phân trang thành viên" total={filtered.length} page={safePage} perPage={perPage}
        unit="thành viên được liệt kê" perPageOptions={[8, 12, 24]} onPage={setPage}
        onPerPage={size => { setPerPage(size); setPage(1) }} hideWhenEmpty />

      <p className="dialog-note" id={previewNoteIds.wsMembers}>{previewReasons.wsMembers}</p>
    </div>
  </div>
}

// Surface cấp phiên của hai modal trên. KHÔNG phải state cục bộ của trang chi tiết: ảnh
// "a_detailed_high_fidelity_ui_screenshot_of_the_sam" vẽ "Thông tin Workspace" và "Quản lý thành
// viên" nằm trong ⋯ của THẺ workspace, mà ⋯ đó có mặt ở trang danh sách, trên Home và ở header
// trang chi tiết — một surface duy nhất cho ba lối vào, đúng khuôn menu/dialog/toast của frame.
//
// Workspace được tra lại từ id chứ không nhận thẳng object: bản ghi có thể biến mất trong lúc
// modal đang mở (chính menu đó có "Xóa Workspace"), và khi không còn thì surface vẽ KHÔNG GÌ
// thay vì vẽ một modal của một workspace đã bị xóa.
export function WorkspacePanelSurface({ panel, workspaces, projects, onClose, onSave, onAddMember, onChangeMemberRole, onRemoveMember }: {
  panel: PreviewWorkspacePanel | null
  workspaces: readonly Workspace[]
  projects: readonly Project[]
  onClose: () => void
  onSave: (workspaceId: string, edit: WorkspaceEdit) => void
  onAddMember: (workspaceId: string, person: Person) => void
  onChangeMemberRole: (workspaceId: string, personId: string, role: string) => void
  onRemoveMember: (workspaceId: string, personId: string) => void
}) {
  if (panel === null) return null
  const workspace = workspaces.find(item => item.id === panel.workspaceId)
  if (!workspace) return null

  const rows = workspaceMemberRows(workspace)
  if (panel.panel === 'members')
    return <WorkspaceMembersDialog workspace={workspace} rows={rows} onClose={onClose}
      onAddMember={person => onAddMember(workspace.id, person)}
      onChangeMemberRole={(personId, role) => onChangeMemberRole(workspace.id, personId, role)}
      onRemoveMember={personId => onRemoveMember(workspace.id, personId)} />

  return <WorkspaceEditDialog workspace={workspace}
    projectCount={projects.filter(project => project.workspaceId === workspace.id).length}
    ownerEmail={rows[0]?.email ?? ''}
    existingNames={workspaces.filter(item => item.id !== workspace.id).map(item => item.name)}
    onClose={onClose} onSave={edit => onSave(workspace.id, edit)} />
}
