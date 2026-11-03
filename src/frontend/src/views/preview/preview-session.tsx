import type { ReactNode } from 'react'
import type { PreviewRouteIds } from '../../services/preview/preview-route'
import type { PreviewUniverseNavigator } from '../../hooks/preview/use-preview-session'
import { usePreviewSessionModel } from '../../hooks/preview/use-preview-session'
import { PreviewSessionContext } from './preview-session-context'
import { PreviewContextMenu } from './components/preview-context-menu'
import { PreviewRenameDialog, PreviewRemoveDialog } from './components/preview-dialog'
import { PreviewToaster } from './components/preview-toaster'
import { ProjectInfoCard } from './components/project-info-card'
import { ProjectPanelSurface } from './components/project-members-dialog'
import { ProjectWizard } from './components/project-wizard'
import { WorkspacePanelSurface } from './components/workspace-detail-dialogs'

// Bọc flow (hooks/preview/use-preview-session.ts) với các surface nổi rồi phát xuống cây
// qua context. Đây là component composition nên nằm ở tầng view; logic thao tác vẫn
// nằm trong hook, còn primitive thì chỉ render + gọi callback đúng như shared-ui yêu cầu.
//
// Nhờ một provider cho cả frame mà menu/popover/dialog/toast là surface DUY NHẤT:
// ba trang Home · Workspaces · Projects không mỗi trang một bộ trùng nhau.
//
// Context + usePreviewSession tách sang preview-session-context.ts: file này chỉ export
// component để Fast Refresh còn hoạt động (react-refresh/only-export-components).

export function PreviewSessionProvider({ routeIds, navigateUniverse, children }: {
  routeIds: PreviewRouteIds
  navigateUniverse?: PreviewUniverseNavigator
  children: ReactNode
}) {
  const model = usePreviewSessionModel(routeIds, navigateUniverse)
  const rename = model.dialog?.mode === 'rename' ? model.dialog : null
  const remove = model.dialog?.mode === 'remove' ? model.dialog : null

  return <PreviewSessionContext.Provider value={model}>
    {children}
    <PreviewContextMenu request={model.menu} onRun={model.run} onClose={model.closeMenu}
      onInfoHover={(projectId, element) => model.openInfo({ projectId, origin: { kind: 'anchor', element }, side: 'right' })}
      onInfoLeave={model.closeInfo} />
    {/* Thẻ tóm tắt project: đặc tả Home chốt nó chỉ tồn tại lúc con trỏ lia trên mục "Xem thông
       tin" trong ⋯, nên menu (surface cha) là nơi duy nhất phát tín hiệu hover. Nó cũng là
       surface độc quyền của frame — không trang nào tự giữ bản riêng. */}
    <ProjectInfoCard request={model.info} projects={model.state.projects} onClose={model.closeInfo} />
    <PreviewRenameDialog request={rename} onSubmit={model.submitRename} onCancel={model.closeDialog} />
    <PreviewRemoveDialog request={remove} onConfirm={model.confirmRemove} onCancel={model.closeDialog} />
    {/* Hai modal của workspace ("Thông tin Workspace" · "Quản lý thành viên") cũng là surface cấp
       phiên vì ⋯ của THẺ mở ra chúng — xem WorkspacePanelSurface. */}
    <WorkspacePanelSurface panel={model.workspacePanel} workspaces={model.state.workspaces}
      projects={model.state.projects} onClose={model.closeWorkspacePanel}
      onSave={model.updateWorkspace} onAddMember={model.addWorkspaceMember}
      onChangeMemberRole={model.setWorkspaceMemberRole} onRemoveMember={model.removeWorkspaceMember} />
    {/* Panel "Quản lý thành viên" của project (⋯ của thẻ dataset) và wizard "Tạo Project" cũng là
       surface cấp phiên: hai lối vào của wizard ở hai trang khác nhau, còn panel thì mở từ trong
       trang Project — mỗi trang tự giữ một bản là hai bộ hành vi lệch nhau. */}
    <ProjectPanelSurface panel={model.projectPanel} projects={model.state.projects}
      workspaces={model.state.workspaces} onClose={model.closeProjectPanel} />
    {model.projectWizard !== null && <ProjectWizard
      initialWorkspaceId={model.projectWizard.workspaceId} onClose={model.closeProjectWizard} />}
    <PreviewToaster toasts={model.toasts} onDismiss={model.dismissToast} />
  </PreviewSessionContext.Provider>
}
