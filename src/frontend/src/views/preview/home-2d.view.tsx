import { lazy, Suspense, useState } from 'react'
import type { ReactNode } from 'react'
import type { PreviewMenuOrigin, Project, Workspace } from '../../types/preview/preview.types'
import {
  byNewestFirst, homeOverviewStats, pluralEn,
  projectsOf, projectsPerWorkspaceFor, projectStatusShareFor,
} from './preview-data'
import { PreviewShell } from './components/preview-shell'
import { PreviewIcon } from './components/preview-icons'
import { ResourceAvatar } from './components/resource-avatar'
import './home-hero.css'
const HomeUniverse = lazy(() => import('../../graphics/workspace-3d/home-universe'))
import { Pagination, Panel, ProgressBar, StatRow, StatusBadge, StatusDonut, TextLink } from './components/preview-primitives'
import { usePreviewSession } from './preview-session-context'
import { projectMenu, workspaceMenu } from './preview-menu'
import { originFromEvent, previewCardProps, stopCardBubble } from './preview-card'

// Trang Home theo UI-UX/home + Global Application Shell, nhưng toàn bộ số liệu và danh
// sách đọc từ mock store. ĐÚNG NĂM khối của ảnh — hero chào mừng, Activity Overview,
// Projects by Status, Projects per Workspace, Recent Workspaces, Recent Projects — không
// thêm panel "tiện ích" ngoài thiết kế. Quy tắc chuột (xem preview-card.ts):
//   · project  : 1 click = trang Project Workspace Overview (2 click cũng vậy — vào project là phải qua Overview)
//   · workspace: 1 click = xuống Workspaces với phạm vi của nó · 2 click = universe
//   · mọi dòng : chuột phải / phím Menu = menu thao tác

// Nhãn để tiếng Anh theo đặc tả ("các nhãn tiếng Anh, còn lại tiếng Việt"); nội dung mô tả
// vẫn tiếng Việt nhưng product noun giữ nguyên chữ Anh (workspace · project · dataset).
const heroValues: readonly { icon: string; title: string; caption: string }[] = [
  { icon: 'chart', title: 'Phân tích dữ liệu thông minh', caption: 'Khám phá insight nhanh chóng.' },
  { icon: 'shield', title: 'Đảm bảo chất lượng dữ liệu', caption: 'Phát hiện và xử lý vấn đề hiệu quả.' },
  { icon: 'sparkle', title: 'Tối ưu quy trình xử lý', caption: 'Làm việc trong không gian Project linh hoạt.' },
]

// Khung trống trên Home chỉ còn một nguyên nhân: ô tìm kiếm toàn cục ở topbar đã bỏ (chủ batch
// 03/11) nên hai danh sách ở đây không lọc theo từ khóa nữa — trống là vì dữ liệu mẫu trống.
const emptyFor = (unit: string): string => `Chưa có ${unit} nào.`

export type UniverseHeroProps = {
  // T truyền scene Three.js vào đây khi làm phần 3D. Khi chưa có, view render placeholder.
  scene?: ReactNode
}

// Banner chào mừng đầu trang (ảnh home): lời chào + globe 3D (placeholder của T) + ba giá trị.
// Bản cũ kê thêm thẻ số liệu và danh sách 7 module — trùng đúng hàng stat bên dưới và không có
// trong ảnh → đã bỏ để Home gọn đúng thiết kế.
export function UniverseHero({ scene }: UniverseHeroProps) {
  const [paused, setPaused] = useState(false)
  const fallback = <div className="hero-cosmos" aria-hidden="true">
    <span className="cosmos-orbit cosmos-orbit-one" /><span className="cosmos-orbit cosmos-orbit-two" />
    <span className="cosmos-orbit cosmos-orbit-three" /><span className="cosmos-planet" />
    <span className="cosmos-satellite cosmos-satellite-one" /><span className="cosmos-satellite cosmos-satellite-two" />
  </div>
  return <section className="hero universe-hero" aria-labelledby="hero-title">
    <div className="hero-copy">
      <span className="eyebrow">Chào mừng đến với DataVerse</span>
      <h1 id="hero-title">Khám phá <span>vũ trụ dữ liệu</span> của bạn</h1>
      <p>Một không gian để kết nối đội nhóm, khám phá dữ liệu và tìm ra những điều có ý nghĩa.</p>
    </div>
    <div className="hero-stage">
      {scene ?? <div className="hero-stage-placeholder" role="img"
        aria-label="Minh họa vũ trụ dữ liệu">
        <Suspense fallback={fallback}><HomeUniverse paused={paused} fallback={fallback} /></Suspense>
      </div>}
    </div>
    {!scene && <button type="button" className="hero-motion-button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>
      <PreviewIcon name={paused ? 'processing' : 'pause'} />{paused ? 'Tiếp tục chuyển động' : 'Dừng chuyển động'}
    </button>}
    <ul className="hero-values">
      {heroValues.map(value => <li key={value.title}>
        <span className="hero-value-icon" aria-hidden="true"><PreviewIcon name={value.icon} /></span>
        <span className="hero-value-text"><strong>{value.title}</strong><small>{value.caption}</small></span>
      </li>)}
    </ul>
  </section>
}

// "Nút lớn" cho Workspace gần đây (đặc tả home): mỗi workspace là một tile bấm được, hiện
// tên + số project thật (suy từ mock store) + mốc cập nhật. Giữ class `.mini-card` và <h3>tên</h3>
// vì test định vị thẻ qua miniCardByTitle.
function WorkspaceTile({ workspace }: { workspace: Workspace }) {
  const session = usePreviewSession()
  const target = { kind: 'workspace' as const, id: workspace.id, name: workspace.name }
  const openMenu = (origin: PreviewMenuOrigin) => session.openMenu({ ...workspaceMenu(workspace), origin })
  const projectCount = projectsOf(session.state, workspace.id).length
  const selected = session.state.selection.workspaceId === workspace.id

  return <article className={`mini-card ws-tile${selected ? ' is-selected' : ''}`}
    role="button" tabIndex={0} aria-pressed={selected}
    {...previewCardProps({
      // Bấm workspace ở Home = xuống Workspaces với phạm vi của nó (đặc tả: menu cũng xuống theo).
      detail: () => session.run('open', target),
      menu: openMenu,
    })}>
    <span className={`ws-tile-icon cover-${workspace.cover}`} aria-hidden="true"><ResourceAvatar kind="workspace" id={workspace.id} fallback="workspaces" /></span>
    <div className="ws-tile-body">
      <h3>{workspace.name}{workspace.favorite && <span className="fav" aria-label="Yêu thích">★</span>}</h3>
      {/* '1 project' / '12 projects': cứng 'projects' sẽ in ra "1 projects" ở workspace lẻ. */}
      <small>{pluralEn(projectCount, 'project')} · {workspace.updatedAt}</small>
    </div>
    <button type="button" className={`fav-button${workspace.favorite ? ' is-on' : ''}`}
      aria-pressed={workspace.favorite}
      aria-label={workspace.favorite ? `Bỏ yêu thích ${workspace.name}` : `Yêu thích ${workspace.name}`}
      onClick={stopCardBubble(() => session.run(workspace.favorite ? 'unfavorite' : 'favorite', target))}>
      <PreviewIcon name="star" />
    </button>
    <button type="button" className="icon-button mini-card-menu" aria-label={`Thao tác với ${workspace.name}`} aria-haspopup="menu"
      onClick={event => { event.stopPropagation(); openMenu({ kind: 'anchor', element: event.currentTarget }) }}>
      <PreviewIcon name="more" />
    </button>
  </article>
}

// Phân trang dùng chung ở preview-primitives (markup nav.pagination + icon-button + page-button).
// Hai khung gần đây TỰ CUỘN trong chính khung (chủ sở hữu batch duyệt): một trang nằm trọn
// trong danh sách lướt, nên chân trang bỏ luôn dòng "Hiển thị 1–12 của 12 workspace" (thiếu
// `unit`) và ô chọn số dòng mỗi trang (thiếu `perPageOptions`) — hai thứ thừa khi số lượng
// hiển thị đã cố định bằng thiết kế. Một trang duy nhất → không vẽ gì (hideWhenSinglePage).

export function HomePreviewView({ scene }: UniverseHeroProps) {
  const session = usePreviewSession()
  const [range, setRange] = useState('30 ngày gần nhất')
  // Hai khung tự phân trang (đặc tả home) và lướt NGAY TRONG KHUNG: Workspaces để trọn 24
  // nút một trang (khung hé 4 hàng × 3 cột = 12, lướt xuống hết 24), Projects 10 dòng một
  // trang (khung hé 5 dòng). Số dòng hiển thị cố định bằng CSS nên không còn ô chọn.
  const [wsPage, setWsPage] = useState(1)
  const wsPerPage = 24
  const [prjPage, setPrjPage] = useState(1)
  const prjPerPage = 10
  const { state } = session

  // "Gần đây" là lời hứa về THỨ TỰ: sắp theo `updatedAt` rồi mới cắt trang, nên đổi
  // tên hay thêm thành viên cho một mục đưa nó lên đầu ngay. Trang vượt biên được kẹp lại bằng safePage.
  const wsSorted = state.workspaces.slice().sort(byNewestFirst)
  const wsPageCount = Math.max(1, Math.ceil(wsSorted.length / wsPerPage))
  const wsSafePage = Math.min(wsPage, wsPageCount)
  const workspacesShown = wsSorted.slice((wsSafePage - 1) * wsPerPage, wsSafePage * wsPerPage)

  const prjSorted = state.projects.slice().sort(byNewestFirst)
  const prjPageCount = Math.max(1, Math.ceil(prjSorted.length / prjPerPage))
  const prjSafePage = Math.min(prjPage, prjPageCount)
  const projectsShown = prjSorted.slice((prjSafePage - 1) * prjPerPage, prjSafePage * prjPerPage)

  const statusShare = projectStatusShareFor(state)
  const perWorkspace = projectsPerWorkspaceFor(state, 5)

  const openMenuForProject = (project: Project, origin: PreviewMenuOrigin) =>
    session.openMenu({ ...projectMenu(project), origin })

  return <PreviewShell active="home">
    <UniverseHero scene={scene} />

    <div className="home-overview">
      <Panel title="Activity Overview" className="panel-overview"
        action={<label className="range-select"><span className="visually-hidden">Time range</span>
          <select value={range} onChange={event => setRange(event.target.value)}>
            <option value="7 ngày gần nhất">7 ngày gần nhất</option>
            <option value="30 ngày gần nhất">30 ngày gần nhất</option>
            <option value="90 ngày gần nhất">90 ngày gần nhất</option>
          </select></label>}>
        <StatRow stats={homeOverviewStats(state)} />
      </Panel>

      <Panel title="Projects by Status">
        <StatusDonut total={statusShare.total} unit="projects"
          rows={statusShare.rows.map(row => ({ label: row.label, value: row.value }))} />
      </Panel>

      <Panel title="Projects per Workspace">
        <ProgressBar data={perWorkspace} />
      </Panel>
    </div>

    <Panel title="Workspace gần đây" action={<TextLink onClick={() => session.openSection('workspaces')}>View all</TextLink>}>
      <div className="mini-cards ws-tiles">
        {workspacesShown.map(workspace => <WorkspaceTile key={workspace.id} workspace={workspace} />)}
        {workspacesShown.length === 0 && <p className="panel-sub">{emptyFor('workspace')}</p>}
      </div>
      <Pagination label="Workspaces pagination" total={wsSorted.length} page={wsSafePage} perPage={wsPerPage} onPage={setWsPage} hideWhenSinglePage />
    </Panel>

    <Panel title="Projects gần đây">
      <div className="table-scroll home-table">
        <table className="preview-table">
          <thead><tr><th scope="col">#</th><th scope="col">Project</th><th scope="col">Workspace</th>
            <th scope="col">Status</th><th scope="col">Last Updated</th><th scope="col">Data File</th>
            <th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
          <tbody>{projectsShown.map((project, index) => {
            const target = { kind: 'project' as const, id: project.id, name: project.name }
            return <tr key={project.id}
              onClick={() => session.run('open', target)}
              onKeyDown={event => { if (event.target === event.currentTarget && event.key === 'Enter') session.run('open', target) }}
              onContextMenu={event => { event.preventDefault(); openMenuForProject(project, originFromEvent(event)) }}
              tabIndex={0}>
              {/* Cột # đánh số theo vị trí trong danh sách đã phân trang, nên sang trang vẫn 6-7-8… */}
              <td className="row-index">{(prjSafePage - 1) * prjPerPage + index + 1}</td>
              <th scope="row"><span className="row-name">{project.name}</span>
                <span className="row-sub">{project.description}</span></th>
              <td>{project.workspaceName}</td>
              <td><StatusBadge status={project.status} /></td>
              <td>{project.updatedAt}<span className="row-sub">bởi {project.owner.name}</span></td>
              <td>{project.dataset
                ? <span className="file-chip"><PreviewIcon name="file" />{project.dataset.fileName}</span>
                : <span className="row-sub">chưa có</span>}</td>
              <td className="row-action">
                <button type="button" className="icon-button row-menu" aria-label={`Thao tác với ${project.name}`} aria-haspopup="menu"
                  onClick={event => { event.stopPropagation(); openMenuForProject(project, { kind: 'anchor', element: event.currentTarget }) }}>
                  <PreviewIcon name="more" />
                </button>
              </td>
            </tr>
          })}</tbody>
        </table>
        {projectsShown.length === 0 && <p className="panel-sub">{emptyFor('project')}</p>}
      </div>
      <Pagination label="Projects pagination" total={prjSorted.length} page={prjSafePage} perPage={prjPerPage} onPage={setPrjPage} hideWhenSinglePage />
    </Panel>
  </PreviewShell>
}
