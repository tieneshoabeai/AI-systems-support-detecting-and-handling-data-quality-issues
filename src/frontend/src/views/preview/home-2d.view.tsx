import { useState } from 'react'
import type { PreviewMenuOrigin, Workspace } from '../../types/preview/preview.types'
import {
  byNewestFirst, homeOverviewStats, pluralEn,
  projectsOf, projectsPerWorkspaceFor, projectStatusShareFor,
} from './preview-data'
import { PreviewShell } from './components/preview-shell'
import { PreviewIcon } from './components/preview-icons'
import { ResourceAvatar } from './components/resource-avatar'
import { Pagination, Panel, ProgressBar, StatRow, StatusDonut, TextLink } from './components/preview-primitives'
import { usePreviewSession } from './preview-session-context'
import { workspaceMenu } from './preview-menu'
import { previewCardProps, stopCardBubble } from './preview-card'
import { UniverseHero } from './components/universe-hero'
import type { UniverseHeroProps } from './components/universe-hero'
import { RecentProjects } from './components/recent-projects'
export { UniverseHero } from './components/universe-hero'
export type { UniverseHeroProps } from './components/universe-hero'

// Trang Home theo UI-UX/home + Global Application Shell, nhưng toàn bộ số liệu và danh
// sách đọc từ mock store. ĐÚNG NĂM khối của ảnh — hero chào mừng, Activity Overview,
// Projects by Status, Projects per Workspace, Recent Workspaces, Recent Projects — không
// thêm panel "tiện ích" ngoài thiết kế. Quy tắc chuột (xem preview-card.ts):
//   · project  : 1 click = trang Project Workspace Overview (2 click cũng vậy — vào project là phải qua Overview)
//   · workspace: 1 click = xuống Workspaces với phạm vi của nó · 2 click = universe
//   · mọi dòng : chuột phải / phím Menu = menu thao tác

// Nhãn để tiếng Anh theo đặc tả ("các nhãn tiếng Anh, còn lại tiếng Việt"); nội dung mô tả
// vẫn tiếng Việt nhưng product noun giữ nguyên chữ Anh (workspace · project · dataset).

// Khung trống trên Home chỉ còn một nguyên nhân: ô tìm kiếm toàn cục ở topbar đã bỏ (chủ batch
// 03/11) nên hai danh sách ở đây không lọc theo từ khóa nữa — trống là vì dữ liệu mẫu trống.
const emptyFor = (unit: string): string => `Chưa có ${unit} nào.`


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
  // Workspaces phân trang trong khung; Projects giữ logic riêng trong RecentProjects.
  const [wsPage, setWsPage] = useState(1)
  const wsPerPage = 24
  const { state } = session

  // "Gần đây" là lời hứa về THỨ TỰ: sắp theo `updatedAt` rồi mới cắt trang, nên đổi
  // tên hay thêm thành viên cho một mục đưa nó lên đầu ngay. Trang vượt biên được kẹp lại bằng safePage.
  const wsSorted = state.workspaces.slice().sort(byNewestFirst)
  const wsPageCount = Math.max(1, Math.ceil(wsSorted.length / wsPerPage))
  const wsSafePage = Math.min(wsPage, wsPageCount)
  const workspacesShown = wsSorted.slice((wsSafePage - 1) * wsPerPage, wsSafePage * wsPerPage)
  const statusShare = projectStatusShareFor(state)
  const perWorkspace = projectsPerWorkspaceFor(state, 5)
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

    <RecentProjects />
  </PreviewShell>
}
