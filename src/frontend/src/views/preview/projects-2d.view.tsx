import { useMemo, useState } from 'react'
import type { PreviewMenuOrigin, Project, ProjectFilterTab } from '../../types/preview/preview.types'
import {
  formatCount, formatDataSize, formatRows, projectStatsFor, projectTabsFor, projectsOf,
} from './preview-data'
import { Avatar, PreviewShell } from './components/preview-shell'
import { PreviewIcon } from './components/preview-icons'
import { CoverArt, EmptyHint, FilterTabs, Pagination, StatRow, StatusBadge } from './components/preview-primitives'
import { usePreviewSession } from './preview-session-context'
import { projectMenu } from './preview-menu'
import { previewCardProps } from './preview-card'

type ViewMode = 'grid' | 'list'
type SortKey = 'recent' | 'name' | 'rows'

const sortLabels: Record<SortKey, string> = { recent: 'Mới nhất', name: 'Tên A→Z', rows: 'Số bản ghi' }

// Số avatar tối đa trên một thẻ. Quá chừng này thì ghi thêm "+N" với N là số NGƯỜI THẬT
// còn lại (xem footer): bản cũ ghi chết "+3" dù `project.members` đã là toàn bộ danh sách
// → thẻ 2 người báo 5 người, và bảng project ở trang WorkSPACE đã cắt đúng kiểu này rồi.
const maxAvatars = 3

const matchTab = (project: Project, tab: ProjectFilterTab): boolean => tab === 'all' || project.status === tab

const sortProjects = (list: readonly Project[], key: SortKey): Project[] => {
  const copy = [...list]
  if (key === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  if (key === 'rows') return copy.sort((a, b) => (b.dataset?.rows ?? 0) - (a.dataset?.rows ?? 0))
  return copy
}

export function ProjectCard({ project, selected, view }: {
  project: Project
  selected: boolean
  view: ViewMode
}) {
  const session = usePreviewSession()
  const target = { kind: 'project' as const, id: project.id, name: project.name }
  const openMenu = (origin: PreviewMenuOrigin) => session.openMenu({ ...projectMenu(project), origin })

  return <article className={`resource-card${selected ? ' is-selected' : ''}${view === 'list' ? ' is-list' : ''}`}
    role="button" tabIndex={0} aria-pressed={selected}
    {...previewCardProps({
      // Đặc tả: "bấm vào phải có trang project". 1 click = trang Project Workspace Overview
      // (run('open') ghi route /projects/<ws>/<prj}); KHÔNG truyền universe — chuột kép cũng đáp
      // đúng trang đó, vì mọi lối "vào project" đều phải qua Overview (ảnh Overview_v1). Scene 3D
      // của T gọi từ chính trang ấy.
      detail: () => session.run('open', target),
      menu: openMenu,
    })}>
    <div className="card-cover"><CoverArt hue={project.cover} seed={project.id} kind="project" />
      {/* Ảnh projects đánh dấu thẻ đang chọn bằng check tròn trên ảnh. */}
      {selected && <span className="card-select-check" aria-hidden="true"><PreviewIcon name="check" /></span>}
      <span className="card-top-actions">
        <StatusBadge status={project.status} />
        <button type="button" className="icon-button on-dark" aria-label={`Thao tác với ${project.name}`} aria-haspopup="menu"
          onClick={event => { event.stopPropagation(); openMenu({ kind: 'anchor', element: event.currentTarget }) }}>
          <PreviewIcon name="more" />
        </button>
      </span>
    </div>
    <div className="card-body">
      <h3 className="card-title">{project.name}</h3>
      <p className="card-desc">{project.description}</p>
      {project.dataset
        ? <div className="file-row">
          <span className="file-badge" aria-hidden="true">{project.dataset.format.slice(0, 3).toUpperCase()}</span>
          <span className="file-text"><strong>{project.dataset.fileName}</strong>
            <small>{project.dataset.format} · {formatRows(project.dataset.rows)} · {project.dataset.columns} cột</small></span>
        </div>
        : <p className="file-missing">Chưa có tập dữ liệu.</p>}
      <dl className="card-metrics">
        <div><dt>{project.dataset ? formatCount(project.dataset.rows) : '0'}</dt><dd>bản ghi</dd></div>
        <div><dt>{project.dataset?.columns ?? 0}</dt><dd>cột</dd></div>
        <div><dt>{project.dataset ? formatDataSize(project.dataset.sizeMb) : '—'}</dt><dd>dung lượng</dd></div>
      </dl>
      <footer className="card-foot">
        {project.members.length
          ? <span className="avatar-stack">
            {project.members.slice(0, maxAvatars).map(person => <Avatar key={person.id} initials={person.initials} size="sm" />)}
            {project.members.length > maxAvatars && <span className="avatar-more">+{project.members.length - maxAvatars}</span>}
          </span>
          : <span className="card-updated">chưa có thành viên</span>}
        <span className="card-updated"><PreviewIcon name="clock" /> Cập nhật {project.updatedAt}</span>
      </footer>
    </div>
  </article>
}

export function ProjectsPreviewView() {
  const session = usePreviewSession()
  const [tab, setTab] = useState<ProjectFilterTab>('all')
  const [view, setView] = useState<ViewMode>('grid')
  const [sort, setSort] = useState<SortKey>('recent')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(9)
  const { state } = session

  // Phạm vi: combobox "Không gian" ở topbar (và chuột phải → "Mở dự án của workspace")
  // đặt workspaceId vào selection. id rỗng = xem toàn bộ, nên trang Projects có cả chế độ
  // global thay vì mãi khóa vào một workspace.
  const scoped = state.selection.workspaceId
    ? projectsOf(state, state.selection.workspaceId)
    : state.projects
  const workspaceLabel = state.workspaces.find(item => item.id === state.selection.workspaceId)?.name ?? 'mọi không gian'

  const filtered = useMemo(
    () => sortProjects(scoped.filter(project => matchTab(project, tab)), sort),
    [scoped, tab, sort],
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage)
  const selected = filtered.find(project => project.id === state.selection.projectId) ?? filtered[0] ?? null

  return <PreviewShell active="projects">
    <div className="page-head">
      <div className="page-head-text">
        <span className="page-eyebrow">Cấp 2 · Dự án trong {workspaceLabel}</span>
        <h1 id="page-heading" tabIndex={-1}>Dự án</h1>
        <p>Mỗi project gắn với đúng một tập dữ liệu chính và một nhóm thành viên. Bấm một thẻ để mở trang Project,
          bấm hai lần để mở Dataset Universe 3D, chuột phải để mở menu thao tác.</p>
      </div>
      {/* Nút mở chính wizard 4 bước — wizard là surface cấp phiên nên trang chỉ việc truyền
          phạm vi đang xem (id rỗng → wizard tự hiện ô chọn Workspace bắt buộc). */}
      <button type="button" className="button-primary"
        onClick={() => session.openProjectWizard(state.selection.workspaceId || null)}>
        <PreviewIcon name="plus" /> Tạo project
      </button>
    </div>

    <StatRow stats={projectStatsFor(scoped)} />

    <div className="toolbar">
      <FilterTabs tabs={projectTabsFor(scoped)} active={tab} onChange={id => { setTab(id); setPage(1) }} label="Lọc dự án" />
      <div className="toolbar-right">
        <div className="view-toggle" role="group" aria-label="Kiểu hiển thị">
          <button type="button" className={`icon-button${view === 'grid' ? ' is-active' : ''}`} aria-pressed={view === 'grid'}
            aria-label="Hiển thị dạng lưới" onClick={() => setView('grid')}><PreviewIcon name="grid" /></button>
          <button type="button" className={`icon-button${view === 'list' ? ' is-active' : ''}`} aria-pressed={view === 'list'}
            aria-label="Hiển thị dạng danh sách" onClick={() => setView('list')}><PreviewIcon name="list" /></button>
        </div>
        {/* Nút "Bộ lọc" RỜI từng nằm ở đây và đang tắt. Hàng tab FilterTabs + ô Sắp xếp ngay
            bên cạnh đã LÀM đúng việc của một ngăn lọc, và nó luôn nhìn thấy được, nên thêm một
            nút mở ngăn thứ hai chứa đúng những control đó là module không có giá trị — bỏ hẳn
            thay vì bật một bản sao thừa. */}
        <label className="chip-select inline"><span className="visually-hidden">Sắp xếp</span>
          <select value={sort} onChange={event => setSort(event.target.value as SortKey)}>
            {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
    </div>

    {visible.length === 0
      ? <EmptyHint title="Không có kết quả"
        note={scoped.length === 0
          ? `Trong ${workspaceLabel} chưa có project nào. Chọn Workspace khác hoặc tạo project mới.`
          : 'Thử đổi tab lọc hoặc đổi không gian ở topbar.'} />
      : <div className={`card-grid${view === 'list' ? ' is-list' : ''}`}>
        {visible.map(project => <ProjectCard key={project.id} project={project}
          view={view} selected={project.id === selected?.id} />)}
      </div>}

    <Pagination label="Phân trang dự án" total={filtered.length} page={safePage} perPage={perPage}
      unit="project" perPageOptions={[9, 12, 24]} onPage={setPage}
      onPerPage={size => { setPerPage(size); setPage(1) }} />
  </PreviewShell>
}
