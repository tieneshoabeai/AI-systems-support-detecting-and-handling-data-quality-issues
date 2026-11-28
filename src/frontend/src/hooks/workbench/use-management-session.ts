import { useCallback, useEffect, useRef, useState } from 'react'
import type { PreviewAppearance, PreviewSectionNavigator, PreviewSessionModel } from '../../types'
import type {
  NewReportInput, NotificationPrefKey, Person, PreviewActionId, PreviewDialogRequest, PreviewInfoRequest, PreviewMenuOrigin,
  PreviewMenuRequest, PreviewMutationResult, PreviewProjectPanel, PreviewProjectWizard, PreviewWorkspacePanel,
  NewProjectInput, PreviewSectionId, PreviewTarget, PreviewToast, PreviewToastTone, ProfileEdit, ProjectStatus,
  WorkspaceEdit, WorkspaceStatus,
} from '../../types/management/management.types'
import { useManagementStore } from '../management/use-management-store'
import { previewHref, previewNavigateEvent } from '../../services/navigation/legacy-workbench-route'
import type { PreviewRouteIds } from '../../types'
import { usePreviewStore } from '../management/use-management-store'

// Flow của frame preview: một chỗ duy nhất quyết định "bấm vào thì hệ thống làm gì".
// Menu ngữ cảnh, nút ⋯, dropdown "Thao tác ▾" và các nút trong panel chi tiết đều gọi
// vào đây, nên ba lối vào chuột không thành ba bộ hành vi lệch nhau (apple-design mục 7:
// spatial consistency — cùng một lệnh, bất kể đi từ đâu).
//
// Hook này không render gì cả; preview-session.tsx ghép nó với các primitive.

const toastLifetimeMs = 6000
const shortToastLifetimeMs = 3200

const statusLabels: Record<ProjectStatus | WorkspaceStatus, string> = {
  active: 'Đang hoạt động', paused: 'Tạm dừng', processing: 'Đang xử lý',
  completed: 'Đã hoàn thành', archived: 'Đã lưu trữ',
}

export const usePreviewSessionModel = (
  routeIds: PreviewRouteIds,
  appearance: PreviewAppearance,
  navigateSection?: PreviewSectionNavigator,
): PreviewSessionModel => {
  const store = useManagementStore()
  const [menu, setMenu] = useState<PreviewMenuRequest | null>(null)
  const [dialog, setDialog] = useState<PreviewDialogRequest | null>(null)
  const [info, setInfo] = useState<PreviewInfoRequest | null>(null)
  const [workspacePanel, setWorkspacePanel] = useState<PreviewWorkspacePanel | null>(null)
  const [projectPanel, setProjectPanel] = useState<PreviewProjectPanel | null>(null)
  const [projectWizard, setProjectWizard] = useState<PreviewProjectWizard | null>(null)
  const [toasts, setToasts] = useState<PreviewToast[]>([])
  // state lấy qua hook để mọi thẻ/panel/topbar cùng dựng lại khi mock store đổi;
  // gọi thẳng getState() trong render sẽ trả về snapshot cũ và giao diện "không nhận" thao tác.
  const state = usePreviewStore()
  const toastTimers = useRef(new Map<string, number>())
  const toastSeq = useRef(0)
  // Nơi focus đang đứng trước khi menu mở — đóng menu phải trả về đúng chỗ cũ,
  // nếu không người dùng bàn phím mất vị trí sau mỗi lần Esc.
  const returnFocusRef = useRef<HTMLElement | null>(null)
  // Origin của menu đang mở, giữ ở ref chứ không đọc `menu` trong `run`: `run` đóng menu ngay
  // dòng đầu nên state đã là null lúc nó cần biết thẻ "Xem thông tin" phải mọc ra từ đâu.
  // Ref cũng tránh đưa `menu` vào dependency — mỗi lần mở/đóng menu sẽ khai sinh lại `run`.
  const menuOriginRef = useRef<PreviewMenuOrigin | null>(null)

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimers.current.get(id)
    if (timer !== undefined) { window.clearTimeout(timer); toastTimers.current.delete(id) }
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  const pushToast = useCallback((text: string, tone: PreviewToastTone, onUndo?: () => boolean | void) => {
    const id = `tst-${++toastSeq.current}`
    setToasts(current => [...current.slice(-2), { id, text, tone, ...(onUndo ? { undoLabel: 'Hoàn tác', onUndo } : {}) }])
    toastTimers.current.set(id, window.setTimeout(() => dismissToast(id), onUndo ? toastLifetimeMs : shortToastLifetimeMs))
  }, [dismissToast])

  useEffect(() => {
    const timers = toastTimers.current
    return () => { timers.forEach(timer => window.clearTimeout(timer)); timers.clear() }
  }, [])

  // Resource IDs from the route restore context on reload. An explicit empty workspace
  // scope means the all-projects list; routes without scope keep the current selection.
  const { workspaceId: routeWorkspaceId, projectId: routeProjectId } = routeIds
  useEffect(() => {
    if (navigateSection && routeWorkspaceId === '' && !routeProjectId) store.selectWorkspace('')
    if (routeWorkspaceId) store.selectWorkspace(routeWorkspaceId)
    if (routeProjectId) store.selectProject(routeProjectId)
  }, [routeWorkspaceId, routeProjectId, navigateSection, store])

  const closeMenu = useCallback(() => {
    setMenu(null)
    const anchor = returnFocusRef.current
    returnFocusRef.current = null
    if (anchor?.isConnected) anchor.focus()
  }, [])

  const openMenu = useCallback((request: PreviewMenuRequest) => {
    returnFocusRef.current = request.origin.kind === 'anchor' ? request.origin.element : document.activeElement as HTMLElement | null
    menuOriginRef.current = request.origin
    // Thẻ tóm tắt đang bay theo con trỏ mà để menu đè lên là hai surface cùng lúc cho một
    // hành động — đóng thẻ khi mở menu.
    setInfo(null)
    setMenu(request)
  }, [])

  const openInfo = useCallback((request: PreviewInfoRequest) => setInfo(request), [])
  const closeInfo = useCallback(() => setInfo(null), [])

  const openSection = useCallback((section: PreviewSectionId, ids: PreviewRouteIds = {}) => {
    const href = previewHref(section, ids)
    if (navigateSection) navigateSection(href)
    else if (`${window.location.pathname}${window.location.search}` !== href || window.location.hash) {
      window.history.pushState(null, '', href)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
    // Kể cả khi hash không đổi (người dùng đã đứng ở đích), đây vẫn là một chuyến ĐI: surface
    // nổi nghe tín hiệu này để khép lại. Thiếu nó thì bấm "Mở Project" của chính project đang
    // mở sẽ để popover thông báo treo nguyên trên trang vừa mở.
    window.dispatchEvent(new Event(previewNavigateEvent))
  }, [navigateSection])

  // Kết quả mutation luôn kèm Hoàn tác: mock store chỉ sửa bộ nhớ tab nên người review
  // phải rút lại được ngay mà không phải tải lại trang (shared-ui: không khóa người dùng).
  const applyMutation = useCallback((operation: Promise<PreviewMutationResult>, onError?: (message: string) => void) => {
    return operation
      .then(result => {
        if (result.queued) {
          pushToast(result.message, 'info')
          return true
        }
        const undoAction = (): boolean => {
          try {
            result.undo()
            pushToast('Đã hoàn tác thao tác vừa rồi.', 'info')
            return true
          } catch (error) {
            // Giữ nút Hoàn tác để có thể thử lại sau khi hoàn tác thay đổi mới hơn.
            setToasts(current => current.map(toast => toast.onUndo === undoAction
              ? { ...toast, tone: 'danger', text: error instanceof Error ? error.message : 'Không thể hoàn tác thao tác này.' }
              : toast))
            return false
          }
        }
        pushToast(result.message, 'success', result.persisted ? undefined : undoAction)
        return true
      })
      .catch(error => {
        const message = error instanceof Error ? error.message : 'Không thể thực hiện thao tác. Vui lòng thử lại.'
        if (onError) onError(message)
        else pushToast(message, 'danger')
        return false
      })
  }, [pushToast])

  const run = useCallback((action: PreviewActionId, target: PreviewTarget) => {
    closeMenu()
    const current = store.getState()
    switch (action) {
      case 'detail':
        // 1 click = chọn để xem chi tiết, không đổi trang: panel chi tiết nằm kế bên thẻ.
        if (target.kind === 'workspace') store.selectWorkspace(target.id)
        else store.selectProject(target.id)
        break
      case 'open':
        if (target.kind === 'workspace') {
          store.selectWorkspace(target.id)
          // "Truy cập gần nhất" là ô sắp xếp mặc định của trang Workspaces (ảnh khung 6), nên
          // mốc truy cập phải được ghi khi NGƯỜI DÙNG thật mở — nếu không ô đó chỉ là bản
          // sao của "Cập nhật gần nhất" và bộ lọc thứ ba trong ảnh là đồ giả.
          store.touchWorkspace(target.id)
          openSection('workspaces', { workspaceId: target.id })
        } else {
          const project = current.projects.find(item => item.id === target.id)
          if (!project) { pushToast('Project không còn tồn tại.', 'info'); break }
          store.selectProject(target.id)
          openSection('projects', { workspaceId: project.workspaceId, projectId: project.id })
        }
        break
      case 'ws-info':
      case 'ws-members':
        // Hai modal của workspace (ảnh workspaces detail): mở từ ⋯ của THẺ ở trang danh sách lẫn
        // từ ⋯ trong header trang chi tiết, nên surface nằm ở cấp phiên (preview-session render),
        // ở đây chỉ ghi id + mặt nào. Modal đang mở thì khép lại: scrim của modal mới mà đè lên
        // scrim modal cũ là hai lớp tối chồng nhau.
        setDialog(null)
        setProjectPanel(null)
        setWorkspacePanel({ workspaceId: target.id, panel: action === 'ws-info' ? 'info' : 'members' })
        break
      case 'pj-members':
        // Mục "Quản lý thành viên" trong ⋯ của dataset (ảnh Actions panel 3) — mở panel thành viên
        // của project. Surface cấp phiên vì ⋯ đó nằm trong trang Project, còn roster thì panel tự
        // tra lại từ store theo id.
        setDialog(null)
        setWorkspacePanel(null)
        setProjectPanel({ projectId: target.id })
        break
      case 'info':
        // Bấm "Xem thông tin": menu đóng nên item bay đi, thẻ chuyển sang neo vào đúng nơi menu
        // mọc ra (nút ⋯ hoặc con trỏ) và Ở LẠI. Hover thì thẻ đã mở sẵn cạnh item (bên ngoài
        // nhánh này, do preview-session truyền xuống menu); click là lối vào của bàn phím.
        if (menuOriginRef.current !== null) setInfo({ projectId: target.id, origin: menuOriginRef.current, side: 'bottom' })
        break
      case 'favorite':
      case 'unfavorite':
        void applyMutation(store.toggleFavorite(target.id))
        break
      case 'rename':
        setDialog({ mode: 'rename', target, currentName: target.name })
        break
      case 'remove':
        setWorkspacePanel(null)
        setProjectPanel(null)
        setDialog({
          mode: 'remove',
          target,
          detail: current.source !== 'api'
            ? target.kind === 'workspace'
              ? `Workspace là ranh giới truy cập: gỡ khỏi danh sách mẫu sẽ kéo theo ${current.projects.filter(item => item.workspaceId === target.id).length} project của nó. Thao tác chỉ sửa bộ nhớ tab và có Hoàn tác.`
              : 'Xóa chỉ gỡ bản ghi khỏi danh sách mẫu trong bộ nhớ tab và có Hoàn tác.'
            : target.kind === 'workspace'
            ? `Workspace là ranh giới truy cập: xóa workspace sẽ kéo theo ${current.projects.filter(item => item.workspaceId === target.id).length} project của nó. Thao tác xóa dữ liệu trên máy chủ không có hoàn tác trong giao diện.`
            : 'Project sẽ bị xóa. Bạn không thể hoàn tác trong giao diện.',
        })
        break
    }
  }, [applyMutation, closeMenu, openSection, pushToast, store])

  const notify = useCallback((text: string, tone: PreviewToastTone = 'info') => pushToast(text, tone), [pushToast])

  const submitRename = useCallback(async (name: string) => {
    if (dialog?.mode !== 'rename') return
    const trimmed = name.trim()
    if (!trimmed) { pushToast('Tên để trống không được chấp nhận.', 'danger'); return }
    await applyMutation(store.rename(dialog.target.kind, dialog.target.id, trimmed)).then(ok => { if (ok) setDialog(null) })
  }, [applyMutation, dialog, pushToast, store])

  const confirmRemove = useCallback(async () => {
    if (dialog?.mode !== 'remove') return
    await applyMutation(store.remove(dialog.target.kind, dialog.target.id)).then(ok => { if (ok) setDialog(null) })
  }, [applyMutation, dialog, store])

  return {
    appearance,
    state,
    toasts,
    menu,
    dialog,
    info,
    workspacePanel,
    unreadNotifications: state.source === 'api' && Number.isInteger(state.unreadNotificationCount)
      ? state.unreadNotificationCount as number
      : state.notifications.filter(item => item.unread).length,
    openMenu,
    closeMenu,
    closeDialog: () => setDialog(null),
    openInfo,
    closeInfo,
    closeWorkspacePanel: () => setWorkspacePanel(null),
    run,
    notify,
    submitRename,
    confirmRemove,
    // Modal "Thông tin Workspace": lưu tên + mô tả qua MỘT mutation (Hoàn tác trả cả hai), rồi
    // KHÉP modal lại. Surface nằm ở cấp phiên nên việc đóng cũng thuộc đây, không thuộc form:
    // để modal ở lại sau khi "Lưu thay đổi" là người dùng bấm nút xong vẫn đứng trong màn hình
    // mà họ vừa nói là đã gửi, và form thì đã đổi dữ liệu dưới chân nó.
    updateWorkspace: async (id: string, edit: WorkspaceEdit) => {
      await applyMutation(store.updateWorkspace(id, edit)).then(ok => { if (ok) setWorkspacePanel(null) })
    },
    addWorkspaceMember: (workspaceId: string, person: Person) => {
      void applyMutation(store.addWorkspaceMember({ workspaceId, person }))
    },
    setWorkspaceMemberRole: (workspaceId: string, personId: string, role: string) => {
      void applyMutation(store.setWorkspaceMemberRole(workspaceId, personId, role))
    },
    removeWorkspaceMember: (workspaceId: string, personId: string) => {
      void applyMutation(store.removeWorkspaceMember(workspaceId, personId))
    },
    projectPanel,
    closeProjectPanel: () => setProjectPanel(null),
    addProjectMember: (projectId: string, person: Person, role: string) => {
      void applyMutation(store.addProjectMember({ projectId, person, role }))
    },
    setProjectMemberRole: (projectId: string, personId: string, role: string) => {
      void applyMutation(store.setProjectMemberRole(projectId, personId, role))
    },
    removeProjectMember: (projectId: string, personId: string) => {
      void applyMutation(store.removeProjectMember(projectId, personId))
    },
    projectWizard,
    // Mở wizard ở CẤP PHIÊN nên nó sống sót khi đổi trang — và vì thế nó cũng phải khép lại khi
    // người dùng đi chỗ khác (openSection đã phát previewNavigateEvent, surface nghe tín hiệu đó).
    openProjectWizard: (workspaceId?: string | null) => {
      if (workspaceId && state.workspaces.find(w => w.id === workspaceId)?.canManage === false) { notify('Chỉ Workspace Owner được tạo project.', 'danger'); return }
      if (state.source === 'api' && !state.workspaces.some(w => w.canManage)) { notify('Bạn cần sở hữu workspace để tạo project.', 'info'); return }
      setProjectWizard({ workspaceId: workspaceId ?? null })
    },
    closeProjectWizard: () => setProjectWizard(null),
    selectWorkspace: store.selectWorkspace,
    selectProject: store.selectProject,
    clearProject: store.clearProject,
    openSection,
    readAllNotifications: () => { void applyMutation(store.markAllNotificationsRead()) },
    markNotificationsRead: (ids: readonly string[]) => { void applyMutation(store.markNotificationsRead(ids)) },
    deleteNotifications: (ids: readonly string[]) => { void applyMutation(store.removeNotifications(ids)) },
    createReport: (input: NewReportInput) => applyMutation(store.createReport(input)),
    createProject: (input: NewProjectInput, onError?: (message: string) => void) => applyMutation(store.createProject(input), onError),
    createWorkspace: (input, onError, onCreated) => applyMutation(store.createWorkspace(input).then(result => {
      if (result.workspaceId) onCreated?.(result.workspaceId)
      return result
    }), onError),
    updateProfile: (edit: ProfileEdit) => applyMutation(store.updateProfile(edit)),
    revokeSession: (id: string) => { void applyMutation(store.revokeSession(id)) },
    revokeAllSessions: () => {
      // Không còn phiên nào khác ngoài phiên hiện tại → đây là no-op, KHÔNG bật mutation
      // (mutation luôn kèm "Hoàn tác", mà hoàn tác một lần không thay đổi gì rồi báo "Đã hoàn
      // tác" là nói dối). Chỉ notify ngắn, cùng vùng thông báo, không thêm live region.
      const others = store.getState().sessions.filter(item => !item.current).length
      if (others === 0) { notify('Chỉ còn phiên hiện tại — không có phiên nào khác để đăng xuất.', 'info'); return }
      void applyMutation(store.revokeOtherSessions())
    },
    setNotificationPref: (key: NotificationPrefKey, value: boolean) => { void applyMutation(store.setNotificationPref(key, value)) },
    dismissToast,
  }
}

export { statusLabels }
