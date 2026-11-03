import type {
  NotificationFilterTab, NotificationPrefKey, PreviewNotification, PreviewNotificationKind,
  PreviewReport, PreviewSectionId, PreviewStoreState, Project, ProjectFilterTab, ProjectModule,
  Person, ReportFilterTab, ReportIssueType, ReportStatus, SettingsModule, SettingsNavLeaf, SettingsSectionId, TrendStat, Workspace,
  WorkspaceOwnershipFilter, WorkspaceRoleFilter, WorkspaceSort,
} from '../../types/preview/preview.types'
import { isSettingsNavGroup } from '../../types/preview/preview.types'
import { currentUser, people, storageUsage } from '../../services/preview/preview-fixtures'

// Dữ liệu mẫu cho route preview dev-only. Không import vào app thật,
// không gọi API, không ghi storage. Production build loại toàn bộ file này
// vì main.tsx chỉ import nhánh preview khi import.meta.env.DEV.

export const previewNotice = 'Dữ liệu mẫu · khung xem trước giao diện 2D'

// shared-ui.md: "control chưa có chức năng → không được quảng cáo là chạy được" và "nút disabled
// cần lý do dễ tiếp cận trong text/context, không chỉ tooltip hover". Nên bất biến của frame vẫn
// còn: mọi `button[disabled]` phải trỏ aria-describedby về một dòng chữ dài ≥20 ký tự. Chỉ đạo
// 03/11 đổi CÁCH đạt bất biến đó — thay vì để control tắt kèm câu "chưa có API", control nào làm
// được trên dữ liệu mẫu thì BẬT THẬT, control nào không có nghiệp vụ phía sau thì bỏ hẳn.
// Vì vậy không còn dòng nào trong frame nói về việc chưa nối backend.
export const previewNoteIds = {
  shell: 'pv-shell-note',
  hero: 'pv-hero-note',
  workspaces: 'pv-ws-note',
  wsMembers: 'pv-ws-members-note',
  // `projectMembersPage` là ghi chú ở chân modal "Quản lý thành viên" của project. Nó KHÔNG trùng
  // id nào khác trên trang Project vì dải note đáy trang đã bỏ — modal tự mang lý do của nó.
  projectMembersPage: 'pv-pj-members-page-note',
  projectModules: 'pv-pj-modules-note',
  projects: 'pv-prj-note',
  universe: 'pv-universe-note',
  notifications: 'pv-notice-note',
  notificationList: 'pv-notice-list-note',
  notificationDetail: 'pv-notice-detail-note',
  report: 'pv-report-note',
  settings: 'pv-settings-note',
} as const

export const previewReasons = {
  shell: 'Chuông thông báo và nút "?" báo cáo vấn đề đều chạy trọn trong ô popover, không mở ra cả trang. '
    + 'Mục Settings ở sidebar và hai mục "Hồ sơ cá nhân" / "Cài đặt tài khoản" trong menu đều mở được thật (nhánh Accounts, dựng trên dữ liệu mẫu). '
    + 'Hai combobox phạm vi, tab lọc, chọn thẻ và phân trang chạy thật nhưng chỉ trên dữ liệu mẫu trong bộ nhớ tab.',
  hero: '“Mở Dataset Universe” chuyển trang thật sang route /preview/workspaces-3d (batch của T). Khu vực giữa là placeholder CSS cho scene 3D, chưa kéo xoay hay phóng to được.',
  workspaces: 'Năm thẻ số liệu, ô tìm kiếm, ba bộ lọc (quyền sở hữu · vai trò · sắp xếp), phân trang (tối đa 28 mỗi trang) và “Tạo Workspace” '
    + 'đều chạy thật nhưng chỉ ghi vào dữ liệu mẫu trong bộ nhớ tab — tải lại trang sẽ về danh sách ban đầu, '
    + 'và mọi thao tác tạo/sửa đều có Hoàn tác trên toast. “Vai trò” đọc từ roster của chính workspace: chủ sở hữu là Owner, '
    + 'phần còn lại luân phiên Admin/Member/Viewer, nên cả bốn ô lọc đều có bản ghi trong bộ demo này.',
  projects: 'Tab lọc trạng thái, ô sắp xếp, chọn thẻ và phân trang chạy thật trên dữ liệu mẫu trong bộ nhớ tab. '
    + 'Đổi tên / xóa từ ⋯ hoặc chuột phải chỉ sửa bộ nhớ và có Hoàn tác. '
    + '“Tạo project” mở wizard bốn bước; bước Import Dataset bắt buộc chọn một tệp .csv vì mỗi project gắn với một tập dữ liệu ngay khi tạo.',
  universe: 'Dataset Universe 3D là batch của T, chạy ở route /preview/workspaces-3d. Nút này chuyển trang thật và mang theo id project; scene 3D chưa nhận danh sách 2D.',
  // Modal "Quản lý thành viên" của WORKSPACE: cả ba thao tác (thêm · đổi vai trò · gỡ) đều bật
  // thật vì chúng ghi vào đúng các trường roster trong store. Chủ sở hữu là dòng duy nhất không
  // có ô thao tác, và đó là ràng buộc nghiệp vụ chứ không phải một chức năng thiếu.
  wsMembers: 'Bảng liệt kê các thành viên có trong dữ liệu mẫu của tab này. "Thêm thành viên", đổi vai trò và gỡ thành viên đều ghi thật vào bộ nhớ tab và có Hoàn tác. Chủ sở hữu không có hai ô thao tác sau — mỗi Workspace luôn phải còn một người chịu trách nhiệm.',
  // Modal "Quản lý thành viên" của PROJECT (ảnh DataVerse_Project_Actions_Details_v1 panel 3).
  // Nói rõ ràng buộc nghiệp vụ đang enforced: nguồn chọn người ĐÚNG LÀ roster của workspace.
  projectMembers: 'Thành viên của Project lấy từ chính roster của Workspace chứa nó — chỉ người đã thuộc Workspace mới được chủ sở hữu chọn vào Project. Thêm, đổi vai trò và gỡ người ghi vào dữ liệu mẫu trong bộ nhớ tab và luôn có Hoàn tác.',
  // Thanh 4 module + 4 khối 3D của trang Project. Nhóm chưa chốt màn hình bên trong bốn module
  // nên nút BẤM ĐƯỢC (hover · focus · đang chọn) nhưng không mở màn nào — nói thẳng để người
  // review không đoán rằng bấm hư. Scene 3D là của T, placeholder này giữ đúng bố cục của ảnh.
  projectModules: 'Bốn nút dưới thanh này là bốn module trong scene 3D của bạn T (Tổng quan · Data View · Data Analysis · Detection). Bấm nút nào thì khối tương ứng trong scene sáng lên và nút đó thành "đang chọn" — nhưng NHÓM CHƯA CHỐT màn hình bên trong từng module nên chưa có trang nào để mở. Scene thật chạy ở route /preview/workspaces-3d (nút "Mở Dataset Universe 3D" ở giữa trang chuyển sang đó, mang theo id project).',
  notificationList: 'Đây là danh sách mẫu trong bộ nhớ tab: đánh dấu đã đọc và xóa chỉ sửa bộ nhớ, '
    + 'có Hoàn tác, tải lại trang sẽ về 16 thông báo ban đầu. “Đánh dấu đã đọc”, “Xóa” và “Bỏ chọn” tắt khi chưa tích dòng nào; '
    + '“Đánh dấu tất cả đã đọc” tắt khi cả hộp thư không còn bản chưa đọc.',
  // Ô popover chuông là NƠI CHÍNH để xem thông báo (đặc tả Shell dòng 5: mọi thứ chạy "trong ô",
  // không hiển thị cả trang). Lý do này gắn cho các nút tắt bên trong ô.
  notificationInbox: 'Mọi thứ diễn ra trong ô này — tab lọc, tìm kiếm, chọn hàng loạt và phân trang đều không rời khỏi popover; '
    + 'đây là dữ liệu mẫu trong bộ nhớ tab nên đánh dấu đã đọc / xóa chỉ sửa bộ nhớ và có Hoàn tác. '
    + '“Đánh dấu đã đọc”, “Xóa”, “Bỏ chọn” tắt khi chưa tích dòng nào.',
  // Ô popover nút "?" là NƠI CHÍNH để báo cáo vấn đề (đặc tả Shell dòng 7: tạo/xem/chi tiết
  // "chỉ hiển thị trên ô nhỏ không hiển thị cả trang").
  report: 'Mọi thao tác báo cáo diễn ra trong ô này — tạo mới, xem danh sách và chi tiết đều không rời khỏi popover; '
    + 'báo cáo chỉ được ghi vào dữ liệu mẫu trong bộ nhớ tab và có Hoàn tác. '
    + 'Tệp đính kèm chỉ ghi nhận tên — frame không tải lên hay đọc nội dung tệp.',
  // Nhánh "Accounts" của Settings (nhóm 04) — màn hình thật, không phải "trong ô" như chuông/báo cáo.
  settings: 'Toàn bộ nhánh Accounts chạy trên dữ liệu mẫu trong bộ nhớ tab: lưu hồ sơ, '
    + 'bật/tắt thông báo và đăng xuất các phiên khác chỉ sửa bộ nhớ và có Hoàn tác; đổi mật khẩu chỉ là xác thực biểu mẫu, không ghi lại. '
    + 'Các nhánh khác của Settings (ngoài Accounts) sẽ bổ sung sau.',
} as const

// Bản ghi (person / workspace / project) nằm ở tầng service: services/preview/preview-fixtures.ts,
// để mock store và view cùng đọc một nguồn. Trang preview dựng danh sách từ mock store
// (hooks/preview/use-preview-store.ts) chứ không import mảng cứng — file này chỉ còn
// nhãn, text ngữ cảnh và hàm suy số đếm từ danh sách đang hiển thị.
//
// Các mảng tĩnh của Home cũ (quickActions, recentActivities, universeModules, homeStatsFor,
// datasetShareFor, recentDatasetsOf) ĐÃ XÓA theo đặc tả: Home gọn còn 5 khối nên không còn
// ai đọc chúng, và `universeModules`/`homeStatsFor` từng bị ảnh mockup vẽ 7 module — giữ lại
// thành mã chết là đúng loại "module dư thừa" mà nhóm trưởng yêu cầu bỏ.
export { currentUser, storageUsage }

// Số trên stat card và nhãn tab phải suy ra từ danh sách đang hiển thị — không viết tay:
// trước đây hardcode "8 đang hoạt động" trong khi dữ liệu chỉ có 7 → bấm tab ra thiếu thẻ.
// Sau khi có menu ngữ cảnh, danh sách này còn thay đổi theo thao tác mock nên càng không
// được giữ hằng số.
const count = <T>(list: readonly T[], predicate: (item: T) => boolean): number => list.filter(predicate).length

const sum = <T>(list: readonly T[], project: (item: T) => number): number =>
  list.reduce((total, item) => total + project(item), 0)

// Một định dạng dung lượng duy nhất cho sidebar (shell) và thẻ stat của trang Workspaces:
// hai chỗ cùng đo "đã dùng bao nhiêu" mà mỗi chỗ một cách viết số thì người đọc sẽ nghĩ
// là hai con số khác nhau. `toFixed(2)` xuất dấu CHẤM thập phân trong khi mọi số khác trên
// frame này theo miền vi-VN dùng dấu PHẨY ('1.46 TB' đọc thành một nghìn bốn mươi sáu), nên
// dùng toLocaleString; TB/PB cũng phải tự escalate như `formatDataSize` làm với MB.
export const formatStorageGb = (gb: number): string =>
  gb >= 1_048_576 ? `${(gb / 1_048_576).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} PB`
    : gb >= 1_024 ? `${(gb / 1_024).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} TB`
      : `${gb.toLocaleString('vi-VN')} GB`

// Nhãn trạng thái dataset chỉ còn một nguồn duy nhất là StatusBadge (preview-primitives),
// nên hàm chuyển đổi DatasetStatus → chữ riêng ở đây đã bị xóa cùng biểu đồ dataset.

// Chủ sở hữu = đúng người dùng mẫu của frame. `currentUser` không mang id (nó là phần
// hiển thị của cùng người đó) nên so theo id của `people.anh` — so theo tên thì một người
// mới trùng tên sẽ được tính là chủ mà không ai báo.
export const myPersonId = people.anh.id

export const isOwnedByMe = (workspace: Workspace): boolean => workspace.owner.id === myPersonId

// Năm thẻ theo đúng khung 1 của ảnh "Workspace Creation with Email Suggestions": Tổng
// Workspace · Tổng Project · Sở hữu · Được chia sẻ · Thành viên. Hai điều chủ batch yêu
// cầu thay ảnh: 'Đang hoạt động' nhường chỗ cho TỔNG PROJECT, và 'Bạn sở hữu' chỉ còn
// 'Sở hữu' (vai trò Owner đã nằm ở bộ lọc vai trò).
//
// 'Tổng Project' đếm trên toàn bộ danh sách project của store, KHÔNG cộng trường `projects`
// viết tay trong fixture — đó là loại lỗi đếm đã bắt được ở trang Projects.
// 'Thành viên' là tổng SỐ THÀNH VIÊN của từng workspace (một người ở hai workspace tính hai
// lần) vì mock chưa có danh bạ toàn cục để khử trùng; dòng note dưới trang nói rõ dữ liệu mẫu.
// Ảnh vẽ delta '+12%' — số tiếp thị không có nguồn nên KHÔNG bịa, để trống (StatCard ẩn).
export const workspaceStatsFor = (state: PreviewStoreState): readonly TrendStat[] => {
  const owned = count(state.workspaces, isOwnedByMe)
  return [
    { id: 'ws-total', label: 'Tổng Workspace', value: String(state.workspaces.length), delta: '', tone: 'violet', icon: 'workspaces' },
    { id: 'ws-projects', label: 'Tổng Project', value: String(state.projects.length), delta: '', tone: 'brand', icon: 'projects' },
    { id: 'ws-owned', label: 'Sở hữu', value: String(owned), delta: '', tone: 'green', icon: 'user' },
    { id: 'ws-shared', label: 'Được chia sẻ', value: String(state.workspaces.length - owned), delta: '', tone: 'accent', icon: 'share' },
    { id: 'ws-members', label: 'Thành viên', value: String(sum(state.workspaces, workspace => workspace.members)), delta: '', tone: 'cyan', icon: 'users' },
  ]
}

export const projectStatsFor = (list: readonly Project[]): readonly TrendStat[] => [
  { id: 'pj-total', label: 'Tổng project', value: String(list.length), delta: '', tone: 'brand' },
  { id: 'pj-dataset', label: 'Tổng dataset', value: String(count(list, project => project.dataset !== null)), delta: '', tone: 'violet' },
  { id: 'pj-active', label: 'Đang hoạt động', value: String(count(list, project => project.status === 'active')), delta: '', tone: 'green' },
  { id: 'pj-paused', label: 'Tạm dừng', value: String(count(list, project => project.status === 'paused')), delta: '', tone: 'orange' },
  { id: 'pj-done', label: 'Đã hoàn thành', value: String(count(list, project => project.status === 'completed')), delta: '', tone: 'cyan' },
  { id: 'pj-archived', label: 'Đã lưu trữ', value: String(count(list, project => project.status === 'archived')), delta: '', tone: 'accent' },
]

// Số trên thẻ workspace phải khớp danh sách project thật của nó trong mock store: nếu
// đọc trường `projects` viết tay trong fixture thì panel "Dự án gần đây" liệt 2 project
// mà thẻ ghi 8 — đúng loại lỗi test số đếm đã bắt được ở trang Projects.
export const projectsOf = (state: PreviewStoreState, workspaceId: string): Project[] =>
  state.projects.filter(project => project.workspaceId === workspaceId)

export const datasetCountOf = (state: PreviewStoreState, workspaceId: string): number =>
  count(projectsOf(state, workspaceId), project => project.dataset !== null)

// ---------- Workspace detail (Design Board "workspaces detail") ----------
// Bốn stat card + donut "Phân bố trạng thái Project" của trang chi tiết workspace đọc từ
// chính danh sách project của nó trong mock store (không viết tay số như ảnh). Ba nhóm
// trạng thái theo ảnh: Chưa xử lý / Đang xử lý / Đã hoàn thành — 'processing' vào đang
// xử lý, 'completed' vào đã hoàn thành, phần còn lại (active/paused/archived) là chưa xử lý.
export type ProjectStatusBuckets = { total: number; unprocessed: number; processing: number; completed: number }
export const projectStatusBuckets = (state: PreviewStoreState, workspaceId: string): ProjectStatusBuckets => {
  const list = projectsOf(state, workspaceId)
  const processing = count(list, project => project.status === 'processing')
  const completed = count(list, project => project.status === 'completed')
  return { total: list.length, processing, completed, unprocessed: list.length - processing - completed }
}

// Bar "Tiến độ Project theo thời gian": mock chưa có mốc tuyệt đối cho từng project nên chia
// đều total vào 5 tháng gần nhất, lệch theo mã workspace để hai workspace không cho cùng một
// biểu đồ. Đây là khung hình khớp ảnh, KHÔNG phải số liệu thật — khi có API thay bằng truy vấn
// theo createdAt. Không bịa ngày cụ thể cho từng project.
export const monthlyProgressFor = (workspaceId: string, total: number): readonly { label: string; value: number }[] => {
  const seed = [...workspaceId].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const weights = [3, 2, 4, 2, 3].map((weight, index) => weight + ((seed + index) % 3))
  const sumWeights = weights.reduce((sum, weight) => sum + weight, 0)
  return weights.map((weight, index) => ({
    label: `Tháng ${index + 1}`,
    value: Math.round(total * weight / sumWeights),
  }))
}

// Roster cho modal "Quản lý thành viên": mock store chỉ giữ memberPreview (Person) + số
// members, chưa có email/ngày tham gia/role-per-workspace (chưa có Users API). Tổng hợp
// deterministic từ chính người thật trong fixture để bảng khớp ảnh mà không bịa mặt mới:
// chủ sở hữu → Owner, phần còn lại luân phiên Admin/Member/Viewer; email slug không dấu.
export type WorkspaceMemberRow = { id: string; name: string; email: string; initials: string; role: string; joinedAt: string; owner: boolean }
const slugEmail = (name: string): string => {
  // Tên không có chữ cái ASCII nào (tiếng Nhật, emoji đứng đầu) sẽ cho phần trước dấu @
  // rỗng hoặc bắt đầu bằng dấu chấm → chuỗi in ra KHÔNG phải địa chỉ hợp lệ
  // ('🚀 Phát' → '.pht@acmecorp.com'). Chặt dấu chấm hai đầu và có fallback để dòng email
  // luôn đọc được như một email thật, kể cả khi nó chỉ là số mẫu.
  // 'đ' (U+0111) là codepoint nguyên khối — NFD không tách được nên bước lọc ASCII phía sau
  // XÓA PHĂNG nó: "Phạm Văn Đức" → "pham.van.uc", "Đặng Ngọc Khoa" → "ang.ngoc.khoa". Email
  // in ra thiếu chữ cái ngay trên màn hình người dùng thấy, nên ánh xạ đ → d trước khi lọc.
  const local = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z]+/g, '.').replace(/^\.+|\.+$/g, '')
  return local || 'thanh-vien'
}
// Email của một người: bản ghi fixture không mang field `email` (suy từ tên, đúng khuôn
// danh bạ mẫu), còn người được mời bằng email gõ tay thì GIỮ NGUYÊN địa chỉ đã nhập — nói
// sai email của người dùng vẫn là sai dù chỉ trong bản mẫu.
export const emailForPerson = (person: Person): string =>
  person.email ?? `${slugEmail(person.name)}@acmecorp.com`

const memberRoleCycle = ['Member', 'Admin', 'Member', 'Viewer']
export const workspaceMemberRows = (workspace: Workspace): WorkspaceMemberRow[] => {
  const rows: WorkspaceMemberRow[] = [{
    id: workspace.owner.id, name: workspace.owner.name, initials: workspace.owner.initials,
    email: emailForPerson(workspace.owner), role: 'Owner', joinedAt: workspace.createdAt, owner: true,
  }]
  workspace.memberPreview
    .filter(person => person.id !== workspace.owner.id)
    .forEach((person, index) => rows.push({
      id: person.id, name: person.name, initials: person.initials,
      // Vai trò đã chọn ("Thêm thành viên") thắng vai trò suy theo vị trí: một người được mời
      // làm Member không được nhận badge Admin chỉ vì họ rơi vào ô thứ hai của cycle.
      email: emailForPerson(person), role: workspace.memberRoles?.[person.id] ?? memberRoleCycle[index % memberRoleCycle.length],
      joinedAt: `${String(12 + index).padStart(2, '0')}/03/2025`, owner: false,
    }))
  return rows
}

// Bộ vai trò có thể gán cho một người TRONG PROJECT (bước 3 wizard, ảnh workspaces detail vẽ
// ô chọn Admin/Member trên từng dòng). Tái dùng đúng bộ chữ modal "Quản lý thành viên" đang vẽ
// (bỏ Owner vì chủ sở hữu workspace không do ai bổ nhiệm), thêm một bảng role thứ hai là hai
// nguồn chân lý cho cùng một khái niệm.
export const projectRoleOptions: readonly string[] = ['Admin', 'Member', 'Viewer']
export const defaultProjectRole = 'Member'

// ---------- Wizard "Tạo Project" (nút "Tạo Project" trên trang chi tiết workspace) ----------
// Danh bạ người thật lấy nguyên từ fixture — mọi chip "đề xuất thành viên" chỉ chọn từ đây,
// không bịa mặt mới. personFromEmail biến một email tự nhập thành Person (chưa có Users API
// nên đây là bản ghi mẫu trong bộ nhớ tab) với tên + avatar suy từ phần trước dấu @.
export const directory: readonly Person[] = Object.values(people)

export const personFromEmail = (email: string): Person => {
  const clean = email.trim().toLowerCase()
  const handle = (clean.split('@')[0] ?? '').replace(/\+.*$/, '')
  const words = handle.split(/[._-]+/).filter(Boolean)
  const first = words[0] ?? ''
  const last = words[words.length - 1] ?? ''
  const name = words.length
    ? words.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
    : clean
  const initials = (first.charAt(0) + last.charAt(0)).toUpperCase() || clean.slice(0, 2).toUpperCase() || '??'
  return { id: `u-${handle || 'khach'}`, name, role: 'Thành viên mời qua email', initials, email: clean }
}

// Ba bảng trên Home đều tự gọi mình là "gần đây", nên chúng PHẢI sắp theo độ mới thật,
// không dựa vào thứ tự fixture. `updatedAt` trong mock là chuỗi hiển thị (chưa có API nên
// không có Date), vì vậy giải mã đúng bộ nhãn mà fixture + mock store sinh ra:
// 'vừa xong' · 'N giây/phút/giờ/ngày/tuần/tháng/năm trước'. Nhãn lạ (kể cả ngày tuyệt đối)
// được coi là CŨ NHẤT thay vì NaN: comparator trả NaN thì thứ tự sau sort không xác định.
const recencySeconds: Readonly<Record<string, number>> = {
  giây: 1, phút: 60, giờ: 3_600, ngày: 86_400, tuần: 604_800, tháng: 2_592_000, năm: 31_536_000,
}

const ageOf = (label: string): number => {
  const text = label.trim().toLowerCase()
  if (text === 'vừa xong' || text === 'hôm nay') return 0
  const match = /^(\d+(?:[.,]\d+)?) (giây|phút|giờ|ngày|tuần|tháng|năm) trước$/.exec(text)
  if (!match) return Number.MAX_SAFE_INTEGER
  return Number(match[1].replace(',', '.')) * recencySeconds[match[2]]
}

export const byNewestFirst = (a: { updatedAt: string }, b: { updatedAt: string }): number =>
  ageOf(a.updatedAt) - ageOf(b.updatedAt)

/* ---------- Bộ lọc + sắp xếp của trang Workspaces (ảnh khung 4–6) ----------
   Ba ô select thay cho hàng tab trạng thái bản cũ: ảnh không vẽ tab nào ở trang này, và
   một tab không có trong ảnh chính là 'module không có giá trị' mà chủ batch cấm thêm.
   Nhãn đặt ở tầng data (một nguồn) để view và test cùng đọc một chữ. */
export const workspaceOwnershipOptions: readonly { id: WorkspaceOwnershipFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả quyền sở hữu' },
  { id: 'owned', label: 'Workspace sở hữu' },
  { id: 'shared', label: 'Workspace được chia sẻ' },
]

export const workspaceRoleOptions: readonly { id: WorkspaceRoleFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả vai trò' },
  { id: 'Owner', label: 'Owner (Chủ sở hữu)' },
  { id: 'Admin', label: 'Admin (Quản trị)' },
  { id: 'Member', label: 'Member (Thành viên)' },
  { id: 'Viewer', label: 'Viewer (Chỉ xem)' },
]

export const workspaceSortOptions: readonly { id: WorkspaceSort; label: string }[] = [
  { id: 'accessed', label: 'Truy cập gần nhất' },
  { id: 'created', label: 'Tạo gần nhất' },
  { id: 'updated', label: 'Cập nhật gần nhất' },
  { id: 'name-asc', label: 'Tên A → Z' },
  { id: 'name-desc', label: 'Tên Z → A' },
]

// Vai trò CỦA MÌNH trong một workspace, đọc từ đúng bộ chữ mà modal 'Quản lý thành viên' đang
// vẽ (bên dưới) thay vì viết thêm một bảng role thứ hai. null = mình không có mặt trong roster
// của bản ghi mẫu → chỉ khớp 'Tất cả vai trò', không được ăn gian khớp một vai trò nào.
export const myWorkspaceRole = (workspace: Workspace): string | null =>
  workspaceMemberRows(workspace).find(row => row.id === people.anh.id)?.role ?? null

export const matchWorkspaceOwnership = (workspace: Workspace, filter: WorkspaceOwnershipFilter): boolean =>
  filter === 'all' || (filter === 'owned' ? isOwnedByMe(workspace) : !isOwnedByMe(workspace))

export const matchWorkspaceRole = (workspace: Workspace, role: WorkspaceRoleFilter): boolean =>
  role === 'all' || myWorkspaceRole(workspace) === role

// Ô tìm kiếm của trang Workspaces (khung 7 của ảnh): khớp tên hoặc mô tả, không phân biệt
// hoa/thường. Đặt ở tầng data để view và test cùng đọc một quy tắc.
export const matchWorkspaceQuery = (workspace: Workspace, query: string): boolean => {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return workspace.name.toLowerCase().includes(needle) || workspace.description.toLowerCase().includes(needle)
}

// 'dd/mm/yyyy' → số yyyyMMdd để so ngày mà không cần Date (fixture ghi ngày tuyệt đối cho
// `createdAt`, còn `updatedAt` là nhãn tương đối — hai cột hai kiểu, xem ghi chú fixture).
// 'hôm nay' (mock store ghi khi wizard "Tạo Project" thêm bản ghi mới) quy về ngày thật hôm nay
// để không bị xếp cũ nhất.
// Nhãn lạ trả -1: comparator trả NaN thì thứ tự sau sort không xác định.
const todayKey = (): number => {
  const now = new Date()
  return now.getFullYear() * 10_000 + (now.getMonth() + 1) * 100 + now.getDate()
}
const createdKey = (label: string): number => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(label.trim())
  if (match) return Number(`${match[3]}${match[2]}${match[1]}`)
  return label.trim().toLowerCase() === 'hôm nay' ? todayKey() : -1
}

// 'Truy cập gần nhất' và 'Cập nhật gần nhất' PHẢI là hai thứ khác nhau, nếu không đây là
// một bộ lọc giả. `accessedAt` do mock store ghi khi có thao tác mở thật (run('open'));
// bản ghi mẫu chưa có mốc này nên fallback `updatedAt` — đó là giới hạn của dữ liệu mẫu,
// được nói rõ trong note dưới trang chứ không phải một lỗi ẩn.
const accessedAge = (workspace: Workspace): number => ageOf(workspace.accessedAt ?? workspace.updatedAt)

export const sortWorkspaces = (list: readonly Workspace[], key: WorkspaceSort): Workspace[] => {
  const copy = [...list]
  if (key === 'name-asc') return copy.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  if (key === 'name-desc') return copy.sort((a, b) => b.name.localeCompare(a.name, 'vi'))
  if (key === 'created') return copy.sort((a, b) => createdKey(b.createdAt) - createdKey(a.createdAt))
  if (key === 'updated') return copy.sort(byNewestFirst)
  return copy.sort((a, b) => accessedAge(a) - accessedAge(b))
}

// Dự án gần đây của một workspace: lọc theo workspace rồi sắp theo `updatedAt`, không
// cắt theo thứ tự fixture nữa — đổi tên một dự án (mock store ghi 'vừa xong') phải đưa nó
// lên đầu, nếu không bảng "gần đây" sẽ liệt kê sai ngay sau thao tác đầu tiên của người dùng.
export const recentProjectsOf = (state: PreviewStoreState, workspaceId: string, limit = 4): Project[] =>
  projectsOf(state, workspaceId).slice().sort(byNewestFirst).slice(0, limit)

// ---------- Home dashboard (UI-UX/home: overview + 2 charts + 2 recent lists) ----------
// Năm thẻ "Activity Overview" suy hết từ mock store. Ảnh mockup vẽ delta (+20%…) nhưng đó
// là số tiếp thị không có nguồn — không có API nên KHÔNG bịa, để trống delta (StatCard ẩn).
// Nhãn: 'Workspaces'/'Projects' là product noun (để tiếng Anh theo đặc tả), còn ba trạng
// thái giữ nguyên bộ chữ của StatusBadge để legend/stat/badge không ba cách gọi một thứ.
export const homeOverviewStats = (state: PreviewStoreState): readonly TrendStat[] => {
  const processing = count(state.projects, project => project.status === 'processing')
  const completed = count(state.projects, project => project.status === 'completed')
  const unprocessed = state.projects.length - processing - completed
  return [
    { id: 'ov-ws', label: 'Workspaces', value: String(state.workspaces.length), delta: '', tone: 'brand' },
    { id: 'ov-prj', label: 'Projects', value: String(state.projects.length), delta: '', tone: 'accent' },
    { id: 'ov-unproc', label: 'Chưa xử lý', value: String(unprocessed), delta: '', tone: 'orange' },
    { id: 'ov-proc', label: 'Đang xử lý', value: String(processing), delta: '', tone: 'cyan' },
    { id: 'ov-done', label: 'Đã hoàn thành', value: String(completed), delta: '', tone: 'green' },
  ]
}

// Donut "Projects by Status": ba nhóm như ảnh workspace-detail — 'processing' vào đang xử lý,
// 'completed' vào đã hoàn thành, phần còn lại (active/paused/archived) là chưa xử lý.
export const projectStatusShareFor = (state: PreviewStoreState): {
  total: number
  rows: { label: string; value: number; percent: string }[]
} => {
  const total = state.projects.length
  const processing = count(state.projects, project => project.status === 'processing')
  const completed = count(state.projects, project => project.status === 'completed')
  const unprocessed = total - processing - completed
  const percent = (value: number): string => (total ? (value / total * 100).toFixed(1) : '0') + '%'
  return {
    total,
    rows: [
      { label: 'Chưa xử lý', value: unprocessed, percent: percent(unprocessed) },
      { label: 'Đang xử lý', value: processing, percent: percent(processing) },
      { label: 'Đã hoàn thành', value: completed, percent: percent(completed) },
    ],
  }
}

// Bar "Projects per Workspace": đếm project THẬT của từng workspace (projectsOf), lấy top
// `limit` nhiều nhất. Không đọc trường `projects` viết tay trong fixture — đó là loại lỗi
// đếm đã bắt được ở trang Projects.
//
// `id` đi kèm vì hai workspace ĐƯỢC PHÉP trùng tên (đổi tên trong frame không chặn trùng),
// mà key React và nhãn cột đều lấy từ tên → trùng key là React vẽ lại sai ô và người đọc
// không phân biệt được hai cột cùng chữ. Biểu đồ cần id để định danh, không cần tên.
export const projectsPerWorkspaceFor = (state: PreviewStoreState, limit = 5): readonly { id: string; label: string; value: number }[] =>
  state.workspaces
    .map(workspace => ({ id: workspace.id, label: workspace.name, value: projectsOf(state, workspace.id).length }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'vi'))
    .slice(0, limit)

// Sidebar = 3 module, theo đúng CẢ HAI ảnh trong UI-UX/Global Application Shell:
//   · Specification.png mục 1: "Hiển thị 3 module theo kiến trúc mới: Home, Workspaces, Settings"
//     (240px mở · 64px thu, mục 2: "Hiển thị 3 icon theo đúng thứ tự").
//   · Design Board.png: cả bốn khung 01–04 đều chỉ vẽ Home · Workspaces · Settings.
// Trước đây frame dựng 11 module theo ảnh UI-UX/structure_ui cũ; ảnh đó không còn trong
// UI-UX/ nữa và shell mới ghi rõ "kiến trúc mới" → shell thắng. Tám module còn lại không
// biến mất khỏi sản phẩm, chỉ không còn nằm ở nav: Projects vào từ thẻ workspace / combobox
// ở trên, Datasets và các module vũ trụ khác vào từ route 3D của T (Home đã gọn theo đặc tả
// nên không còn danh sách module ở đây). Báo lại nhóm trưởng vì đây là đổi quyết định đã chốt 31/10.
// Nhãn để tiếng Anh theo design guide; nội dung trang vẫn tiếng Việt.
export const navItems: readonly { id: PreviewSectionId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'workspaces', label: 'Workspaces' },
  { id: 'settings', label: 'Settings' },
]

// Tên cho dải "Đang mở" ở sidebar (preview-shell). Lấy đúng chữ mà chính trang đó vẽ làm
// <h1>: hai chỗ cùng gọi một màn bằng hai tên khác nhau thì người dùng không biết tên nào
// thật. Chỉ những màn KHÔNG có trong navItems (Dự án · Thông báo) mới cần dải này.
export const sectionLabels: Partial<Record<PreviewSectionId, string>> = {
  home: 'Home',
  // 'Workspaces' chứ không phải 'Không gian làm việc': ảnh khung 1 vẽ <h1> đúng chữ
  // 'Workspaces', và topbar/sidebar cũng gọi ntn — dải 'Đang mở' gọi lệch là tên thứ ba.
  workspaces: 'Workspaces',
  projects: 'Dự án',
  notifications: 'Thông báo',
  settings: 'Settings',
}

export const projectTabsFor = (list: readonly Project[]): readonly { id: ProjectFilterTab; label: string }[] => [
  { id: 'all', label: `Tất cả (${list.length})` },
  { id: 'active', label: `Đang hoạt động (${count(list, project => project.status === 'active')})` },
  { id: 'paused', label: `Tạm dừng (${count(list, project => project.status === 'paused')})` },
  { id: 'completed', label: `Đã hoàn thành (${count(list, project => project.status === 'completed')})` },
  { id: 'archived', label: `Đã lưu trữ (${count(list, project => project.status === 'archived')})` },
]

// Nhãn dòng "Loại" ở màn chi tiết + cột Loại ở màn danh sách (Design Board 1.2–1.3).
// Sắc icon chuông lấy từ `tone`, còn `kind` là chữ — hai trường độc lập có chủ đích:
// một thông báo "import" có thể tone ok hoặc warn, tô màu theo loại thì mất tin cảnh báo.
export const notificationKindLabels: Record<PreviewNotificationKind, string> = {
  processing: 'Xử lý dữ liệu', quality: 'Chất lượng dữ liệu', import: 'Nạp dữ liệu',
  export: 'Xuất dữ liệu', member: 'Thành viên', system: 'Hệ thống',
}

export const notificationTabsFor = (list: readonly PreviewNotification[]): readonly { id: NotificationFilterTab; label: string }[] => [
  { id: 'all', label: `Tất cả (${list.length})` },
  { id: 'unread', label: `Chưa đọc (${count(list, item => item.unread)})` },
  { id: 'read', label: `Đã đọc (${count(list, item => !item.unread)})` },
]

// Bộ lọc của trung tâm thông báo. Đặt ở TẦNG DATA chứ không phải trong view: cùng một
// quy tắc tab/tìm được dùng ở cả ô popover (nguồn chính) lẫn màn đầy đủ (deep-link), nên
// để hai chỗ lệch nhau là tự mâu thuẫn. Trang Notification import lại hai hàm này.
export const matchNotificationTab = (item: PreviewNotification, tab: NotificationFilterTab): boolean =>
  tab === 'all' || (tab === 'unread' ? item.unread : !item.unread)

export const matchNotificationQuery = (item: PreviewNotification, query: string): boolean => {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return item.title.toLowerCase().includes(needle)
    || item.context.toLowerCase().includes(needle)
    || item.description.toLowerCase().includes(needle)
    || notificationKindLabels[item.kind].toLowerCase().includes(needle)
}

/* ---------- Nhãn + bộ lọc cho trung tâm báo cáo (Design Board nhóm 02–03) ---------- */

export const reportIssueTypeLabels: Record<ReportIssueType, string> = {
  system: 'Sự cố hệ thống', feature: 'Lỗi chức năng', data: 'Vấn đề dữ liệu',
  suggestion: 'Góp ý / Đề xuất', other: 'Khác',
}

// Danh mục cho ô "Loại vấn đề" trong form tạo (3.1). `other` để người dùng không bị bó vào
// bốn nhóm kia; giá trị rỗng của select là "chưa chọn" nên nút Gửi phải bắt chọn (khớp dấu *).
export const reportIssueTypeOptions: readonly ReportIssueType[] = ['system', 'feature', 'data', 'suggestion', 'other']

// Nhãn + tone của chip trạng thái, khớp bốn màu ở khung 3.4 (brand=đang xử lý, orange=cần
// bổ sung, green=đã xử lý, muted=đã đóng). Dùng lại họ badge của shell, không mở màu riêng.
export const reportStatusMeta: Record<ReportStatus, { label: string; tone: 'brand' | 'warn' | 'ok' | 'muted' }> = {
  processing: { label: 'Đang xử lý', tone: 'brand' },
  'needs-info': { label: 'Cần bổ sung', tone: 'warn' },
  resolved: { label: 'Đã xử lý', tone: 'ok' },
  closed: { label: 'Đã đóng', tone: 'muted' },
}

// Tab lọc sinh từ danh sách đang có, đúng mockup 3.2 (Tất cả / Đang xử lý / Cần bổ sung / Đã
// xử lý). `closed` không có tab riêng (ảnh không vẽ) nên chỉ hiện ở "Tất cả".
export const reportTabsFor = (list: readonly PreviewReport[]): readonly { id: ReportFilterTab; label: string }[] => [
  { id: 'all', label: `Tất cả (${list.length})` },
  { id: 'processing', label: `Đang xử lý (${count(list, item => item.status === 'processing')})` },
  { id: 'needs-info', label: `Cần bổ sung (${count(list, item => item.status === 'needs-info')})` },
  { id: 'resolved', label: `Đã xử lý (${count(list, item => item.status === 'resolved')})` },
]

export const matchReportTab = (item: PreviewReport, tab: ReportFilterTab): boolean =>
  tab === 'all' || item.status === tab

export const matchReportQuery = (item: PreviewReport, query: string): boolean => {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return item.title.toLowerCase().includes(needle)
    || item.code.toLowerCase().includes(needle)
    || item.description.toLowerCase().includes(needle)
    || reportIssueTypeLabels[item.issueType].toLowerCase().includes(needle)
    || reportStatusMeta[item.status].label.toLowerCase().includes(needle)
}

// Glyph theo LOẠI, màu theo TONE. Hai trục đó khác nhau thật (một bản "nạp dữ liệu" có thể
// thành công hoặc cảnh báo) nên tô màu theo loại thì mất tin cảnh báo, còn vẽ icon theo
// màu thì mọi thông báo thành công đều thành một hình dấu tick không đọc ra gì.
export const notificationIcon = (notification: PreviewNotification): string => {
  if (notification.kind === 'quality') return 'help'
  if (notification.kind === 'import') return 'upload'
  if (notification.kind === 'export') return 'export'
  if (notification.kind === 'member') return 'users'
  if (notification.kind === 'system') return 'settings'
  return notification.tone === 'ok' ? 'check' : 'clock'
}

// Nút "Mở Project" (Design Board 1.3) tắt vì ba lý do khác nhau, phải nói đúng lý do người dùng đang gặp.
export type NoticeOpenGap = 'ok' | 'no-project' | 'project-removed'

// Lý do của control tắt ở màn chi tiết thông báo. Hai trạng thái tắt khác nhau phải nói hai
// lý do khác nhau; gộp một câu chung thì người đọc không biết mình đang thiếu gì.
// Câu cuối luôn có nên note không bao giờ rỗng — bất biến "nút tắt có lý do nhìn thấy".
export const noticeDetailReason = (gap: NoticeOpenGap, alreadyRead: boolean): string => {
  const parts: string[] = []
  if (gap === 'no-project') parts.push('Thông báo này do hệ thống gửi, không gắn project nào nên “Mở Project” tắt.')
  if (gap === 'project-removed') parts.push('Project liên quan đã bị xóa khỏi danh sách mẫu trong tab này nên “Mở Project” tắt — tải lại trang sẽ đưa nó về.')
  if (alreadyRead) parts.push('Thông báo đã ở trạng thái đã đọc nên “Đánh dấu đã đọc” tắt, bấm lại cũng không đổi gì.')
  parts.push('Trạng thái đọc và việc xóa chỉ sửa dữ liệu mẫu trong bộ nhớ tab, có Hoàn tác.')
  return parts.join(' ')
}

// Tài khoản trong dropdown topbar (mục 8 UI-UX/Global Application Shell). Tên/chức danh/viết tắt
// lấy từ đúng người dùng mẫu để avatar ở sidebar và topbar không hai bản khác nhau;
// email + ngôn ngữ + chủ đề là nhãn tĩnh của menu vì chưa có Users API/i18n/theme API.
export const accountInfo = {
  name: people.anh.name,
  initials: people.anh.initials,
  role: people.anh.role,
  email: 'minh.anh@dataverse.io',
  language: 'Tiếng Việt',
  theme: 'Tối (Dark)',
} as const

/* ---------- Nhãn cho nhánh "Accounts" của Settings (Design Board nhóm 04) ---------- */

// Sidebar phụ của "Cài đặt tài khoản" (ảnh 4.3→4.5) = ĐÚNG BA mục: Bảo mật · Đăng nhập &
// phiên · Thông báo. "Hồ sơ cá nhân" (4.2) KHÔNG nằm trong nav này — nó là màn RIÊNG reached
// từ menu tài khoản, ảnh 4.2 vẽ nó không có sidebar phụ. Đặc tả dòng 9 nói "các nhánh còn lại
// thì để sau" nên danh sách CHỈ có nhánh Accounts; view không bịa thêm.
export const settingsSections: readonly SettingsNavLeaf[] = [
  { id: 'security', label: 'Bảo mật', icon: 'shield' },
  { id: 'sessions', label: 'Đăng nhập & phiên', icon: 'monitor' },
  { id: 'notifications', label: 'Thông báo', icon: 'bell' },
]

// Cột MODULE của Settings (đặc tả + yêu cầu nhóm trưởng): vào Settings là hiện thêm một thanh
// bar kế bên chứa các module (System · Accounts · Time & Language · Update …); bấm một module
// thì mở các mục của nó. Ảnh 4.2–4.5 CHỈ vẽ nhánh Accounts nên danh sách chỉ MỘT phần tử, và
// 'profile' + 'Cài đặt tài khoản' là hai mục con của nó — không phải module ngang hàng.
// Thêm module mới (System/Time & Language/Update) = thêm một đối tượng vào mảng khi ảnh hoặc
// đặc tả vẽ nó; settings-2d.view render theo mảng nên không phải sửa view.
export const settingsModules: readonly SettingsModule[] = [
  {
    id: 'accounts',
    label: 'Accounts',
    icon: 'users',
    items: [
      { id: 'profile', label: 'Hồ sơ cá nhân', icon: 'users' },
      { label: 'Cài đặt tài khoản', icon: 'settings', children: settingsSections },
    ],
  },
]

// Mọi màn một module chứa (lá + con của nhóm) — view dùng để module tự mở khi người dùng vào
// thẳng '#/preview/settings/<mục>' và để biết module nào đang có mục active.
export const settingsSectionsOfModule = (module: SettingsModule): readonly SettingsSectionId[] =>
  module.items.flatMap(item => isSettingsNavGroup(item) ? item.children.map(child => child.id) : [item.id])

export const settingsModuleOfSection = (id: SettingsSectionId): SettingsModule | undefined =>
  settingsModules.find(module => settingsSectionsOfModule(module).includes(id))

// Bốn module của trang Project Workspace — ảnh DataVerse_Project_Workspace_Overview_v1 vẽ chúng
// HAI LẦN trong cùng một khung hình: bốn khối quanh tâm trong scene 3D và bốn nút trên thanh đáy.
// Đặc tả (UI-UX/projects/đặc tả.txt) nói rõ bấm dưới đáy "cũng tương tự như ấn vào các ô khối
// 3d", nên MỘT mảng duy nhất này là nguồn cho cả hai chỗ: thêm/sửa một module chỉ sửa đây, không
// sợ thanh đáy và scene lệch nhau (lỗi kinh điển của hai bản list viết tay).
// Nhãn + caption + tone chép NGUYÊN VĂN trong ảnh, theo thứ tự trái→phải của thanh đáy.
export const projectModules: readonly ProjectModule[] = [
  { id: 'overview', label: 'Tổng quan', caption: 'Khám phá tổng quan về dữ liệu', icon: 'grid', tone: 'violet' },
  { id: 'data-view', label: 'Data View', caption: 'Tạo và quản lý góc nhìn dữ liệu', icon: 'chart', tone: 'cyan' },
  { id: 'data-analysis', label: 'Data Analysis', caption: 'Phân tích và trực quan hóa dữ liệu', icon: 'search', tone: 'teal' },
  { id: 'detection', label: 'Detection', caption: 'Phát hiện vấn đề về chất lượng dữ liệu', icon: 'alert', tone: 'amber' },
]

export const settingsSectionLabel = (id: SettingsSectionId): string =>
  settingsSections.find(item => item.id === id)?.label ?? id

// Bốn công tắc "Tùy chọn thông báo" (4.5). key trùng với NotificationPrefs để setNotificationPref
// lấy đúng trường; caption là dòng chữ nhỏ dưới nhãn, đúng như ảnh vẽ.
export const notificationPrefRows: readonly { key: NotificationPrefKey; icon: string; label: string; caption: string }[] = [
  { key: 'system', icon: 'bell', label: 'Thông báo trong hệ thống', caption: 'Cập nhật bản vá, phiên bản mới.' },
  { key: 'projects', icon: 'projects', label: 'Dự án và xử lý dữ liệu', caption: 'Trạng thái xử lý, hoàn thành, lỗi.' },
  { key: 'quality', icon: 'help', label: 'Chất lượng dữ liệu', caption: 'Cảnh báo và vấn đề về chất lượng dữ liệu.' },
  { key: 'workspace', icon: 'users', label: 'Workspace & Project', caption: 'Thay đổi quyền, thành viên, cấu hình.' },
]

export const numberFormat = new Intl.NumberFormat('vi-VN')

// Một định dạng số duy nhất cho mọi màn: cùng một con số 1.250.000 mà thẻ
// project ghi '1,3M dòng' còn trang Project ghi '1,250,000' (toLocaleString('en-US')) thì
// người đọc nghĩ đó là hai tập dữ liệu khác nhau. Đơn vị phân tách cũng phải MỘT miền
// (vi-VN dùng dấu chấm) — đã từng có bài học ở formatStorageGb.
export const formatCount = (value: number): string => numberFormat.format(value)

/** Danh từ đếm tiếng Anh + số ít/nhiều theo đúng số đang hiển thị ('1 project' / '12 projects'). */
export const pluralEn = (value: number, singular: string): string =>
  `${numberFormat.format(value)} ${value === 1 ? singular : `${singular}s`}`

// Số bản ghi: đơn vị quyết định theo GIÁ TRỊ ĐÃ LÀM TRÒN, không theo giá trị thô.
// Bản cũ chia chẵn 1.000 rồi Math.round → 999.500 hiện thành '1000K dòng' trong khi
// 1.000.001 hiện '1M dòng': hai con số gần nhau nhất lại in ra hai kiểu khác nhau.
export const formatRows = (rows: number): string => {
  const thousands = Math.round(rows / 1_000)
  if (rows >= 1_000_000 || thousands >= 1_000) {
    return `${(rows / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}M dòng`
  }
  return rows >= 1_000 ? `${thousands}K dòng` : `${numberFormat.format(rows)} dòng`
}

// Dung lượng tập dữ liệu: fixture giữ `sizeMb` nên mọi giá trị ≥ 1024 đều phải tự
// leo đơn vị, nếu không một tệp 98.304 MB in ra '98304 MB' — 5 chữ số không dấu
// phân tách và người đọc phải tự chia lấy GB trong đầu.
export const formatDataSize = (mb: number): string =>
  mb >= 1_048_576 ? `${(mb / 1_048_576).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} TB`
    : mb >= 1_024 ? `${(mb / 1_024).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} GB`
      : `${numberFormat.format(mb)} MB`
