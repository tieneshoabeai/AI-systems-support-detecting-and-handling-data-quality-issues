// Kiểu cho các trang preview 2D (Home / Workspaces / Projects).
// Chỉ dùng cho route dev-only; không phải DTO backend. Khi nối API thật,
// service sẽ map DTO sang các kiểu này hoặc thay thế từng trang một.

export type PreviewSectionId =
  | 'home' | 'workspaces' | 'projects' | 'notifications' | 'datasets' | 'data-views'
  | 'clean-rules' | 'lineage' | 'versions' | 'exports' | 'users' | 'settings'

export type WorkspaceStatus = 'active' | 'paused' | 'archived'
export type ProjectStatus = 'active' | 'paused' | 'processing' | 'completed' | 'archived'
export type DatasetStatus = 'processed' | 'processing' | 'queued' | 'failed'
export type CoverHue = 'blue' | 'violet' | 'green' | 'pink' | 'orange' | 'cyan'

export type Person = {
  id: string
  name: string
  role: string
  initials: string
  /**
   * Email gõ tay trong dialog "Tạo Workspace". Person mẫu trong fixture KHÔNG có field này —
   * email của họ luôn suy từ tên (emailForPerson); chỉ bản ghi mời qua email lạ mới mang địa chỉ
   * người dùng thật nhập, để roster của workspace mới không tự đổi đuôi email của người khác.
   */
  email?: string
}

export type DatasetSummary = {
  id: string
  fileName: string
  format: 'CSV' | 'Parquet' | 'Excel' | 'JSON'
  rows: number
  columns: number
  sizeMb: number
  importedAt: string
  status: DatasetStatus
}

export type Workspace = {
  id: string
  name: string
  description: string
  status: WorkspaceStatus
  projects: number
  datasets: number
  members: number
  storageGb: number
  favorite: boolean
  cover: CoverHue
  createdAt: string
  updatedAt: string
  /** Lần gần nhất chính người dùng này mở workspace (sắp "Truy cập gần nhất" trong ảnh
   *  Workspaces Overview). TÙY CHỌN vì fixture không ghi mốc này: thiếu → view fallback
   *  sang `updatedAt`. Mock store chỉ ghi nó khi thật sự có thao tác mở (run('open')), nên
   *  hai ô "Truy cập gần nhất" và "Cập nhật gần nhất" không phải một hàng đội hai tên. */
  accessedAt?: string
  owner: Person
  memberPreview: Person[]
  /** Vai trò đã CHỌN thật trong phiên này, keyed theo person id ("Thêm thành viên" ở modal
   *  Quản lý thành viên). Fixture không mang field này → vai trò suy luân phiên theo vị trí
   *  (memberRoleCycle); người được thêm thì phải ghi rõ kẻo một người vừa được mời làm Member
   *  lại nhận badge Admin chỉ vì họ rơi vào đúng vị trí thứ hai trong danh sách. */
  memberRoles?: Record<string, string>
}

// Bóc từ modal "Thông tin Workspace" (Design Board workspaces detail) sang mutation của
// mock store. Chỉ hai trường editable (tên · mô tả); chủ sở hữu / ngày tạo / số thành viên /
// số project là chỉ đọc nên không đi qua đây.
export type WorkspaceEdit = { name: string; description: string }

// Bóc từ wizard "Tạo Project" 4 bước sang mutation của mock store.
// `dataset` KHÔNG còn tùy chọn: một project luôn gắn với một tập dữ liệu ngay từ lúc tạo, nên
// wizard bắt buộc nạp tệp ở bước "Import Dataset" (view đọc tệp bằng parseLocalCsv rồi đưa số
// đo thật — rows/columns/sizeMb — qua đây, service chỉ đóng gói thành DatasetSummary).
export type NewProjectDatasetInput = {
  fileName: string
  format: DatasetSummary['format']
  rows: number
  columns: number
  sizeMb: number
}

export type NewProjectInput = {
  workspaceId: string
  name: string
  description: string
  members: Person[]
  dataset: NewProjectDatasetInput
}

// Thêm MỘT thành viên vào project (mục "Quản lý thành viên" trong ⋯ của dataset). Nguồn người
// chọn luôn là roster của chính workspace — ràng buộc nghiệp vụ, không phải giới hạn giao diện.
export type NewProjectMemberInput = { projectId: string; person: Person; role: string }

// Bóc từ khung 2 "Tạo Workspace" sang mutation của mock store. `status`/`cover`/ngày do
// service sinh; thành viên ban đầu là Person (chọn từ danh bạ hoặc thêm bằng email).
export type NewWorkspaceInput = { name: string; description: string; members: Person[] }

// Thêm MỘT thành viên vào workspace đã có (nút "Thêm thành viên" trong modal Quản lý thành
// viên). Ảnh chỉ vẽ nút mở khung chọn người (khung 2–3 ảnh "Workspace Creation with Email
// Suggestions"), không vẽ ô chọn vai trò ở bước này → vai trò của người mới được ghi rõ là
// Member thay vì để memberRoleCycle phát nhầm theo vị trí.
export type NewWorkspaceMemberInput = { workspaceId: string; person: Person }

export type Project = {
  id: string
  code: string
  name: string
  description: string
  status: ProjectStatus
  workspaceId: string
  workspaceName: string
  cover: CoverHue
  dataset: DatasetSummary | null
  members: Person[]
  createdAt: string
  updatedAt: string
  owner: Person
}

export type TrendStat = {
  id: string
  label: string
  value: string
  delta: string
  tone: 'brand' | 'accent' | 'violet' | 'cyan' | 'green' | 'orange'
  /** Glyph của thẻ. Mặc định suy từ `tone` (toneIcons); đặt khi một thẻ cần chữ KHÁC với
   *  icon mà tone của nó quy định — hai thẻ 'Sở hữu'/'Thành viên' cùng dùng glyph 'users'
   *  thì người đọc phân biệt bằng chữ chứ không bằng hình. */
  icon?: string
}

export type ActivityEntry = {
  id: string
  actor: Person
  action: string
  target: string
  at: string
  tone: TrendStat['tone']
}

export type QuickAction = {
  id: string
  label: string
  icon: string
  tone: TrendStat['tone']
}

export type UniverseModule = {
  id: PreviewSectionId
  label: string
  caption: string
  hue: CoverHue
}

export type StorageUsage = {
  usedLabel: string
  totalLabel: string
  percent: number
}

export type CurrentUser = {
  name: string
  role: string
  initials: string
}

export type WorkspaceDetailTab = 'overview' | 'members' | 'projects' | 'settings'
export type ProjectDetailTab = 'overview' | 'dataset' | 'members' | 'history' | 'settings'

// Bốn module của trang Project Workspace (ảnh DataVerse_Project_Workspace_Overview_v1). MỘT khối
// trong scene 3D của bạn T và MỘT nút trên thanh đáy là CÙNG một module (đặc tả projects: "ấn các
// nút này cũng tương tự như ấn vào các ô khối 3d"), nên id dùng chung cho cả hai chỗ — hai id riêng
// là hai nguồn sự thật cho một khái niệm. Nhãn chép NGUYÊN VĂN trong ảnh: mục đầu tiếng Việt
// 'Tổng quan', ba mục sau giữ tiếng Anh đúng như ảnh vẽ.
export type ProjectModuleId = 'overview' | 'data-view' | 'data-analysis' | 'detection'
export type ProjectModule = {
  id: ProjectModuleId
  label: string
  // Dòng chữ nhỏ dưới tên khối, cũng lấy từ ảnh.
  caption: string
  icon: string
  // Tone riêng của từng khối trong ảnh (tím · xanh lơ · xanh lá · cam) — map vào token có sẵn.
  tone: 'violet' | 'cyan' | 'teal' | 'amber'
}

// Bộ lọc của trang Workspaces (ảnh "Workspace Creation with Email Suggestions", khung 4–6):
// ba ô Quyền sở hữu · Vai trò · Sắp xếp, KHÔNG có hàng tab trạng thái. Giá trị là khóa để
// view so với trường thật của bản ghi; nhãn tiếng Việt đặt ở preview-data (một nguồn).
export type WorkspaceOwnershipFilter = 'all' | 'owned' | 'shared'
// Vai trò CỦA MÌNH trong workspace, lấy đúng bộ chữ mà modal "Quản lý thành viên" đang vẽ
// (Owner/Admin/Member/Viewer) — xem myWorkspaceRole trong preview-data.
export type WorkspaceRoleFilter = 'all' | 'Owner' | 'Admin' | 'Member' | 'Viewer'
export type WorkspaceSort = 'accessed' | 'created' | 'updated' | 'name-asc' | 'name-desc'

// Tab lọc ở đầu trang. Nhãn có số đếm nên phải suy từ danh sách đang hiển thị (xem
// projectTabsFor), không được viết tay.
export type ProjectFilterTab = 'all' | 'active' | 'paused' | 'completed' | 'archived'

/* ---------- Tương tác chuột (menu ngữ cảnh, popover, toast) ---------- */

export type PreviewResourceKind = 'workspace' | 'project' | 'dataset'

// id hành động dùng chung cho menu chuột phải, nút ⋯ và dropdown "Thao tác ▾"
// để ba lối vào đó không thành ba bộ hành vi lệch nhau.
// Danh sách RÚT theo đúng hai ảnh đặc tả: ⋯ của workspace chỉ còn ba mục (xem workspaceMenu),
// ⋯ của project bốn mục → 'open-projects' · 'duplicate' · ba id 'status-*' · 'copy-link' không
// còn lối vào nào nên bị xóa hẳn, thay vì để một id "phòng khi dùng" không ai bấm tới.
// 'archive'/'unarchive' cũng bị xóa theo yêu cầu chủ batch 03/11: mục "Lưu trữ Project" không
// còn trong ⋯ của project nữa.
export type PreviewActionId =
  | 'open' | 'universe' | 'detail'
  | 'info'
  | 'ws-info' | 'ws-members'
  // 'pj-members' = mục "Quản lý thành viên" trong ⋯ của dataset (ảnh
  // DataVerse_Project_Actions_Details_v1 panel 3). Ảnh vẽ nó là mục THẬT nên menu có nó, và nó
  // MỞ panel thành viên thật (PreviewProjectPanel) — thành viên thêm vào lấy từ roster của
  // chính workspace, đúng ràng buộc nghiệp vụ đã ghi ở preview-data.
  | 'pj-members'
  | 'favorite' | 'unfavorite' | 'rename'
  | 'remove'

export type PreviewMenuItem = {
  id: PreviewActionId
  label: string
  icon: string
  tone?: 'default' | 'danger'
  separatorBefore?: boolean
  // Item tắt vẫn phải giải thích được (shared-ui mục 6): describedBy trỏ về dòng note của trang.
  disabled?: boolean
  describedBy?: string
  hint?: string
}

// Bản ghi mà menu ngữ cảnh / dialog thao tác. 'dataset' chưa có mock record (module của T)
// nên chỉ mang id + tên hiển thị, không tra thêm field nào khác.
export type PreviewTarget = {
  kind: PreviewResourceKind
  id: string
  name: string
}

// Menu mở từ chuột phải thì định vị theo con trỏ; mở từ nút ⋯ / "Thao tác ▾" thì
// neo vào chính nút đó (apple-design mục 7) để menu mọc ra từ nơi người dùng vừa bấm.
export type PreviewMenuOrigin =
  | { kind: 'pointer'; x: number; y: number }
  | { kind: 'anchor'; element: HTMLElement }

export type PreviewMenuRequest = {
  target: PreviewTarget
  items: PreviewMenuItem[]
  origin: PreviewMenuOrigin
  // Dòng lý do hiển thị ngay trong menu cho các item tắt — aria-describedby thôi là
  // chưa đủ vì người dùng không phải lúc nào cũng nhìn thấy note dưới đáy trang.
  note?: string
}

export type PreviewDialogRequest =
  | { mode: 'rename'; target: PreviewTarget; currentName: string }
  | { mode: 'remove'; target: PreviewTarget; detail: string }

// Hai modal của workspace ("Thông tin Workspace" · "Quản lý thành viên" trong ảnh workspaces
// detail) là surface CẤP PHIÊN chứ không phải state cục bộ của trang chi tiết: menu ⋯ mọc ra
// từ THẺ trên trang danh sách (chuột phải / ⋯ / nút ⋯ trong header), nên nơi mở không phải nơi
// vẽ modal. Modal chỉ cần id bản ghi → giữ id, surface tự tra lại workspace từ store.
export type PreviewWorkspacePanel = { workspaceId: string; panel: 'info' | 'members' }

// Panel "Quản lý thành viên" của PROJECT (mục thứ hai trong ⋯ của thẻ dataset, ảnh
// DataVerse_Project_Actions_Details_v1 panel 3). Cũng là surface cấp phiên vì ⋯ đó mọc ra từ
// nhiều trang; surface tự tra project từ id trong store nên xóa project là panel tự biến mất.
export type PreviewProjectPanel = { projectId: string }

// Wizard "Tạo Project" là surface cấp phiên chứ không phải state cục bộ của một trang: nó có hai
// lối vào — nút "+ Tạo Project" trong trang chi tiết workspace (đã biết workspace) và nút "Tạo
// project" ở trang Projects (phạm vi có thể là "mọi không gian", `workspaceId: null` → wizard
// phải hiện ô chọn Workspace bắt buộc thay vì giấu người dùng vào một workspace vô hình).
export type PreviewProjectWizard = { workspaceId: string | null }

// Mặt của surface nổi so với nơi nó mọc ra. 'bottom' = rơi xuống dưới trigger (menu, popover,
// dialog — mọi thứ xưa nay). 'right' = bay ra CẠNH trigger theo kiểu flyout submenu: thẻ "Xem
// thông tin" lia trên một item của menu mà mọc xuống dưới thì nó phủ đúng các item bên dưới,
// người bấm không thấy gì, nên nó phải nằm ngang.
export type PreviewSurfaceSide = 'bottom' | 'right'

// Thẻ "Xem thông tin" của project: bản tóm tắt TẠM, chỉ tồn tại lúc con trỏ đang lia trên item
// "Xem thông tin" trong menu ⋯ (đặc tả Home của chủ sở hữu batch) → `side: 'right'`, bay ra cạnh
// item. Bấm item đó thì menu đóng và thẻ Ở LẠI, neo vào nút ⋯ (`side: 'bottom'`) — đó là lối vào
// cho bàn phím, nơi không có hover để dựa vào.
// Origin tái dùng kiểu của menu: surface này cũng phải biết mình mọc từ con trỏ hay từ nút.
export type PreviewInfoRequest = {
  projectId: string
  origin: PreviewMenuOrigin
  side: PreviewSurfaceSide
}

export type PreviewToastTone = 'info' | 'success' | 'danger'

export type PreviewToast = {
  id: string
  text: string
  tone: PreviewToastTone
  // undo chỉ sống trong cửa sổ hiển thị của toast — hết toast là hết đường hoàn tác,
  // vì snapshot nằm trong closure của mock store chứ không ghi ra đâu.
  undoLabel?: string
  onUndo?: () => void
}

export type PreviewNotification = {
  id: string
  tone: 'ok' | 'warn' | 'upload' | 'info'
  title: string
  context: string
  at: string
  /** Mốc đầy đủ "10:24, 20/01/2025" cho màn chi tiết (Design Board 1.3) — `at` chỉ là
      nhãn tương đối trên dropdown, hai thứ phải cùng chỉ một thời điểm. */
  atFull: string
  /** Dòng "Loại" trong màn chi tiết. Suy ra từ nội dung, không phải màu icon. */
  kind: PreviewNotificationKind
  /** Đoạn "Mô tả chi tiết" — dropdown chỉ có title + context, vào sâu mới có đủ câu. */
  description: string
  unread: boolean
  projectId: string | null
}

export type PreviewNotificationKind = 'processing' | 'quality' | 'import' | 'export' | 'member' | 'system'

// Ba tab lọc của màn danh sách thông báo (Design Board 1.2: Tất cả / Chưa đọc / Đã đọc).
export type NotificationFilterTab = 'all' | 'unread' | 'read'

/* ---------- Báo cáo vấn đề (Design Board nhóm 02–03, đặc tả Shell dòng 7) ---------- */

// Bốn trạng thái xử lý ở khung 3.4. `closed` là trạng thái thật của vòng đời nhưng bộ
// lọc (3.2) chỉ vẽ ba tab có bản ghi, nên tab sinh theo danh sách, không viết tay.
export type ReportStatus = 'processing' | 'needs-info' | 'resolved' | 'closed'

// Danh mục "Loại vấn đề" của ô chọn trong form tạo (3.1) + cột Loại ở danh sách (3.2).
export type ReportIssueType = 'system' | 'feature' | 'data' | 'suggestion' | 'other'

// Tab lọc danh sách báo cáo: tất cả + ba trạng thái đang có bản ghi (mockup 3.2).
export type ReportFilterTab = 'all' | 'processing' | 'needs-info' | 'resolved'

// Tệp đính kèm CHỈ là nhãn (tên + dung lượng hiển thị). Chưa có API upload nên frame
// không đọc nội dung, không "tải lên" — ghi nhận đúng tên người dùng vừa chọn là đủ.
export type ReportAttachment = { name: string; sizeLabel: string }

export type PreviewReport = {
  id: string
  /** Mã công khai kiểu DV-250120-001 (Design Board 3.2–3.3), không phải id nội bộ. */
  code: string
  issueType: ReportIssueType
  title: string
  description: string
  attachment: ReportAttachment | null
  status: ReportStatus
  /** Mốc tuyệt đối "20/01/2025, 10:30" cho dòng "Thời gian tạo" (3.3). */
  createdAt: string
  /** Nhãn tương đối trên cột "Cập nhật" (3.2), cùng bộ với `byNewestFirst`. */
  updatedAt: string
}

// Bóc từ form tạo báo cáo sang mutation của mock store — `status`/`code` do service sinh.
export type NewReportInput = {
  issueType: ReportIssueType
  title: string
  description: string
  attachment: ReportAttachment | null
}

/* ---------- Tài khoản & Cài đặt cá nhân (Design Board nhóm 04, đặc tả Shell dòng 9) ---------- */

// Nhánh "Accounts" của Settings có bốn màn. Đặc tả dòng 9: bấm "Hồ sơ cá nhân" và
// "Cài đặt tài khoản" đều chuyển sang Settings, nên chúng là một SECTION điều hướng thật
// (có hash riêng '#/preview/settings/<mục>') chứ không chạy "trong ô" như chuông/báo cáo.
export type SettingsSectionId = 'profile' | 'security' | 'sessions' | 'notifications'

// Cấu trúc thanh bar phụ của Settings (ảnh 4.2–4.5 + yêu cầu nhóm trưởng): vào Settings là
// hiện một cột chứa CÁC MODULE (System · Accounts · Time & Language · Update …); bấm một module
// thì mở các mục của nó. Batch này CHẮC CHẮN chỉ có Accounts (ảnh chỉ vẽ nhánh đó) nên danh sách
// dưới chỉ một phần tử — thêm module mới là thêm một đối tượng vào mảng, không sửa view.
// 'accounts' là id DUY NHẤT đã được kiểm chứng; id cho System/Time/Update chưa có trong ảnh hay
// đặc tả nên KHÔNG đặt trước (một id không ai mở là module chết).
export type SettingsModuleId = 'accounts'

// Lá = một màn điều hướng được (nhấn → '#/preview/settings/<id>').
export type SettingsNavLeaf = { id: SettingsSectionId; label: string; icon: string }

// Nhóm = mục cha KHÔNG phải một màn ("Cài đặt tài khoản"): ấn vào nó chỉ gập/mở danh sách con.
// Ảnh 4.3 vẽ '#/preview/settings' trần = Bảo mật, nhưng chủ batch 03/11 bác: hai lối vào khác
// nhau cùng đổ về một màn con thì người dùng đọc thành "bấm nhầm". Route trần là màn tổng quan,
// còn màn nào được mở luôn do người dùng chọn từ lá — nên nhóm không cần biết "mục đầu" là ai.
export type SettingsNavGroup = {
  label: string
  icon: string
  children: readonly SettingsNavLeaf[]
}

export type SettingsNavItem = SettingsNavLeaf | SettingsNavGroup

export type SettingsModule = {
  id: SettingsModuleId
  label: string
  icon: string
  items: readonly SettingsNavItem[]
}

export const isSettingsNavGroup = (item: SettingsNavItem): item is SettingsNavGroup =>
  'children' in item

// Hồ sơ cá nhân (4.2). Theo đặc tả: SỬA được tên · đơn vị · số điện thoại · giới thiệu;
// email và chức vụ CHỈ ĐỌC (khóa). Vì vậy mutation chỉ nhận bốn trường editable (ProfileEdit).
export type ProfileInfo = {
  name: string
  email: string
  role: string
  organization: string
  phone: string
  bio: string
}

export type ProfileEdit = Pick<ProfileInfo, 'name' | 'organization' | 'phone' | 'bio'>

// Một phiên đăng nhập ở màn "Đăng nhập & phiên" (4.4). `current` là máy đang xem preview
// này — không được phép đăng xuất chính nó (đăng xuất thật thuộc trang auth của bạn T).
export type DeviceSession = {
  id: string
  platform: string
  browser: string
  icon: string
  location: string
  current: boolean
  startedAt: string
  ip: string
}

// Bốn công tắc "Tùy chọn thông báo" (4.5). Khóa trùng tên với nhóm thông báo để sau này
// nối API chỉ đổi nguồn dữ liệu, không đổi chữ trong view.
export type NotificationPrefs = {
  system: boolean
  projects: boolean
  quality: boolean
  workspace: boolean
}

export type NotificationPrefKey = keyof NotificationPrefs

export type PreviewSelection = {
  workspaceId: string
  projectId: string
}

export type PreviewStoreState = {
  workspaces: Workspace[]
  projects: Project[]
  notifications: PreviewNotification[]
  reports: PreviewReport[]
  profile: ProfileInfo
  sessions: DeviceSession[]
  notificationPrefs: NotificationPrefs
  selection: PreviewSelection
}

// Kết quả mutation của mock service: undo là hàm đóng, không phải id bản ghi.
export type PreviewMutationResult = {
  message: string
  undo: () => void
}
