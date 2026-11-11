import type { PreviewRoute, PreviewRouteIds } from '../../types/preview/preview-route.types'
import type { PreviewSectionId, SettingsSectionId } from '../../types/preview/preview.types'
import { managementHref, parseManagementRoute, parseProjectRoute } from '../navigation/application-route'

// Legacy 2D URL compatibility and the existing 3D entry URL.
// Canonical management/processing rules live in navigation/application-route.ts.
// Keep this module independent of CSS, fixtures and runtime construction.

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
  (parseProjectRoute(window.location.pathname) ? { section: 'projects', projectId: parseProjectRoute(window.location.pathname), workspaceId: null, notificationId: null, settingsSection: null } : null)
  ??
  parseManagementRoute(`${window.location.pathname}${window.location.search}`)
  ?? parsePreviewRoute(window.location.hash) ?? parsePreviewRoute(window.location.pathname)
  ?? { section: 'home', workspaceId: null, projectId: null, notificationId: null, settingsSection: null }

export const readPreviewSection = (): PreviewSectionId => readPreviewRoute().section

// Old callers may still normalize on startup. New routes redirect via React Router.
const previewHashSection = /^#\/preview\/([^/?#]+)/

export const normalizePreviewHash = (): void => {
  const destination = legacyManagementRedirect(window.location.pathname, window.location.hash)
  if (destination) window.history.replaceState(null, '', destination)
}

// Compatibility adapter: existing management actions now generate canonical URLs.
export const previewHref = (section: PreviewSectionId, ids: PreviewRouteIds = {}): string =>
  managementHref(section, ids)

export const legacyManagementRedirect = (pathname: string, hash: string): string | null => {
  if (pathname === universePath) return null
  // Only migrate old preview entry points; unrelated pages/anchors stay untouched.
  const legacyPath = pathname === '/preview' || pathname.startsWith('/preview/')
  const legacyHash = previewHashSection.test(hash)
  if (!legacyPath && !(pathname === '/' && legacyHash)) return null
  const route = (legacyHash ? parsePreviewRoute(hash) : null) ?? parsePreviewRoute(pathname)
  return route ? managementHref(route.section, route) : '/management'
}

// Trang 3D của T là cả một lần tải trang (React root khác, scene Three.js khác) nên
// không đi qua hash: pathname phải giữ đúng universePath. Context của project chọn
// chuyển qua hash riêng '#project=' — main.tsx không đọc hash khi quyết định route,
// và T có thể lấy sau khi scene sẵn nhận dữ liệu thật.
export const universeUrl = (projectId?: string | null): string =>
  `${window.location.origin}${universePath}${projectId ? `#project=${projectId}` : ''}`

// Close floating surfaces even when navigating to the current URL.
export const previewNavigateEvent = 'preview-navigate'
