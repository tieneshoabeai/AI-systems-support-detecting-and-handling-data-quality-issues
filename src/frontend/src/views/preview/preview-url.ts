// Tương thích lối ra cũ: quy tắc route đã chuyển xuống services/preview/preview-route.ts
// để hook và shell dùng chung mà không import ngược lên tầng view.
// Chỉ re-export hàm thuần; không nạp CSS, fixture hay khởi tạo runtime.
export {
  is2DPreviewUrl, normalizePreviewHash, previewHref, readPreviewRoute, readPreviewSection,
  twoDPreviewSections, universePath, universeUrl,
} from '../../services/preview/preview-route'
