import { useContext, useEffect, useState } from 'react'
import type { PreviewMenuOrigin, Workspace } from '../../../types'
import { useManagementStore } from '../../../hooks/management/use-management-store'
import type { WorkspaceOverview } from '../../../services/management/management.types'
import { byNewestFirst, homeOverviewStats, pluralEn, projectsOf, projectsPerWorkspaceFor, projectStatusShareFor } from '../../../hooks/workbench/workbench-presentation'
import { PreviewShell } from '../../application/components/workbench-shell'
import { Icon as PreviewIcon } from '../../../components/ui/primitives/icon'
import { ResourceAvatar } from '../../../components/resource/avatar/resource-avatar'
import { Pagination, Panel, ProgressBar, StatCard, StatusDonut, TextLink } from '../../../components/resource/presentation/resource-presentation'
import { ManagementLoadingContext, ManagementOverviewLoaderContext } from '../../../hooks/management/management-loading-context'
import { DataRegionStatus } from '../../../components/loading/data-region-status'
import { Skeleton } from '../../../components/ui/feedback/skeleton'
import { usePreviewSession } from '../../../hooks/workbench/workbench-session-context'
import { workspaceMenu } from '../../../hooks/resource/resource-menu'
import { previewCardProps, stopCardBubble } from '../../../hooks/resource/resource-card'
import { UniverseHero } from '../../../components/project/list/universe-hero'
import type { UniverseHeroProps } from '../../../components/project/list/universe-hero'
import { RecentProjects } from '../../../components/project/list/recent-projects'
export { UniverseHero } from '../../../components/project/list/universe-hero'
export type { UniverseHeroProps } from '../../../components/project/list/universe-hero'

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
  const store = useManagementStore()
  const coreStatus = useContext(ManagementLoadingContext)
  const overviewLoader = useContext(ManagementOverviewLoaderContext) ?? (coreStatus ? undefined : store.getWorkspaceOverview)
  const [range, setRange] = useState('30 ngày gần nhất')
  const [overviewResult, setOverviewResult] = useState<{
    loader: NonNullable<typeof overviewLoader>
    data?: WorkspaceOverview
    error?: string
  } | null>(null)
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
  useEffect(() => {
    if (state.source !== 'api' || !overviewLoader) return
    let active = true
    void overviewLoader().then(overview => {
      if (active) setOverviewResult({ loader: overviewLoader, data: overview })
    }).catch((error: unknown) => {
      if (active) setOverviewResult({ loader: overviewLoader, error: error instanceof Error ? error.message : 'Không tải được tổng quan workspace.' })
    })
    return () => { active = false }
  }, [state.source, state.workspaces, state.projects, overviewLoader])
  const currentOverview = state.source === 'api' && overviewResult?.loader === overviewLoader ? overviewResult : null
  const activeOverview = currentOverview?.data
  const overviewError = currentOverview?.error ?? ''
  const overviewPending = state.source === 'api' && Boolean(overviewLoader) && !activeOverview && !overviewError
  const overviewStats = homeOverviewStats(state).map(stat => {
    if (!activeOverview) return stat
    if (stat.id === 'ov-ws') return { ...stat, value: String(activeOverview.totalWorkspaces) }
    if (stat.id === 'ov-prj') return { ...stat, value: String(activeOverview.totalProjects) }
    return stat
  })
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
        <div className="stat-row" aria-busy={overviewPending || coreStatus?.phase === 'loading'}>
          {overviewStats.map(stat => {
            const usesOverview = stat.id === 'ov-ws' || stat.id === 'ov-prj'
            if (usesOverview && activeOverview) return <StatCard key={stat.id} stat={stat} />
            if ((usesOverview && overviewPending) || coreStatus?.phase === 'loading') {
              return <Skeleton key={stat.id} className="skeleton-home-stat" />
            }
            return coreStatus ? null : <StatCard key={stat.id} stat={stat} />
          })}
        </div>
        {coreStatus?.phase === 'error' && <DataRegionStatus status={coreStatus} label="Tổng quan hoạt động">{null}</DataRegionStatus>}
        {!coreStatus && state.source === 'api' && overviewError !== '' && <p className="panel-sub" role="status">{overviewError} Đang hiển thị số liệu từ danh sách đã tải.</p>}
      </Panel>

      <Panel title="Projects by Status">
        {coreStatus ? <DataRegionStatus status={coreStatus} label="Đang tải trạng thái Project">
          <Skeleton className="skeleton-home-chart" />
        </DataRegionStatus> : <StatusDonut total={statusShare.total} unit="projects"
          rows={statusShare.rows.map(row => ({ label: row.label, value: row.value }))} />}
      </Panel>

      <Panel title="Projects per Workspace">
        {coreStatus ? <DataRegionStatus status={coreStatus} label="Đang tải Project theo Workspace">
          <Skeleton className="skeleton-home-chart" />
        </DataRegionStatus> : <ProgressBar data={perWorkspace} />}
      </Panel>
    </div>

    <Panel title="Workspace gần đây" action={<TextLink onClick={() => session.openSection('workspaces')}>View all</TextLink>}>
      {coreStatus ? <DataRegionStatus status={coreStatus} label="Đang tải Workspace gần đây">
        <div className="skeleton-home-workspaces"><Skeleton /><Skeleton /><Skeleton /></div>
      </DataRegionStatus> : <>
        <div className="mini-cards ws-tiles">
          {workspacesShown.map(workspace => <WorkspaceTile key={workspace.id} workspace={workspace} />)}
          {workspacesShown.length === 0 && <p className="panel-sub">{emptyFor('workspace')}</p>}
        </div>
        <Pagination label="Workspaces pagination" total={wsSorted.length} page={wsSafePage} perPage={wsPerPage} onPage={setWsPage} hideWhenSinglePage />
      </>}
    </Panel>

    <RecentProjects />
  </PreviewShell>
}
