import type { PreviewRouteIds } from './preview-route.types'
import type {
  NewProjectInput, NewReportInput, NewWorkspaceInput, NotificationPrefKey, Person,
  PreviewActionId, PreviewDialogRequest, PreviewInfoRequest, PreviewMenuRequest, PreviewProjectPanel,
  PreviewProjectWizard, PreviewSectionId, PreviewStoreState, PreviewTarget, PreviewToast,
  PreviewToastTone, PreviewWorkspacePanel, ProfileEdit, WorkspaceEdit,
} from './preview.types'

export type PreviewColorPreference = 'light' | 'dark' | 'system'

export type PreviewAppearance = {
  preference: PreviewColorPreference
  resolved: 'light' | 'dark'
  setColorPreference: (value: PreviewColorPreference) => void
}

export type PreviewSessionModel = {
  appearance: PreviewAppearance
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

export type PreviewUniverseNavigator = (url: string) => void
