import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { PreviewRoute } from '../../types/preview/preview-route.types'
import { normalizePreviewHash, readPreviewRoute } from './preview-url'
import { PreviewSessionProvider } from './preview-session'
import { HomePreviewView } from './home-2d.view'
import { WorkspacesPreviewView } from './workspaces-2d.view'
import { ProjectsPreviewView } from './projects-2d.view'
import { ProjectWorkspaceView } from './project-workspace-2d.view'
import { NotificationsPreviewView } from './notifications-2d.view'
import { SettingsPreviewView } from './settings-2d.view'
import './preview.css'
import './preview-theme.css'

// Chỉ app/main.tsx nạp file này khi import.meta.env.DEV và URL thuộc nhóm preview 2D,
// nên fixture + dark CSS không vào production bundle. App thật không import nó.

// Quy tắc route nằm ở services/preview/preview-route.ts (preview-url.ts chỉ re-export)
// để main.tsx, shell và session hook cùng dùng một bản, đúng chiều View → Hook → Service.

// '#/preview/workspaces/ws-acme/prj-sales' → cả ba trang đọc chung một phạm vi.
const readRoute = (): PreviewRoute => {
  const route = readPreviewRoute()
  return { ...route, workspaceId: route.workspaceId ?? null, projectId: route.projectId ?? null, notificationId: route.notificationId ?? null, settingsSection: route.settingsSection ?? null }
}

export function Preview2DEntry() {
  const [route, setRoute] = useState<PreviewRoute>(readRoute)

  useEffect(() => {
    const sync = () => {
      // URL phải khớp nội dung trước khi màn hình kịp vẽ (xem normalizePreviewHash).
      normalizePreviewHash()
      setRoute(readRoute())
    }
    sync()
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  // Provider bọc CẢ frame nên menu ngữ cảnh, popover, dialog và toast là surface duy
  // nhất cho ba trang — không trang nào tự dựng một bộ riêng rồi lệch hành vi.
  return <PreviewSessionProvider routeIds={route}>
      {renderSection(route)}
    </PreviewSessionProvider>
}

// Màn Thông báo dùng một URL cho cả hai trạng thái: không có id → danh sách, có id →
// chi tiết. Nhấn Quay lại của trình duyệt vì thế về đúng danh sách thay vì phải dựng một
// route 'danh sách' riêng. Màn Settings cũng dùng một URL cho cả nhánh Accounts: segment
// sau nó là mục con; null → tổng quan với các module thu gọn.
function renderSection(route: PreviewRoute): ReactNode {
  // Workspaces là màn hai tầng: route không có id → danh sách thẻ; có id → trang dashboard
  // chi tiết của chính workspace đó (Design Board "workspaces detail").
  if (route.section === 'workspaces') return <WorkspacesPreviewView workspaceId={route.workspaceId} />
  // Projects là màn hai tầng (như workspaces): không có id → danh sách thẻ; có id → trang
  // Project Workspace Overview của riêng project đó (UI-UX/projects · Overview_v1, bản 2D).
  if (route.section === 'projects') return route.projectId
    ? <ProjectWorkspaceView key={route.projectId} projectId={route.projectId} />
    : <ProjectsPreviewView />
  if (route.section === 'notifications') return <NotificationsPreviewView notificationId={route.notificationId} />
  if (route.section === 'settings') return <SettingsPreviewView key={route.settingsSection ?? 'overview'} section={route.settingsSection} />
  return <HomePreviewView />
}
