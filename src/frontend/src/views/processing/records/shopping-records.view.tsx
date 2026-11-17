import { Link, useParams } from 'react-router'
import { ShoppingTable } from '../../preview/components/shopping-demo-content'
import { PreviewShell } from '../../preview/components/preview-shell'
import { isShoppingDemo } from '../../../mocks/shopping-trends/demo-mode'
import { usePreviewSession } from '../../preview/preview-session-context'
export function ShoppingRecordsView() {
  const { projectId } = useParams()
  const session = usePreviewSession()
  if (!isShoppingDemo() || projectId !== 'shopping-trends' || !session.state.projects.some(p => p.id === projectId)) {
    return <PreviewShell active="projects" area="processing"><h1>Không tìm thấy dữ liệu project</h1></PreviewShell>
  }
  return <PreviewShell active="projects" area="processing">
    <Link to="/processing/projects/shopping-trends">← Về Project</Link>
    <h1 id="page-heading" tabIndex={-1}>Shopping Trends — toàn bộ dữ liệu</h1><ShoppingTable full />
  </PreviewShell>
}
