/**
 * Mã lỗi nghiệp vụ — `SCREAMING_SNAKE_CASE` (hợp đồng Phần 7 §3.3).
 *
 * **Tầng domain không biết HTTP.** Ở đây chỉ khai báo *mã lỗi nghiệp vụ*;
 * ánh xạ `code → HTTP status` nằm ở tầng giao diện framework
 * (`src/shared/interfaces/errors/error-http-mapping.ts`).
 *
 * Vì vậy:
 *   - Tên mã **không** chứa số HTTP (`NOT_FOUND` chứ không phải `HTTP_404`).
 *   - Tên mã **không** chứa từ khoá HTTP (`VALIDATION_ERROR` chứ không phải
 *     `BAD_REQUEST`) — vì "dữ liệu sai định dạng" là một khái niệm nghiệp vụ,
 *     còn "400" là khái niệm của giao thức.
 *
 * Danh sách này là hợp đồng ổn định: frontend và test kiểm tra `code`,
 * không kiểm tra `message` (Phần 7 §3.4 — quy tắc 1).
 */

/**
 * Mã lỗi nghiệp vụ dùng chung toàn hệ thống.
 *
 * Nhóm theo ý nghĩa nghiệp vụ:
 *   - Dữ liệu đầu vào    → `VALIDATION_ERROR`
 *   - Xác thực / quyền   → `UNAUTHENTICATED`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `FORBIDDEN`
 *   - Vòng đời dữ liệu   → `NOT_FOUND`, `CONFLICT`
 *   - Hạn mức / tài nguyên → `LIMIT_EXCEEDED`, `FILE_TOO_LARGE`, `ATTACHMENT_TOO_LARGE`
 *   - Định dạng tệp      → `UNSUPPORTED_FILE_TYPE`, `UNSUPPORTED_MEDIA_TYPE`
 *   - Hệ thống ngoài     → `DEPENDENCY_NOT_CONFIGURED`, `DEPENDENCY_UNAVAILABLE`
 *   - Nội bộ             → `INTERNAL_ERROR`, `DUPLICATE_RESOURCE`
 */
export const ERROR_CODES = {
  /** Dữ liệu gửi lên không hợp lệ (định dạng, ràng buộc nghiệp vụ, tham số sai). */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** Chưa xác thực / phiên đăng nhập không hợp lệ hoặc đã hết hạn. */
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  /** Access token không hợp lệ (sai chữ ký, sai issuer, đã bị thu hồi). */
  TOKEN_INVALID: 'TOKEN_INVALID',
  /** Access token đã hết hạn. */
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  /** Đã xác thực nhưng không đủ quyền thực hiện thao tác. */
  FORBIDDEN: 'FORBIDDEN',
  /** Không tìm thấy tài nguyên (hoặc không được phép biết nó tồn tại). */
  NOT_FOUND: 'NOT_FOUND',
  /** Xung đột trạng thái: optimistic locking, email trùng, liên kết đã chiếm. */
  CONFLICT: 'CONFLICT',
  /** Vượt hạn mức (tần suất, quota dung lượng, số workspace tối đa). */
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  /** Tệp vượt quá giới hạn kích thước cho phép. */
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  /** Tệp đính kèm vượt quá giới hạn kích thước cho phép. */
  ATTACHMENT_TOO_LARGE: 'ATTACHMENT_TOO_LARGE',
  /**
   * Payload phân tích vượt quá giới hạn an toàn của máy (GĐ0 — chống quá tải).
   *
   * Dataset có `rowCount` vượt `ANALYSIS_MAX_ROWS` sẽ bị từ chối **trước khi**
   * đọc record nào từ MongoDB, tránh peak-RAM vài GB gây OOM / quá nhiệt CPU.
   * Ứng với HTTP 413.
   */
  ANALYSIS_TOO_LARGE: 'ANALYSIS_TOO_LARGE',
  /** Định dạng tệp không được hỗ trợ (chỉ nhận CSV…). */
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  /** Kiểu media của tệp đính kèm không được hỗ trợ. */
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  /**
   * Dịch vụ ngoài **chưa được cấu hình** — thiếu credential hoặc biến môi trường.
   * Khác với `DEPENDENCY_UNAVAILABLE`: tính năng có, nhưng chưa có cấu hình.
   */
  DEPENDENCY_NOT_CONFIGURED: 'DEPENDENCY_NOT_CONFIGURED',
  /** Dịch vụ ngoài **không khả dụng** — đã cấu hình nhưng mạng lỗi / timeout / phản hồi rác. */
  DEPENDENCY_UNAVAILABLE: 'DEPENDENCY_UNAVAILABLE',
  /** Bản ghi đã tồn tại (duplicate key) — phát hiện ở tầng hạ tầng. */
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  /** Lỗi nội bộ không phân loại được. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/** Kiểu union của toàn bộ mã lỗi nghiệp vụ hợp lệ. */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Danh sách mã lỗi hợp lệ (runtime) — dùng để validate ở biên. */
export const ERROR_CODE_VALUES: readonly ErrorCode[] = Object.values(
  ERROR_CODES,
) as readonly ErrorCode[];
