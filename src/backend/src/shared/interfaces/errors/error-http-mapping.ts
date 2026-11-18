import { ERROR_CODES, type ErrorCode } from '../../domain/errors/error-codes';

/**
 * Lớp Error Mapping — **ranh giới duy nhất** trong hệ thống được phép biết
 * "mã lỗi nghiệp vụ này tương ứng với HTTP status nào".
 *
 * Vì sao đặt ở `shared/interfaces/`?
 *   - `shared/domain/` phải **thuần tuyệt đối** (CA13) — không được biết HTTP.
 *   - `shared/infrastructure/` là adapter kỹ thuật — không biết ngữ nghĩa lỗi nghiệp vụ.
 *   - `shared/interfaces/` là tầng giao diện framework (NestJS) — nơi HTTP
 *     status và response body thuộc về.
 *
 * Bảng ánh xạ bám sát hợp đồng API — Phần 7 §3.4.
 *
 * | Mã lỗi | HTTP | Nguồn |
 * |---|---|---|
 * | `VALIDATION_ERROR` | 400 | Phần 3 §3.1 |
 * | `UNAUTHENTICATED` | 401 | Phần 3 §3.1 |
 * | `TOKEN_INVALID` | 401 | Phần 3 §3.1 |
 * | `TOKEN_EXPIRED` | 401 | Phần 3 §3.1 |
 * | `FORBIDDEN` | 403 | Phần 3 §3.1 |
 * | `NOT_FOUND` | 404 | Phần 3 §3.1 |
 * | `CONFLICT` | 409 | Phần 3 §3.1 |
 * | `LIMIT_EXCEEDED` | 429 | Phần 3 §3.1 |
 * | `DEPENDENCY_UNAVAILABLE` | 503 | Phần 3 §3.1 |
 * | `INTERNAL_ERROR` | 500 | Mặc định |
 */

/**
 * Số HTTP tương ứng từng mã lỗi nghiệp vụ.
 *
 * Ghi chú về `DEPENDENCY_NOT_CONFIGURED`:
 *   Tài liệu Phần 7 §3.4 liệt kê `DEPENDENCY_UNAVAILABLE` → 503, nhưng
 *   `GET /auth/google` khi **thiếu credential** phải trả **501** (tính năng
 *   có, chưa cấu hình) — khác với **503** (đã cấu hình nhưng dịch vụ ngoài
 *   đang chết). Vì vậy tách thành 2 mã riêng:
 *     - `DEPENDENCY_NOT_CONFIGURED` → 501
 *     - `DEPENDENCY_UNAVAILABLE`   → 503
 */
export const ERROR_CODE_TO_HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.UNAUTHENTICATED]: 401,
  [ERROR_CODES.TOKEN_INVALID]: 401,
  [ERROR_CODES.TOKEN_EXPIRED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.CONFLICT]: 409,
  [ERROR_CODES.DUPLICATE_RESOURCE]: 409,
  [ERROR_CODES.LIMIT_EXCEEDED]: 429,
  [ERROR_CODES.FILE_TOO_LARGE]: 413,
  [ERROR_CODES.ATTACHMENT_TOO_LARGE]: 400,
  [ERROR_CODES.ANALYSIS_TOO_LARGE]: 413,
  [ERROR_CODES.UNSUPPORTED_FILE_TYPE]: 400,
  [ERROR_CODES.UNSUPPORTED_MEDIA_TYPE]: 400,
  [ERROR_CODES.DEPENDENCY_UNAVAILABLE]: 503,
  [ERROR_CODES.DEPENDENCY_NOT_CONFIGURED]: 501,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
};

/** HTTP status dùng khi mã lỗi không nằm trong bảng (phòng thủ). */
export const FALLBACK_HTTP_STATUS = 500;

/**
 * Ánh xạ mã lỗi nghiệp vụ → HTTP status.
 *
 * @param code Mã lỗi nghiệp vụ.
 * @returns HTTP status tương ứng; `500` nếu mã không xác định.
 */
export function httpStatusForErrorCode(code: string): number {
  return (
    ERROR_CODE_TO_HTTP_STATUS[code as ErrorCode] ??
    (FALLBACK_HTTP_STATUS as number)
  );
}
