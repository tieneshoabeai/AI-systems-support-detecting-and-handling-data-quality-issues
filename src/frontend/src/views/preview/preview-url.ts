// Tương thích lối ra cũ: quy tắc route đã chuyển xuống services/preview/preview-route.ts
// để hook và shell dùng chung mà không import ngược lên tầng view.
// main.tsx vẫn import file này — nó chỉ re-export hàm thuần, không kéo theo CSS/fixture,
// nên nhánh import.meta.env.DEV === false bị loại sạch khi build production.
export {
  is2DPreviewUrl, normalizePreviewHash, previewHref, readPreviewRoute, readPreviewSection,
  twoDPreviewSections, universePath, universeUrl,
} from '../../services/preview/preview-route'
export type { PreviewRoute, PreviewRouteIds } from '../../services/preview/preview-route'
