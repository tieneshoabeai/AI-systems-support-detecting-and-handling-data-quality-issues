import { useMemo, useState } from 'react'
import type {
  PreviewMenuOrigin, Project, ProjectStatus, Workspace, WorkspaceOwnershipFilter, WorkspaceRoleFilter, WorkspaceSort,
} from '../../types/preview/preview.types'
import {
  byNewestFirst, datasetCountOf, matchWorkspaceOwnership, matchWorkspaceQuery, matchWorkspaceRole, monthlyProgressFor,
  previewNotice, previewNoteIds, previewReasons, projectStatusBuckets, projectsOf, sortWorkspaces,
  workspaceOwnershipOptions, workspaceRoleOptions, workspaceSortOptions, workspaceStatsFor,
} from './preview-data'
import { Avatar, PreviewShell } from './components/preview-shell'
import { PreviewIcon } from './components/preview-icons'
import { ActionNote, CoverArt, EmptyHint, Pagination, Panel, ProgressBar, StatRow, StatusBadge, StatusDonut } from './components/preview-primitives'
import { WorkspaceCreateDialog } from './components/workspace-create-dialog'
import { usePreviewSession } from './preview-session-context'
import { projectMenu, workspaceMenu } from './preview-menu'
import { previewCardProps, stopCardBubble } from './preview-card'

type ViewMode = 'grid' | 'list'
type DetailSort = 'recent' | 'name'

const statusFilterLabels: Record<ProjectStatus, string> = {
  active: 'Đang hoạt động', paused: 'Tạm dừng', processing: 'Đang xử lý',
  completed: 'Đã hoàn thành', archived: 'Đã lưu trữ',
}

// Số workspace TỐI ĐA một trang, đúng con số chủ batch yêu cầu. Ô "Số dòng" cho phép chọn
// ít hơn (10 · 20 · 28) nhưng không được vượt 28: 28 là trần, không phải mặc định duy nhất.
const maxWorkspacesPerPage = 28
const workspacePerPageOptions: readonly number[] = [10, 20, maxWorkspacesPerPage]

// Tìm kiếm trang: tên + mô tả (`matchWorkspaceQuery` ở tầng data, để view lẫn test dùng một
// quy tắc). Ô nhập nằm trong toolbar của chính trang (.toolbar-search), KHÔNG ở topbar — topbar
// đã bỏ thanh tìm kiếm chung theo yêu cầu 03/11.

export function WorkspaceCard({ workspace, index, selected, view }: {
  workspace: Workspace
  index: number
  selected: boolean
  view: ViewMode
}) {
  const session = usePreviewSession()
  const target = { kind: 'workspace' as const, id: workspace.id, name: workspace.name }
  const openMenu = (origin: PreviewMenuOrigin) => session.openMenu({ ...workspaceMenu(workspace), origin })

  return <article className={`resource-card${selected ? ' is-selected' : ''}${view === 'list' ? ' is-list' : ''}`}
    role="button" tabIndex={0} aria-pressed={selected}
    {...previewCardProps({
      // Design Board "workspaces detail": bấm một thẻ workspace MỞ TRANG RIÊNG của nó
      // (#/preview/workspaces/<id>) thay vì bật panel kề bên như bản cũ.
      detail: () => session.run('open', target),
      universe: () => session.run('universe', target),
      menu: openMenu,
    })}>
    <div className="card-cover"><CoverArt hue={workspace.cover} seed={index} />
      <span className="card-top-actions">
        {/* ★ giờ là nút THẬT: mock store đổi cờ yêu thích + toast Hoàn tác. */}
        <button type="button" className={`fav-button${workspace.favorite ? ' is-on' : ''}`}
          aria-pressed={workspace.favorite}
          aria-label={workspace.favorite ? `Bỏ yêu thích ${workspace.name}` : `Yêu thích ${workspace.name}`}
          onClick={stopCardBubble(() => session.run(workspace.favorite ? 'unfavorite' : 'favorite', target))}>
          <PreviewIcon name="star" />
        </button>
      </span>
    </div>
    <div className="card-body">
      <header className="card-head"><h3>{workspace.name}</h3>
        <button type="button" className="icon-button card-menu" aria-label={`Thao tác với ${workspace.name}`} aria-haspopup="menu"
          onClick={event => { event.stopPropagation(); openMenu({ kind: 'anchor', element: event.currentTarget }) }}>
          <PreviewIcon name="more" />
        </button>
      </header>
      <p className="card-desc">{workspace.description}</p>
      <dl className="card-metrics">
        <div><dt>{projectsOf(session.state, workspace.id).length}</dt><dd>Dự án</dd></div>
        <div><dt>{datasetCountOf(session.state, workspace.id)}</dt><dd>Tập dữ liệu</dd></div>
        <div><dt>{workspace.members}</dt><dd>Thành viên</dd></div>
      </dl>
      <footer className="card-foot">
        <span className="avatar-stack">
          {workspace.memberPreview.map(person => <Avatar key={person.id} initials={person.initials} size="sm" />)}
          {workspace.members > workspace.memberPreview.length && <span className="avatar-more">+{workspace.members - workspace.memberPreview.length}</span>}
        </span>
        <span className="card-updated">{workspace.updatedAt}</span>
      </footer>
    </div>
  </article>
}

// Trang chi tiết workspace (Design Board "workspaces detail"): header + 4 stat card +
// bar + donut + bảng project có tìm/lọc/sắp xếp/phân trang. Mọi số suy từ mock store.
// Hai biểu đồ dùng ProgressBar/StatusDonut chung với Home (components/preview-primitives).
//
// Ô "Tìm theo tên project" nằm TRONG toolbar của bảng, ngay trước bộ lọc trạng thái và sắp
// xếp — không phải ở topbar. Topbar chỉ còn phạm vi workspace + nút cá nhân (chủ batch 03/11
// đã bỏ thanh tìm kiếm chung của mọi trang).
function WorkspaceDetailView({ workspace }: { workspace: Workspace }) {
  const session = usePreviewSession()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | ProjectStatus>('all')
  const [sort, setSort] = useState<DetailSort>('recent')
  const [page, setPage] = useState(1)
  const perPage = 10

  const buckets = projectStatusBuckets(session.state, workspace.id)
  const monthly = monthlyProgressFor(workspace.id, buckets.total)
  const owned = projectsOf(session.state, workspace.id)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = owned.filter(project =>
      (status === 'all' || project.status === status)
      && (!needle || project.name.toLowerCase().includes(needle)))
    return sort === 'name'
      ? list.slice().sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      : list.slice().sort(byNewestFirst)
  }, [owned, status, query, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  const stats = [
    { id: 'wsd-total', label: 'Tổng Project', value: String(buckets.total), delta: '', tone: 'brand' as const },
    { id: 'wsd-unproc', label: 'Chưa xử lý', value: String(buckets.unprocessed), delta: '', tone: 'orange' as const },
    { id: 'wsd-proc', label: 'Đang xử lý', value: String(buckets.processing), delta: '', tone: 'cyan' as const },
    { id: 'wsd-done', label: 'Đã hoàn thành', value: String(buckets.completed), delta: '', tone: 'green' as const },
  ]

  const openProjectMenu = (project: Project, origin: PreviewMenuOrigin) =>
    session.openMenu({ ...projectMenu(project), origin })

  return <PreviewShell active="workspaces" notice={previewNotice}>
    <nav className="ws-crumb" aria-label="Path điều hướng">
      <button type="button" className="crumb-link" onClick={() => session.openSection('workspaces')}>Workspaces</button>
      <span className="crumb-sep" aria-hidden="true">›</span>
      <span className="crumb-current" aria-current="page">{workspace.name}</span>
    </nav>

    <header className="ws-detail-head">
      <span className="ws-detail-cover"><CoverArt hue={workspace.cover} seed={workspace.name.length} /></span>
      <div className="ws-detail-title">
        <div className="ws-detail-name"><h1 id="page-heading" tabIndex={-1}>{workspace.name}</h1><StatusBadge status={workspace.status} /></div>
        <p className="ws-detail-desc">{workspace.description}</p>
        <div className="ws-chips">
          <span className="ws-chip owner-chip"><Avatar initials={workspace.owner.initials} size="sm" />{workspace.owner.name}</span>
          <span className="ws-chip">Tạo ngày {workspace.createdAt}</span>
          <span className="ws-chip">Cập nhật {workspace.updatedAt}</span>
          <span className="ws-chip">Thành viên {workspace.members}</span>
        </div>
      </div>
      <div className="ws-detail-actions">
        {/* Ảnh "a_detailed_high_fidelity_ui_screenshot_of_the_sam" vẽ header CHỈ có một nút ⋯:
           "Thông tin Workspace" và "Quản lý thành viên" là hai MỤC của menu đó, không phải hai
           nút đặt cạnh nhau. Hai nút rời ở đây sẽ là bản sao thứ hai của chính menu. */}
        <button type="button" className="icon-button ws-detail-menu" aria-label={`Thao tác với ${workspace.name}`} aria-haspopup="menu"
          onClick={event => session.openMenu({ ...workspaceMenu(workspace), origin: { kind: 'anchor', element: event.currentTarget } })}>
          <PreviewIcon name="more" />
        </button>
      </div>
    </header>

    <StatRow stats={stats} />

    <div className="detail-charts">
      <Panel title="Tiến độ Project theo thời gian"><ProgressBar data={monthly} /></Panel>
      <Panel title="Phân bố trạng thái Project">
        <StatusDonut total={buckets.total} rows={[
          { label: 'Chưa xử lý', value: buckets.unprocessed },
          { label: 'Đang xử lý', value: buckets.processing },
          { label: 'Đã hoàn thành', value: buckets.completed },
        ]} />
      </Panel>
    </div>

    <Panel title={`Project (${owned.length})`} action={
      <div className="toolbar-right">
        <label className="toolbar-search">
          <PreviewIcon name="search" />
          <span className="visually-hidden">Tìm project theo tên trong workspace này</span>
          <input value={query} onChange={event => { setQuery(event.target.value); setPage(1) }}
            placeholder="Tìm theo tên project…" autoComplete="off" />
        </label>
        <label className="chip-select inline"><span className="visually-hidden">Lọc theo trạng thái</span>
          <select value={status} onChange={event => { setStatus(event.target.value as 'all' | ProjectStatus); setPage(1) }}>
            <option value="all">Tất cả trạng thái</option>
            {(Object.keys(statusFilterLabels) as ProjectStatus[]).map(value => <option key={value} value={value}>{statusFilterLabels[value]}</option>)}
          </select>
        </label>
        <label className="chip-select inline"><span className="visually-hidden">Sắp xếp project</span>
          <select value={sort} onChange={event => setSort(event.target.value as DetailSort)}>
            <option value="recent">Mới nhất</option>
            <option value="name">Tên A→Z</option>
          </select>
        </label>
        <button type="button" className="button-primary" onClick={() => session.openProjectWizard(workspace.id)}><PreviewIcon name="plus" /> Tạo Project</button>
      </div>}>
      <div className="table-scroll">
        <table className="preview-table">
          <thead><tr><th scope="col">#</th><th scope="col">Tên Project</th><th scope="col">Trạng thái</th>
            <th scope="col">Cập nhật</th><th scope="col">Thành viên</th>
            <th scope="col"><span className="visually-hidden">Thao tác</span></th></tr></thead>
          <tbody>{visible.map((project, index) => {
            const projectTarget = { kind: 'project' as const, id: project.id, name: project.name }
            return <tr key={project.id} tabIndex={0}
              onClick={() => session.run('open', projectTarget)}
              onKeyDown={event => { if (event.key === 'Enter') session.run('open', projectTarget) }}
              onContextMenu={event => { event.preventDefault(); openProjectMenu(project, { kind: 'pointer', x: event.clientX, y: event.clientY }) }}>
              <td>{(safePage - 1) * perPage + index + 1}</td>
              <th scope="row"><span className="row-name">{project.name}</span><span className="row-sub">{project.code}</span></th>
              <td><StatusBadge status={project.status} /></td>
              <td>{project.updatedAt}</td>
              <td><span className="avatar-stack">{project.members.slice(0, 3).map(person => <Avatar key={person.id} initials={person.initials} size="sm" />)}</span></td>
              <td className="row-action">
                <button type="button" className="icon-button row-menu" aria-label={`Thao tác với ${project.name}`} aria-haspopup="menu"
                  onClick={event => { event.stopPropagation(); openProjectMenu(project, { kind: 'anchor', element: event.currentTarget }) }}>
                  <PreviewIcon name="more" />
                </button>
              </td>
            </tr>
          })}</tbody>
        </table>
        {visible.length === 0 && <p className="panel-sub">Không có project nào khớp bộ lọc.</p>}
      </div>

      {filtered.length > 0 && <Pagination label="Phân trang project" total={filtered.length}
        page={safePage} perPage={perPage} unit="Project" onPage={setPage} />}
    </Panel>
    <ActionNote id={previewNoteIds.workspaces}>{previewReasons.workspaces}</ActionNote>
    {/* Hai modal của workspace và wizard "Tạo Project" đều là surface CẤP PHIÊN
       (WorkspacePanelSurface / ProjectWizard trong PreviewSessionProvider) vì ⋯ của THẺ ở trang
       danh sách cũng mở được chúng — render một lần duy nhất thay vì mỗi trang một bản. */}
  </PreviewShell>
}

export function WorkspacesPreviewView({ workspaceId }: { workspaceId?: string | null }) {
  const session = usePreviewSession()
  const [query, setQuery] = useState('')
  const [ownership, setOwnership] = useState<WorkspaceOwnershipFilter>('all')
  const [role, setRole] = useState<WorkspaceRoleFilter>('all')
  const [sort, setSort] = useState<WorkspaceSort>('accessed')
  const [view, setView] = useState<ViewMode>('grid')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(maxWorkspacesPerPage)
  const [creating, setCreating] = useState(false)
  const { state } = session

  // Có id trong route và id đó còn tồn tại trong store → trang dashboard chi tiết. Id không
  // còn (vừa bị xóa) rơi về danh sách thay vì vẽ một trang trống.
  const detailWorkspace = workspaceId ? state.workspaces.find(item => item.id === workspaceId) ?? null : null

  // Lọc → sắp xếp → cắt trang, ĐÚNG thứ tự ảnh khung 8 vẽ. Đảo lại (cắt trang rồi lọc) thì
  // dòng "của N Workspaces" nói số của một trang chứ không phải số của danh sách khớp lọc.
  const filtered = useMemo(() => sortWorkspaces(
    state.workspaces.filter(workspace =>
      matchWorkspaceOwnership(workspace, ownership)
      && matchWorkspaceRole(workspace, role)
      && matchWorkspaceQuery(workspace, query)),
    sort,
  ), [state.workspaces, ownership, role, query, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage)
  const selected = visible.find(workspace => workspace.id === state.selection.workspaceId) ?? visible[0] ?? null

  if (detailWorkspace) return <WorkspaceDetailView key={detailWorkspace.id} workspace={detailWorkspace} />

  return <PreviewShell active="workspaces" notice={previewNotice}>
    <div className="page-head">
      <div className="page-head-text">
        <span className="page-eyebrow">Cấp 1 · Workspaces</span>
        <h1 id="page-heading" tabIndex={-1}>Workspaces</h1>
        <p>Nơi chứa dự án, tập dữ liệu và thành viên; mỗi workspace là một ranh giới truy cập riêng.
          Bấm một thẻ để mở trang chi tiết, bấm hai lần để mở Dataset Universe 3D, chuột phải để mở menu thao tác.</p>
      </div>
      {/* Ảnh khung 1: nút "Tạo Workspace" nằm ở khối đầu trang, NGAY TRÊN dải art. Art là
          trang trí (ẩn dưới 900px) nên nút không được đặt bên trong nó — nếu không, màn
          hẹp mất luôn lối vào duy nhất để tạo. */}
      <div className="page-head-side">
        <button type="button" className="button-primary" onClick={() => setCreating(true)}>
          <PreviewIcon name="plus" /> Tạo Workspace
        </button>
        <div className="page-head-art" aria-hidden="true"><CoverArt hue="cyan" seed={3} /></div>
      </div>
    </div>

    <StatRow stats={workspaceStatsFor(state)} />

    <div className="toolbar">
      <div className="toolbar-right">
        {/* Ô tìm kiếm đứng NGAY TRƯỚC ba bộ lọc (quyền sở hữu · vai trò · sắp xếp) vì nó là
            lối lọc hẹp nhất: gõ một từ khóa thì hai ô kia chỉ còn chỉnh phạm vi còn lại.
            `setPage(1)` ở đây chứ không ở reducer — để lại trang cũ khi danh sách vừa co về
            2 kết quả là rơi vào trang trắng. */}
        <label className="toolbar-search">
          <PreviewIcon name="search" />
          <span className="visually-hidden">Tìm workspace theo tên hoặc mô tả</span>
          <input value={query} onChange={event => { setQuery(event.target.value); setPage(1) }}
            placeholder="Tìm kiếm Workspace…" autoComplete="off" />
        </label>
        <label className="chip-select inline"><span className="visually-hidden">Lọc theo quyền sở hữu</span>
          <select value={ownership} onChange={event => { setOwnership(event.target.value as WorkspaceOwnershipFilter); setPage(1) }}>
            {workspaceOwnershipOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label className="chip-select inline"><span className="visually-hidden">Lọc theo vai trò</span>
          <select value={role} onChange={event => { setRole(event.target.value as WorkspaceRoleFilter); setPage(1) }}>
            {workspaceRoleOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label className="chip-select inline"><span className="chip-label">Sắp xếp</span>
          <select value={sort} onChange={event => { setSort(event.target.value as WorkspaceSort); setPage(1) }}>
            {workspaceSortOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <div className="toolbar-right">
        <div className="view-toggle" role="group" aria-label="Kiểu hiển thị">
          <button type="button" className={`icon-button${view === 'grid' ? ' is-active' : ''}`} aria-pressed={view === 'grid'}
            aria-label="Hiển thị dạng lưới" onClick={() => setView('grid')}><PreviewIcon name="grid" /></button>
          <button type="button" className={`icon-button${view === 'list' ? ' is-active' : ''}`} aria-pressed={view === 'list'}
            aria-label="Hiển thị dạng danh sách" onClick={() => setView('list')}><PreviewIcon name="list" /></button>
        </div>
      </div>
    </div>
    <ActionNote id={previewNoteIds.workspaces}>{previewReasons.workspaces}</ActionNote>

    {visible.length === 0
      ? <EmptyHint title="Không có kết quả" note="Thử đổi một trong ba bộ lọc (quyền sở hữu · vai trò · sắp xếp) hoặc từ khóa tìm kiếm." />
      : <div className={`card-grid${view === 'list' ? ' is-list' : ''}`}>
        {visible.map((workspace, index) => <WorkspaceCard key={workspace.id} workspace={workspace} index={index}
          view={view} selected={workspace.id === selected?.id} />)}
      </div>}

    {/* Ảnh khung 1: chân trang có dòng "Hiển thị … của … Workspaces", nút lật và ô "Số dòng".
        28 là TRẦN một trang theo yêu cầu chủ batch; ô chọn chỉ cho 10 · 20 · 28. */}
    <Pagination label="Phân trang workspace" total={filtered.length} page={safePage} perPage={perPage}
      unit="Workspaces" perPageOptions={workspacePerPageOptions} onPage={setPage}
      onPerPage={size => { setPerPage(size); setPage(1) }} hideWhenEmpty />

    {creating && <WorkspaceCreateDialog existingNames={state.workspaces.map(item => item.name)}
      onClose={() => setCreating(false)} />}
  </PreviewShell>
}
