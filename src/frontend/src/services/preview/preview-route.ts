import type { PreviewRoute, PreviewRouteIds } from '../../types/preview/preview-route.types'
import type { PreviewSectionId, SettingsSectionId } from '../../types/preview/preview.types'

// Route của frame preview 2D nằm ở tầng service (không phải view) vì cả main.tsx,
// preview-entry, shell lẫn session hook đều cần đọc/ghi URL. Để ở view thì hook
// phải import ngược lên view — phá chiều phụ thuộc View → Hook → Service.
//
// Module này không được import CSS hay fixture: main.tsx tham chiếu tĩnh nó trước
// nhánh import.meta.env.DEV, nên bất cứ thứ gì kéo theo preview.css sẽ vào build thật.

export const twoDPreviewSections: readonly PreviewSectionId[] = ['home', 'workspaces', 'projects', 'notifications', 'settings']

// Trang phẳng (notifications · settings): segment sau tên section KHÔNG phải workspace.
// Thông báo không thuộc một workspace nào nên '#/preview/notifications/prj-x' mà diễn giải
// theo phân cấp cũ sẽ hiểu sai cả hai trường; Settings thì segment sau nó là mục con
// "Accounts" (profile/security/...). parsePreviewRoute xử lý riêng từng loại ở dưới.

// Route 3D của T: pathname chính xác, không có segment sau. main.tsx so sánh
// pathname === universePath nên mọi helper ở đây phải giữ nguyên điều đó.
export const universePath = '/preview/workspaces-3d'

// main.tsx đưa vào chuỗi nối `${pathname}${hash}` — khi cả hai đều là route preview
// thì segment sau '/preview/' mang nốt ';' hoặc '#' (dạng 'home#/preview/home'),
// nên cắt mỗi token tại ký tự không thuộc bảng slug và lấy 'preview' CUỐI cùng làm gốc.
const cleanToken = (token: string): string => token.replace(/[^0-9A-Za-z_-].*$/, '')

const routeSegments = (source: string): string[] => {
  const parts = source.split('/').filter(Boolean).map(cleanToken)
  const at = parts.lastIndexOf('preview')
  return at === -1 ? [] : parts.slice(at + 1)
}

// '[0]' chứ không phải destructuring có default: segment thiếu phải là null để
// readPreviewRoute biết mà giữ selection hiện tại thay vì nhảy về workspace đầu.
const settingsSectionValues: readonly SettingsSectionId[] = ['profile', 'security', 'sessions', 'notifications', 'color']

export const parsePreviewRoute = (source: string): PreviewRoute | null => {
  const segments = routeSegments(source)
  const section = twoDPreviewSections.find(item => item === segments[0])
  if (!section) return null
  if (section === 'notifications') return { section, workspaceId: null, projectId: null, notificationId: segments[1] ?? null, settingsSection: null }
  if (section === 'settings') {
    // Mục con không thuộc danh sách (gõ tay '#/preview/settings/xyz') → null để view rơi về
    // mặc định, thay vì render một branch không tồn tại.
    const settingsSection = settingsSectionValues.find(item => item === segments[1]) ?? null
    return { section, workspaceId: null, projectId: null, notificationId: null, settingsSection }
  }
  return { section, workspaceId: segments[1] ?? null, projectId: segments[2] ?? null, notificationId: null, settingsSection: null }
}

// 'workspaces-3d' là một slug nguyên khối ([0-9A-Za-z_-]+), không khớp 'workspaces'
// nên route của T không bao giờ bị nhận là frame 2D.
export const is2DPreviewUrl = (url: string): boolean => parsePreviewRoute(url) !== null

export const readPreviewRoute = (): PreviewRoute =>
  parsePreviewRoute(window.location.hash) ?? parsePreviewRoute(window.location.pathname)
  ?? { section: 'home', workspaceId: null, projectId: null, notificationId: null, settingsSection: null }

export const readPreviewSection = (): PreviewSectionId => readPreviewRoute().section

// '#/preview/settings' (mục có thật trong sidebar nhưng batch này chưa dựng màn) và
// '#/preview/homes' (gõ nhầm) đều parse ra null → readPreviewRoute rơi về Home. Kết quả là
// màn hình hiện Home trong khi URL nói một chỗ khác: copy link gửi cho nhóm là một lời hứa
// sai. Viết lại hash về đúng màn đang hiện để URL và nội dung không lệch nhau.
// Chỉ đụng hash mở đầu bằng '#/preview/'. Route 3D của T quyết định bằng PATHNAME
// (universePath, main.tsx dòng is3DPreview) và mang hash riêng '#project=…' — không chuỗi
// nào khớp mẫu này, nên phần của họ không bao giờ bị sửa. '#/preview/workspaces-3d' thì
// KHÔNG phải của T: frame 2D không mount cho hash đó lúc tải trang, còn nếu người dùng gõ
// vào khi đang ở trong frame thì nội dung hiện là Home — đúng ra phải sửa hash về Home.
const previewHashSection = /^#\/preview\/([^/?#]+)/

export const normalizePreviewHash = (): void => {
  const hash = window.location.hash
  if (!previewHashSection.test(hash)) return
  if (parsePreviewRoute(hash) !== null) return
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/preview/home`)
}

// Hash route: F5 vẫn đúng trang, và production build không cần server rewrite.
// projectId chỉ có nghĩa khi đã có workspaceId (đường dẫn phân cấp workspace → project).
export const previewHref = (section: PreviewSectionId, ids: PreviewRouteIds = {}): string => {
  if (section === 'notifications') {
    const notificationId = ids.notificationId ?? null
    return `#/preview/${section}${notificationId ? `/${notificationId}` : ''}`
  }
  if (section === 'settings') {
    const settingsSection = ids.settingsSection ?? null
    return `#/preview/${section}${settingsSection ? `/${settingsSection}` : ''}`
  }
  const workspaceId = ids.workspaceId ?? null
  const projectId = workspaceId ? ids.projectId ?? null : null
  return `#/preview/${section}${workspaceId ? `/${workspaceId}` : ''}${projectId ? `/${projectId}` : ''}`
}

// Trang 3D của T là cả một lần tải trang (React root khác, scene Three.js khác) nên
// không đi qua hash: pathname phải giữ đúng universePath. Context của project chọn
// chuyển qua hash riêng '#project=' — main.tsx không đọc hash khi quyết định route,
// và T có thể lấy sau khi scene sẵn nhận dữ liệu thật.
export const universeUrl = (projectId?: string | null): string =>
  `${window.location.origin}${universePath}${projectId ? `#project=${projectId}` : ''}`

// "Vừa có một chuyến đi trong frame" — tín hiệu cho surface nổi (popover · menu · combobox)
// tự khép lại. `hashchange` chỉ fire khi hash THỰC SỰ đổi, mà điều hướng vẫn là một lệnh hợp lệ
// khi người dùng đã đứng ở đích: bấm "Mở Project" của chính project đang mở trong popover thông
// báo. Không có tín hiệu thì popover treo nguyên trên trang vừa mở. openSection phát event này
// VÔ ĐIỀU KIỆN nên quy tắc "điều hướng thì đóng surface" không phụ thuộc trình duyệt đổi hash.
export const previewNavigateEvent = 'preview-navigate'
