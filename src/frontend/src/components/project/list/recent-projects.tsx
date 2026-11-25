import { useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { PreviewMenuOrigin, Project } from '../../../types'
import { byNewestFirst } from '../../../hooks/workbench/workbench-presentation'
import { originFromEvent } from '../../../hooks/resource/resource-card'
import { projectMenu } from '../../../hooks/resource/resource-menu'
import { usePreviewSession } from '../../../hooks/workbench/workbench-session-context'
import { Icon as PreviewIcon } from '../../ui/primitives/icon'
import { Pagination, Panel, StatusBadge } from '../../resource'
import { ManagementLoadingContext, type ManagementLoading } from '../../../hooks/management/management-loading-context'
import { useManagementStore } from '../../../hooks/management/use-management-store'
import { recentProjectsPageSize, type RecentProject, type RecentProjectsPage } from '../../../services/processing/recent-projects.service'
import { DataRegionStatus } from '../../loading/data-region-status'
import { RecentProjectSkeletonRows } from '../../loading/page-skeleton'

// Both landing pages share sorting, pagination and project/menu navigation.
export function RecentProjects({ action, onOpenProject }: { action?: ReactNode; onOpenProject?: (id: string) => void }) {
  const session = usePreviewSession()
  const store = useManagementStore()
  const providerStatus = useContext(ManagementLoadingContext)
  const loadPage = onOpenProject ? store.listRecentProjects : undefined
  const getWorkspaceName = store.getRecentWorkspaceName
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const cursor = cursors[page - 1] ?? null
  const [response, setResponse] = useState<{
    loader: typeof loadPage; cursor: string | null; attempt: number; data?: RecentProjectsPage; error?: string
  } | null>(null)
  const current = response && response.loader === loadPage && response.cursor === cursor && response.attempt === attempt ? response : null
  useEffect(() => {
    if (!loadPage || providerStatus) return
    const controller = new AbortController()
    queueMicrotask(() => {
      if (controller.signal.aborted) return
      void loadPage(cursor, controller.signal).then(data => {
        if (controller.signal.aborted) return
        setResponse({ loader: loadPage, cursor, attempt, data })
        if (!getWorkspaceName) return
        const ids = new Set(data.items.flatMap(project =>
          project.workspaceId && !project.workspaceName ? [project.workspaceId] : []))
        for (const id of ids) {
          void getWorkspaceName(id).then(name => {
            if (!name || controller.signal.aborted) return
            setResponse(previous => {
              if (!previous?.data || previous.loader !== loadPage || previous.cursor !== cursor || previous.attempt !== attempt) return previous
              return { ...previous, data: { ...previous.data, items: previous.data.items.map(project =>
                project.workspaceId === id && !project.workspaceName ? { ...project, workspaceName: name } : project) } }
            })
          })
        }
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) setResponse({ loader: loadPage, cursor, attempt,
          error: error instanceof Error ? error.message : 'Không tải được danh sách project.' })
      })
    })
    return () => controller.abort()
  }, [loadPage, cursor, attempt, providerStatus, getWorkspaceName])

  const loading: ManagementLoading | null = providerStatus ?? (loadPage && !current?.data
    ? current?.error ? { phase: 'error', message: current.error, retry: () => setAttempt(value => value + 1) }
      : { phase: 'loading' }
    : null)
  const perPage = recentProjectsPageSize
  const sorted = session.state.projects.slice().sort(byNewestFirst)
  const safePage = loadPage ? page : Math.min(page, Math.max(1, Math.ceil(sorted.length / perPage)))
  const visible: (RecentProject & { selection?: Project })[] = loadPage ? current?.data?.items ?? []
    : sorted.slice((safePage - 1) * perPage, safePage * perPage).map(project => ({
      ...project, selection: project, ownerName: project.owner.name, hasDataset: project.dataset !== null,
      ...(project.dataset ? { fileName: project.dataset.fileName } : {}),
    }))
  const nextCursor = current?.data?.nextCursor
  const openMenu = (project: Project, origin: PreviewMenuOrigin) =>
    session.openMenu({ ...projectMenu(project), origin })

  return <Panel title="Projects gần đây" action={action}>
    <div className="table-scroll home-table">
      <table className="preview-table">
        <thead><tr><th scope="col">#</th><th scope="col">Project</th><th scope="col">Workspace</th>
          <th scope="col">Status</th><th scope="col">Last Updated</th><th scope="col">Data File</th>
          <th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
        <tbody>{loading ? <>
          <tr className={loading.phase === 'loading' ? 'visually-hidden' : undefined}><td colSpan={7}>
            <DataRegionStatus status={loading} label="Đang tải Projects gần đây">Đang tải Projects gần đây…</DataRegionStatus>
          </td></tr>
          {loading.phase === 'loading' && <RecentProjectSkeletonRows />}
        </> : visible.map((project, index) => {
          const selection = project.selection
          const target = { kind: 'project' as const, id: project.id, name: project.name }
          const open = () => onOpenProject ? onOpenProject(project.id) : session.run('open', target)
          return <tr key={project.id} tabIndex={0}
            onClick={open}
            onKeyDown={event => { if (event.target === event.currentTarget && event.key === 'Enter') open() }}
            onContextMenu={selection ? event => { event.preventDefault(); openMenu(selection, originFromEvent(event)) } : undefined}>
            <td className="row-index">{(safePage - 1) * perPage + index + 1}</td>
            <th scope="row"><span className="row-name">{project.name}</span><span className="row-sub">{project.description}</span></th>
            <td>{project.workspaceName ?? '—'}</td>
            <td><StatusBadge status={project.status} /></td>
            <td>{project.updatedAt ?? '—'}{project.ownerName && <span className="row-sub">bởi {project.ownerName}</span>}</td>
            <td>{project.fileName
              ? <span className="file-chip"><PreviewIcon name="file" />{project.fileName}</span>
              : <span className="row-sub">{project.hasDataset === false ? 'chưa có' : '—'}</span>}</td>
            <td className="row-action">
              {selection && <button type="button" className="icon-button row-menu" aria-label={`Thao tác với ${project.name}`} aria-haspopup="menu"
                onClick={event => { event.stopPropagation(); openMenu(selection, { kind: 'anchor', element: event.currentTarget }) }}>
                <PreviewIcon name="more" />
              </button>}
            </td>
          </tr>
        })}</tbody>
      </table>
      {!loading && visible.length === 0 && <p className="panel-sub">Chưa có project nào.</p>}
    </div>
    {loadPage ? (page > 1 || nextCursor) && <nav aria-label="Phân trang Projects gần đây" className="form-actions">
      <button type="button" className="button-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</button>
      <span>Trang {page}</span>
      <button type="button" className="button-secondary" disabled={!nextCursor || cursors.slice(0, page).includes(nextCursor)} onClick={() => {
        if (!nextCursor) return
        setCursors([...cursors.slice(0, page), nextCursor])
        setPage(page + 1)
      }}>Trang tiếp</button>
    </nav> : <Pagination label="Projects pagination" total={sorted.length} page={safePage} perPage={perPage} onPage={setPage} hideWhenSinglePage />}
  </Panel>
}
