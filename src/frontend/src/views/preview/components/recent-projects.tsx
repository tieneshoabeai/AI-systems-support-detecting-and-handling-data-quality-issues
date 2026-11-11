import { useState } from 'react'
import type { ReactNode } from 'react'
import type { PreviewMenuOrigin, Project } from '../../../types/preview/preview.types'
import { byNewestFirst } from '../preview-data'
import { originFromEvent } from '../preview-card'
import { projectMenu } from '../preview-menu'
import { usePreviewSession } from '../preview-session-context'
import { PreviewIcon } from './preview-icons'
import { Pagination, Panel, StatusBadge } from './preview-primitives'

// Both landing pages share sorting, pagination and project/menu navigation.
export function RecentProjects({ action }: { action?: ReactNode }) {
  const session = usePreviewSession()
  const [page, setPage] = useState(1)
  const perPage = 10
  const sorted = session.state.projects.slice().sort(byNewestFirst)
  const safePage = Math.min(page, Math.max(1, Math.ceil(sorted.length / perPage)))
  const visible = sorted.slice((safePage - 1) * perPage, safePage * perPage)
  const openMenu = (project: Project, origin: PreviewMenuOrigin) =>
    session.openMenu({ ...projectMenu(project), origin })

  return <Panel title="Projects gần đây" action={action}>
    <div className="table-scroll home-table">
      <table className="preview-table">
        <thead><tr><th scope="col">#</th><th scope="col">Project</th><th scope="col">Workspace</th>
          <th scope="col">Status</th><th scope="col">Last Updated</th><th scope="col">Data File</th>
          <th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
        <tbody>{visible.map((project, index) => {
          const target = { kind: 'project' as const, id: project.id, name: project.name }
          return <tr key={project.id} tabIndex={0}
            onClick={() => session.run('open', target)}
            onKeyDown={event => { if (event.target === event.currentTarget && event.key === 'Enter') session.run('open', target) }}
            onContextMenu={event => { event.preventDefault(); openMenu(project, originFromEvent(event)) }}>
            <td className="row-index">{(safePage - 1) * perPage + index + 1}</td>
            <th scope="row"><span className="row-name">{project.name}</span><span className="row-sub">{project.description}</span></th>
            <td>{project.workspaceName}</td>
            <td><StatusBadge status={project.status} /></td>
            <td>{project.updatedAt}<span className="row-sub">bởi {project.owner.name}</span></td>
            <td>{project.dataset
              ? <span className="file-chip"><PreviewIcon name="file" />{project.dataset.fileName}</span>
              : <span className="row-sub">chưa có</span>}</td>
            <td className="row-action">
              <button type="button" className="icon-button row-menu" aria-label={`Thao tác với ${project.name}`} aria-haspopup="menu"
                onClick={event => { event.stopPropagation(); openMenu(project, { kind: 'anchor', element: event.currentTarget }) }}>
                <PreviewIcon name="more" />
              </button>
            </td>
          </tr>
        })}</tbody>
      </table>
      {visible.length === 0 && <p className="panel-sub">Chưa có project nào.</p>}
    </div>
    <Pagination label="Projects pagination" total={sorted.length} page={safePage} perPage={perPage} onPage={setPage} hideWhenSinglePage />
  </Panel>
}
