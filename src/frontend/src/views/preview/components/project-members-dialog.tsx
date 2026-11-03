import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { Person, PreviewProjectPanel, Project, Workspace } from '../../../types/preview/preview.types'
import { defaultProjectRole, emailForPerson, previewNoteIds, previewReasons, projectRoleOptions } from '../preview-data'
import { PreviewIcon } from './preview-icons'
import { useDialogFocus } from './preview-surface'
import { Avatar } from './preview-shell'
import { usePreviewSession } from '../preview-session-context'

// Panel "Quản lý thành viên" của PROJECT — mục thứ hai trong ⋯ của thẻ dataset
// (ảnh DataVerse_Project_Actions_Details_v1, panel 3). Chủ batch 03/11 yêu cầu bật thật: ảnh vẽ
// mục này là một chức năng, không phải một hàng chờ, và roster của project CÓ thật trong dữ liệu
// mẫu (project.members), nên mọi thao tác ở đây ghi vào đúng trường đó.
//
// BẤT BIẾN NGHIỆP VỤ (chủ batch nhắc, và nó cũng là ba gạch đầu dòng ảnh vẽ ở wizard Tạo Project):
// chỉ người ĐÃ THUỘC WORKSPACE mới được chọn vào project. Vì thế ô thêm người chỉ liệt kê roster
// của workspace chứa project — không có ô nhập email tự do, không có danh bạ toàn cục.
//
// Bảng KHÔNG có cột "Ngày tham gia" như modal của workspace: model project chỉ lưu `members`,
// không lưu mốc kết nạp từng người, nên vẽ một ngày cho mỗi dòng là bịa dữ liệu.
//
// Surface cấp phiên (render một lần trong PreviewSessionProvider) vì ⋯ của thẻ dataset nằm trong
// trang Project, còn panel thì nên là một bản duy nhất cho cả frame — cùng khuôn với hai modal của
// workspace. Project tra lại từ id nên xóa project là panel tự đóng.

const scrimMouseDown = (onClose: () => void) => ({
  onMouseDown: (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  },
})

const roleClass = (role: string): string => `role-badge role-${role.toLowerCase()}`

// Hai ô của MỘT DÒNG người: ô vai trò ghi thẳng vào `Person.role` trong `project.members`, nút
// "Gỡ" ghi thẳng vào mảng đó — cả hai optimistic + Hoàn tác.
//
// Lý do để controls inline thay vì một nút ⋯ mở menu nổi: thân modal có `backdrop-filter`, và
// backdrop-filter biến nó thành containing block của mọi phần tử `position: fixed` bên trong —
// popover mọc trong modal sẽ đậu sai chỗ. Cùng lý do mà màn "Đăng nhập & phiên" (4.4) dùng menu
// inline.
//
// Giá trị `role` của người trong fixture có thể là chức danh công việc chứ không thuộc ba vai trò
// project, nên ô chọn KHÒ cái giá trị hiện tại vào đầu danh sách nếu nó không có sẵn — một
// `<select>` mà value không khớp option nào sẽ hiển thị trống và người dùng tưởng dữ liệu mất.
//
// Chủ sở hữu không có hai ô đó (badge + dấu "—"): gỡ người duy nhất chịu trách nhiệm về project
// là để lại một bản ghi mồ côi, và ảnh wizard đã viết "Chủ sở hữu luôn thuộc project".
function ProjectMemberRowCells({ person, isOwner, onChangeRole, onRemove }: {
  person: Person
  isOwner: boolean
  onChangeRole: (personId: string, role: string) => void
  onRemove: (personId: string) => void
}) {
  if (isOwner) return <>
    <td><span className={roleClass(person.role)}>{person.role}</span></td>
    <td className="row-action"><span className="member-owner-dash" aria-label="Chủ sở hữu không có thao tác">—</span></td>
  </>

  const options = projectRoleOptions.includes(person.role)
    ? projectRoleOptions
    : [person.role, ...projectRoleOptions]

  return <>
    <td>
      <label className="chip-select inline">
        <span className="visually-hidden">Vai trò của {person.name} trong project</span>
        <select value={person.role} onChange={event => onChangeRole(person.id, event.target.value)}>
          {options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    </td>
    <td className="row-action">
      <button type="button" className="icon-button sm row-menu" aria-label={`Gỡ ${person.name} khỏi Project`}
        onClick={() => onRemove(person.id)}>
        <PreviewIcon name="trash" />
      </button>
    </td>
  </>
}

export function ProjectMembersDialog({ project, workspace, onClose }: {
  project: Project
  workspace: Workspace | null
  onClose: () => void
}) {
  const session = usePreviewSession()
  const ref = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<'all' | string>('all')
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  useDialogFocus(ref, onClose)

  // Chủ sở hữu luôn thuộc project (chữ trong ảnh) nhưng không nhất thiết nằm trong `members`, nên
  // bảng ghép họ vào đầu và đếm thêm họ vào tổng số — nếu không, "2 thành viên" cạnh bảng 3 dòng
  // là hai con số cãi nhau trên cùng một màn hình.
  const ownerInList = project.members.some(member => member.id === project.owner.id)
  const rows = ownerInList ? project.members : [project.owner, ...project.members]

  // Ứng viên = roster của workspace, trừ chủ sở hữu và người đã ở project.
  const inProject = new Set(rows.map(row => row.id))
  const pick = search.trim().toLowerCase()
  const roster = workspace?.memberPreview ?? []
  const candidates = roster.filter(person => person.id !== project.owner.id && !inProject.has(person.id)
    && (!pick || person.name.toLowerCase().includes(pick) || emailForPerson(person).toLowerCase().includes(pick)))

  const filtered = rows.filter(person => {
    const needle = query.trim().toLowerCase()
    const matchRole = role === 'all' || person.role === role
    const matchQuery = !needle || person.name.toLowerCase().includes(needle)
      || emailForPerson(person).toLowerCase().includes(needle)
    return matchRole && matchQuery
  })

  const addMember = (person: Person): void => {
    session.addProjectMember(project.id, person, defaultProjectRole)
    setSearch('')
    setAdding(false)
  }

  return <div className="preview-dialog-scrim" {...scrimMouseDown(onClose)}>
    <div ref={ref} className="preview-dialog is-wide" role="dialog" aria-modal="true" aria-labelledby="pj-members-title">
      <header className="dialog-head">
        <span className="dialog-head-icon" aria-hidden="true"><PreviewIcon name="users" /></span>
        <div className="dialog-head-text">
          <h2 id="pj-members-title">Quản lý thành viên</h2>
          <p>Xem, thêm và phân quyền thành viên của Project “{project.name}”.</p>
        </div>
        <button type="button" className="icon-button dialog-close" aria-label="Đóng hộp thoại" onClick={onClose}>
          <PreviewIcon name="close" />
        </button>
      </header>

      <div className="members-summary">
        <span className="members-count-icon" aria-hidden="true"><PreviewIcon name="users" /></span>
        <div className="members-count-text">
          <strong>{rows.length} thành viên</strong>
          <span>Trong Project “{project.name}” · Workspace {workspace?.name ?? 'đã bị gỡ'}</span>
        </div>
        <button type="button" className="button-primary" aria-expanded={adding} aria-controls="pj-add-member"
          onClick={() => { setAdding(value => !value); setSearch('') }}>
          <PreviewIcon name="plus" /> Thêm thành viên
        </button>
      </div>

      {adding && <div className="pv-add-member" id="pj-add-member">
        <label className="members-search">
          <span className="visually-hidden">Tìm thành viên của Workspace để thêm vào Project</span>
          <PreviewIcon name="search" />
          <input value={search} autoFocus onChange={event => setSearch(event.target.value)}
            placeholder="Tìm trong thành viên của Workspace…" autoComplete="off"
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); const first = candidates[0]; if (first) addMember(first) } }} />
        </label>
        {/* Không có ô nhập email ở đây: thêm người ngoài workspace là phá ràng buộc nghiệp vụ mà
            chính ảnh wizard "Tạo Project" đã viết thành ba dòng ghi chú. */}
        {candidates.length === 0 && <p className="panel-sub">{roster.length === 0
          ? 'Workspace của project này chưa có thành viên nào ngoài chủ sở hữu — thêm người trong “Quản lý thành viên” của Workspace trước.'
          : 'Toàn bộ thành viên của Workspace đã thuộc Project này.'}</p>}
        {candidates.length > 0 && <ul className="pv-suggest-list">
          {candidates.map(person => <li key={person.id} className="pv-suggest-row">
            <Avatar initials={person.initials} size="sm" />
            <span className="pv-chip-text"><span className="pv-chip-name">{person.name}</span><span className="pv-chip-email">{emailForPerson(person)}</span></span>
            <button type="button" className="button-secondary pv-suggest-add" onClick={() => addMember(person)}>
              <PreviewIcon name="plus" /> Thêm
            </button>
          </li>)}
        </ul>}
      </div>}

      <div className="members-tools">
        <label className="members-search">
          <span className="visually-hidden">Tìm kiếm thành viên của project</span>
          <PreviewIcon name="search" />
          <input value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Tìm kiếm thành viên theo tên hoặc email…" />
        </label>
        <label className="chip-select inline"><span className="visually-hidden">Lọc theo vai trò</span>
          <select value={role} onChange={event => setRole(event.target.value)}>
            <option value="all">Tất cả vai trò</option>
            {projectRoleOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      <div className="table-scroll">
        <table className="preview-table members-table">
          <thead><tr><th scope="col">#</th><th scope="col">Thành viên</th><th scope="col">Vai trò</th>
            <th scope="col"><span className="visually-hidden">Thao tác</span></th></tr></thead>
          <tbody>{filtered.map((person, index) => <tr key={person.id}>
            <td>{index + 1}</td>
            <th scope="row"><span className="member-cell"><Avatar initials={person.initials} size="sm" />
              <span className="member-id"><span className="row-name">{person.name}</span><span className="row-sub">{emailForPerson(person)}</span></span></span></th>
            <ProjectMemberRowCells person={person}
              isOwner={person.id === project.owner.id}
              onChangeRole={(personId, nextRole) => session.setProjectMemberRole(project.id, personId, nextRole)}
              onRemove={personId => session.removeProjectMember(project.id, personId)} />
          </tr>)}</tbody>
        </table>
        {filtered.length === 0 && <p className="panel-sub">Không có thành viên nào khớp bộ lọc.</p>}
      </div>

      <p className="dialog-note" id={previewNoteIds.projectMembersPage}>{previewReasons.projectMembers}</p>
    </div>
  </div>
}

// Surface cấp phiên: tra project từ id; project không còn (vừa bị xóa từ chính ⋯) thì vẽ KHÔNG GÌ
// thay vì mở một modal của một bản ghi đã mất.
export function ProjectPanelSurface({ panel, projects, workspaces, onClose }: {
  panel: PreviewProjectPanel | null
  projects: readonly Project[]
  workspaces: readonly Workspace[]
  onClose: () => void
}) {
  if (panel === null) return null
  const project = projects.find(item => item.id === panel.projectId)
  if (!project) return null
  const workspace = workspaces.find(item => item.id === project.workspaceId) ?? null
  return <ProjectMembersDialog project={project} workspace={workspace} onClose={onClose} />
}
