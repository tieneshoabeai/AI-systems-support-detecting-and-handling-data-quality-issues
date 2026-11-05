import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  NewReportInput, NotificationPrefKey, Person, PreviewActionId, PreviewDialogRequest, PreviewInfoRequest, PreviewMenuOrigin,
  PreviewMenuRequest, PreviewMutationResult, PreviewProjectPanel, PreviewProjectWizard, PreviewWorkspacePanel,
  NewProjectInput, PreviewSectionId, PreviewStoreState, PreviewTarget, PreviewToast, PreviewToastTone, ProfileEdit, ProjectStatus,
  WorkspaceEdit, WorkspaceStatus, NewWorkspaceInput,
} from '../../types/preview/preview.types'
import { previewMockStore } from '../../services/preview/preview-mock.service'
import { previewHref, previewNavigateEvent, universeUrl } from '../../services/preview/preview-route'
import type { PreviewRouteIds } from '../../services/preview/preview-route'
import { usePreviewStore } from './use-preview-store'

// Flow của frame preview: một chỗ duy nhất quyết định "bấm vào thì hệ thống làm gì".
// Menu ngữ cảnh, nút ⋯, dropdown "Thao tác ▾" và các nút trong panel chi tiết đều gọi
// vào đây, nên ba lối vào chuột không thành ba bộ hành vi lệch nhau (apple-design mục 7:
// spatial consistency — cùng một lệnh, bất kể đi từ đâu).
//
// Hook này không render gì cả; preview-session.tsx ghép nó với các primitive.
// Mọi ghi dữ liệu đi qua previewMockStore (tầng service) — view/hook không tự sửa mảng.

const toastLifetimeMs = 6000
const shortToastLifetimeMs = 3200

export type PreviewUniverseNavigator = (url: string) => void

// Trang 3D của T là một lần tải trang thật. Trong test jsdom không có navigation,
// nên để lối đi này inject được: preview-entry truyền default (window.location.assign),
// test truyền spy.
const defaultUniverseNavigator: PreviewUniverseNavigator = url => { window.location.assign(url) }

const statusLabels: Record<ProjectStatus | WorkspaceStatus, string> = {
  active: 'Đang hoạt động', paused: 'Tạm dừng', processing: 'Đang xử lý',
  completed: 'Đã hoàn thành', archived: 'Đã lưu trữ',
}

export type PreviewSessionModel = {
  state: PreviewStoreState
  toasts: PreviewToast[]
  menu: PreviewMenuRequest | null
  dialog: PreviewDialogRequest | null
  // Thẻ tóm tắt project ("Xem thông tin"). Nằm trong model chung chứ không phải state riêng
  // của Home: menu ⋯ ở Home · Projects · trang Project đều mở được nó, và nó là surface duy
  // nhất của frame bên cạnh menu/dialog/toast.
  info: PreviewInfoRequest | null
  unreadNotifications: number
  openMenu: (request: PreviewMenuRequest) => void
  closeMenu: () => void
  closeDialog: () => void
  openInfo: (request: PreviewInfoRequest) => void
  closeInfo: () => void
  run: (action: PreviewActionId, target: PreviewTarget) => void
  // Dòng phản hồi ngắn không gắn với mutation (sidebar báo module chưa mở) để frame
  // chỉ có MỘT vùng thông báo: thêm một <p role="status"> riêng là thêm một live region.
  notify: (text: string, tone?: PreviewToastTone) => void
  submitRename: (name: string) => void
  confirmRemove: () => void
  // Modal "Thông tin Workspace": lưu tên + mô tả qua MỘT mutation (Hoàn tác trả cả hai) rồi
  // khép modal — surface cấp phiên nên hook là nơi đóng nó.
  updateWorkspace: (id: string, edit: WorkspaceEdit) => void
  // Hai modal của workspace là surface cấp phiên (mở từ ⋯ của THẺ, không chỉ từ trang chi tiết).
  workspacePanel: PreviewWorkspacePanel | null
  closeWorkspacePanel: () => void
  // Nút "Thêm thành viên" trong modal Quản lý thành viên: thêm Người thật vào roster, optimistic
  // + Hoàn tác như mọi ghi khác của frame.
  addWorkspaceMember: (workspaceId: string, person: Person) => void
  // ⋯ của một DÒNG người trong modal Quản lý thành viên workspace (đổi vai trò · gỡ khỏi workspace).
  setWorkspaceMemberRole: (workspaceId: string, personId: string, role: string) => void
  removeWorkspaceMember: (workspaceId: string, personId: string) => void
  // Panel "Quản lý thành viên" của project — surface cấp phiên như hai modal của workspace, vì ⋯
  // của thẻ dataset mọc ra ở trang Project chứ không phải ở nơi render panel.
  projectPanel: PreviewProjectPanel | null
  closeProjectPanel: () => void
  addProjectMember: (projectId: string, person: Person, role: string) => void
  setProjectMemberRole: (projectId: string, personId: string, role: string) => void
  removeProjectMember: (projectId: string, personId: string) => void
  // Wizard "Tạo Project": `null` = mở từ trang Projects khi phạm vi là "mọi không gian", khi đó
  // wizard hiện ô chọn Workspace bắt buộc (đặt một project vào workspace vô hình là nói dối).
  projectWizard: PreviewProjectWizard | null
  openProjectWizard: (workspaceId?: string | null) => void
  closeProjectWizard: () => void
  selectWorkspace: (workspaceId: string) => void
  selectProject: (projectId: string) => void
  clearProject: () => void
  openSection: (section: PreviewSectionId, ids?: PreviewRouteIds) => void
  openUniverse: (projectId?: string | null) => void
  readAllNotifications: () => void
  // Màn Thông báo chọn nhiều dòng rồi thao tác một lần. id nằm ở tham số chứ không nằm
  // trong hook: selection là chuyện của một trang, không phải của phiên dùng chung.
  markNotificationsRead: (ids: readonly string[]) => void
  deleteNotifications: (ids: readonly string[]) => void
  // Gửi một báo cáo vấn đề từ ô "?" trên topbar. Cùng khuôn mutation với các thao tác
  // khác: áp dụng ngay (optimistic), toast báo thành công kèm Hoàn tác.
  createReport: (input: NewReportInput) => void
  // Wizard "Tạo Project" 4 bước: tạo project KÈM tập dữ liệu vừa nạp, optimistic + Hoàn tác.
  createProject: (input: NewProjectInput) => void
  // Nút "Tạo Workspace" (khung 2 ảnh Workspaces Overview): thêm workspace mới vào danh sách mẫu.
  createWorkspace: (input: NewWorkspaceInput) => void
  // Nhánh "Accounts" của Settings (nhóm 04): lưu hồ sơ, thu hồi phiên, gạt công tắc thông báo.
  updateProfile: (edit: ProfileEdit) => void
  revokeSession: (id: string) => void
  revokeAllSessions: () => void
  setNotificationPref: (key: NotificationPrefKey, value: boolean) => void
  dismissToast: (id: string) => void
}

export const usePreviewSessionModel = (
  routeIds: PreviewRouteIds,
  navigateUniverse: PreviewUniverseNavigator = defaultUniverseNavigator,
): PreviewSessionModel => {
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

  const pushToast = useCallback((text: string, tone: PreviewToastTone, onUndo?: () => void) => {
    const id = `tst-${++toastSeq.current}`
    setToasts(current => [...current.slice(-2), { id, text, tone, undoLabel: onUndo ? 'Hoàn tác' : undefined, onUndo }])
    toastTimers.current.set(id, window.setTimeout(() => dismissToast(id), onUndo ? toastLifetimeMs : shortToastLifetimeMs))
  }, [dismissToast])

  useEffect(() => {
    const timers = toastTimers.current
    return () => { timers.forEach(timer => window.clearTimeout(timer)); timers.clear() }
  }, [])

  // URL thắng, nhưng chỉ khi nó thật sự mang id: hash '#/preview/projects' trần thì
  // phải giữ phạm vi người dùng đang chọn, không nhảy về workspace đầu danh sách.
  const { workspaceId: routeWorkspaceId, projectId: routeProjectId } = routeIds
  useEffect(() => {
    if (routeWorkspaceId) previewMockStore.selectWorkspace(routeWorkspaceId)
    if (routeProjectId) previewMockStore.selectProject(routeProjectId)
  }, [routeWorkspaceId, routeProjectId])

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
    // Ghi hash chứ không lịch sử push: cùng một tab, F5 vẫn về đúng trang + đúng phạm vi.
    const href = previewHref(section, ids)
    if (window.location.hash !== href) window.location.hash = href
    // Kể cả khi hash không đổi (người dùng đã đứng ở đích), đây vẫn là một chuyến ĐI: surface
    // nổi nghe tín hiệu này để khép lại. Thiếu nó thì bấm "Mở Project" của chính project đang
    // mở sẽ để popover thông báo treo nguyên trên trang vừa mở.
    window.dispatchEvent(new Event(previewNavigateEvent))
  }, [])

  const openUniverse = useCallback((projectId?: string | null) => {
    const selected = previewMockStore.getState().selection.projectId
    navigateUniverse(universeUrl(projectId || selected || null))
  }, [navigateUniverse])

  // Kết quả mutation luôn kèm Hoàn tác: mock store chỉ sửa bộ nhớ tab nên người review
  // phải rút lại được ngay mà không phải tải lại trang (shared-ui: không khóa người dùng).
  const applyMutation = useCallback((operation: Promise<PreviewMutationResult>) => {
    void operation
      .then(result => pushToast(result.message, 'success', () => {
        result.undo()
        pushToast('Đã hoàn tác thao tác vừa rồi.', 'info')
      }))
      .catch(() => pushToast('Thao tác không áp dụng được lên dữ liệu mẫu này.', 'danger'))
  }, [pushToast])

  const run = useCallback((action: PreviewActionId, target: PreviewTarget) => {
    closeMenu()
    const current = previewMockStore.getState()
    switch (action) {
      case 'detail':
        // 1 click = chọn để xem chi tiết, không đổi trang: panel chi tiết nằm kế bên thẻ.
        if (target.kind === 'workspace') previewMockStore.selectWorkspace(target.id)
        else previewMockStore.selectProject(target.id)
        break
      case 'open':
        if (target.kind === 'workspace') {
          previewMockStore.selectWorkspace(target.id)
          // "Truy cập gần nhất" là ô sắp xếp mặc định của trang Workspaces (ảnh khung 6), nên
          // mốc truy cập phải được ghi khi NGƯỜI DÙNG thật mở — nếu không ô đó chỉ là bản
          // sao của "Cập nhật gần nhất" và bộ lọc thứ ba trong ảnh là đồ giả.
          previewMockStore.touchWorkspace(target.id)
          openSection('workspaces', { workspaceId: target.id })
        } else {
          const project = current.projects.find(item => item.id === target.id)
          previewMockStore.selectProject(target.id)
          openSection('projects', { workspaceId: project?.workspaceId ?? null, projectId: target.id })
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
      case 'universe':
        openUniverse(target.kind === 'project' ? target.id : null)
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
        applyMutation(previewMockStore.toggleFavorite(target.id))
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
          detail: target.kind === 'workspace'
            ? `Workspace là ranh giới truy cập: gỡ khỏi danh sách mẫu sẽ kéo theo ${current.projects.filter(item => item.workspaceId === target.id).length} project của nó. Thao tác chỉ sửa bộ nhớ tab và có Hoàn tác.`
            : 'Xóa chỉ gỡ bản ghi khỏi danh sách mẫu trong bộ nhớ tab và có Hoàn tác.',
        })
        break
    }
  }, [applyMutation, closeMenu, openSection, openUniverse])

  const notify = useCallback((text: string, tone: PreviewToastTone = 'info') => pushToast(text, tone), [pushToast])

  const submitRename = useCallback((name: string) => {
    if (dialog?.mode !== 'rename') return
    const trimmed = name.trim()
    if (!trimmed) { pushToast('Tên để trống không được chấp nhận.', 'danger'); return }
    applyMutation(previewMockStore.rename(dialog.target.kind, dialog.target.id, trimmed))
    setDialog(null)
  }, [applyMutation, dialog, pushToast])

  const confirmRemove = useCallback(() => {
    if (dialog?.mode !== 'remove') return
    applyMutation(previewMockStore.remove(dialog.target.kind, dialog.target.id))
    setDialog(null)
  }, [applyMutation, dialog])

  return {
    state,
    toasts,
    menu,
    dialog,
    info,
    workspacePanel,
    unreadNotifications: state.notifications.filter(item => item.unread).length,
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
    updateWorkspace: (id: string, edit: WorkspaceEdit) => {
      setWorkspacePanel(null)
      applyMutation(previewMockStore.updateWorkspace(id, edit))
    },
    addWorkspaceMember: (workspaceId: string, person: Person) => {
      applyMutation(previewMockStore.addWorkspaceMember({ workspaceId, person }))
    },
    setWorkspaceMemberRole: (workspaceId: string, personId: string, role: string) => {
      applyMutation(previewMockStore.setWorkspaceMemberRole(workspaceId, personId, role))
    },
    removeWorkspaceMember: (workspaceId: string, personId: string) => {
      applyMutation(previewMockStore.removeWorkspaceMember(workspaceId, personId))
    },
    projectPanel,
    closeProjectPanel: () => setProjectPanel(null),
    addProjectMember: (projectId: string, person: Person, role: string) => {
      applyMutation(previewMockStore.addProjectMember({ projectId, person, role }))
    },
    setProjectMemberRole: (projectId: string, personId: string, role: string) => {
      applyMutation(previewMockStore.setProjectMemberRole(projectId, personId, role))
    },
    removeProjectMember: (projectId: string, personId: string) => {
      applyMutation(previewMockStore.removeProjectMember(projectId, personId))
    },
    projectWizard,
    // Mở wizard ở CẤP PHIÊN nên nó sống sót khi đổi trang — và vì thế nó cũng phải khép lại khi
    // người dùng đi chỗ khác (openSection đã phát previewNavigateEvent, surface nghe tín hiệu đó).
    openProjectWizard: (workspaceId?: string | null) => setProjectWizard({ workspaceId: workspaceId ?? null }),
    closeProjectWizard: () => setProjectWizard(null),
    selectWorkspace: previewMockStore.selectWorkspace,
    selectProject: previewMockStore.selectProject,
    clearProject: previewMockStore.clearProject,
    openSection,
    openUniverse,
    readAllNotifications: () => { applyMutation(previewMockStore.markAllNotificationsRead()) },
    markNotificationsRead: (ids: readonly string[]) => { applyMutation(previewMockStore.markNotificationsRead(ids)) },
    deleteNotifications: (ids: readonly string[]) => { applyMutation(previewMockStore.removeNotifications(ids)) },
    createReport: (input: NewReportInput) => { applyMutation(previewMockStore.createReport(input)) },
    createProject: (input: NewProjectInput) => { applyMutation(previewMockStore.createProject(input)) },
    createWorkspace: (input: NewWorkspaceInput) => { applyMutation(previewMockStore.createWorkspace(input)) },
    updateProfile: (edit: ProfileEdit) => { applyMutation(previewMockStore.updateProfile(edit)) },
    revokeSession: (id: string) => { applyMutation(previewMockStore.revokeSession(id)) },
    revokeAllSessions: () => {
      // Không còn phiên nào khác ngoài phiên hiện tại → đây là no-op, KHÔNG bật mutation
      // (mutation luôn kèm "Hoàn tác", mà hoàn tác một lần không thay đổi gì rồi báo "Đã hoàn
      // tác" là nói dối). Chỉ notify ngắn, cùng vùng thông báo, không thêm live region.
      const others = previewMockStore.getState().sessions.filter(item => !item.current).length
      if (others === 0) { notify('Chỉ còn phiên hiện tại — không có phiên nào khác để đăng xuất.', 'info'); return }
      applyMutation(previewMockStore.revokeOtherSessions())
    },
    setNotificationPref: (key: NotificationPrefKey, value: boolean) => { applyMutation(previewMockStore.setNotificationPref(key, value)) },
    dismissToast,
  }
}

export { statusLabels }
