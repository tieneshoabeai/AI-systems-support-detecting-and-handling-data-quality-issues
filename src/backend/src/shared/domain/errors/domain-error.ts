import { ERROR_CODES, type ErrorCode } from './error-codes';

/**
 * `DomainError` — lỗi nghiệp vụ thuần TypeScript.
 *
 * **Vì sao cần lớp này?**
 * Trước Bước 2, tầng `application` ném `HttpException` của NestJS
 * (`NotFoundException`, `BadRequestException`, …). Mỗi lần ném là một ràng
 * buộc tới framework ở **tầng trung** — tầng vốn không nên biết gì về HTTP.
 *
 * `DomainError` thay thế chúng với 3 đặc tính:
 *   1. **Thuần** — không import framework, không biết HTTP status.
 *   2. **Ổn định** — mang `code` nghiệp vụ (`SCREAMING_SNAKE_CASE`) là hợp đồng
 *      mà frontend & test dựa vào (Phần 7 §3.4).
 *   3. **Có cấu trúc** — `details` mang ngữ cảnh phụ trợ (VD: `expectedVersion`).
 *
 * **Ai ánh xạ sang HTTP?**
 * Tầng presentation — `src/shared/interfaces/errors/error-http-mapping.ts`
 * ánh xạ `code → HTTP status`. Đó là ranh giới duy nhất trong hệ thống
 * được phép biết "404 nghĩa là gì".
 *
 * **Dùng thế nào?**
 * ```ts
 * throw new NotFoundError('Không tìm thấy project');
 * throw new ValidationError('Thiếu expectedVersion', { expectedVersion, actualVersion });
 * throw new DomainError(ERROR_CODES.CONFLICT, 'Bản ghi đã bị thay đổi');
 * ```
 */
export class DomainError extends Error {
  /**
   * Mã lỗi nghiệp vụ — ổn định, không phụ thuộc HTTP.
   *
   * Không khai báo `readonly` vì một số subclass cần **tinh chỉnh mã** của lớp
   * cha (VD: `TokenExpiredError extends UnauthenticatedError` đổi mã từ
   * `UNAUTHENTICATED` sang `TOKEN_EXPIRED` nhưng vẫn là lỗi 401).
   */
  code: ErrorCode;

  /** Ngữ cảnh phụ trợ cho frontend (VD: `{ field, reason, expectedVersion }`). */
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
    // Giữ stack sạch khi target bị transpile xuống ES5.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Lỗi dữ liệu đầu vào không hợp lệ — định dạng sai, thiếu trường, tham số
 * ngoài giá trị cho phép. Ứng với HTTP 400.
 */
export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.VALIDATION_ERROR, message, details);
  }
}

/**
 * Không tìm thấy tài nguyên — hoặc người gọi không được phép biết nó tồn tại
 * (tránh lộ sự tồn tại của id). Ứng với HTTP 404.
 */
export class NotFoundError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.NOT_FOUND, message, details);
  }
}

/**
 * Xung đột trạng thái — optimistic locking, email trùng, định danh đã bị chiếm.
 * Ứng với HTTP 409.
 */
export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.CONFLICT, message, details);
  }
}

/**
 * Đã xác thực nhưng không đủ quyền. Ứng với HTTP 403.
 */
export class ForbiddenError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.FORBIDDEN, message, details);
  }
}

/**
 * Chưa xác thực — thiếu token, token sai, hoặc phiên đăng nhập không còn hiệu lực.
 * Ứng với HTTP 401.
 *
 * Lưu ý phân biệt với `ForbiddenError`:
 *   - `UnauthenticatedError` → "tao không biết mày là ai"
 *   - `ForbiddenError`     → "tao biết mày là ai, nhưng mày không được làm việc này"
 */
export class UnauthenticatedError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.UNAUTHENTICATED, message, details);
  }
}

/**
 * Access token đã hết hạn — người dùng cần refresh hoặc đăng nhập lại.
 * Ứng với HTTP 401.
 *
 * Tách khỏi `UnauthenticatedError` vì frontend cần phân biệt:
 *   - `TOKEN_EXPIRED` → **tự động refresh** rồi retry.
 *   - `UNAUTHENTICATED` → buộc đăng nhập lại.
 */
export class TokenExpiredError extends UnauthenticatedError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.code = ERROR_CODES.TOKEN_EXPIRED;
  }
}

/**
 * Access token không hợp lệ — sai chữ ký, sai issuer, đã bị thu hồi, hoặc
 * phát hiện tái sử dụng refresh token (refresh token reuse detection).
 * Ứng với HTTP 401.
 *
 * Khác `TokenExpiredError`: token hợp lệ về mặt hình thức nhưng đã bị vô hiệu
 * hoá → **không** thể refresh, buộc đăng nhập lại.
 */
export class TokenInvalidError extends UnauthenticatedError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.code = ERROR_CODES.TOKEN_INVALID;
  }
}

/**
 * Vượt hạn mức — tần suất gửi OTP, quota dung lượng workspace, số workspace
 * tối đa. Ứng với HTTP 429.
 */
export class RateLimitExceededError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.LIMIT_EXCEEDED, message, details);
  }
}

/**
 * Dịch vụ ngoài không khả dụng — mạng lỗi, timeout, phản hồi rác.
 * Ứng với HTTP 503.
 */
export class DependencyUnavailableError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.DEPENDENCY_UNAVAILABLE, message, details);
  }
}

/**
 * Dịch vụ ngoài chưa được cấu hình — thiếu credential hoặc biến môi trường.
 * Ứng với HTTP 501 (Not Implemented — tính năng có, nhưng chưa có cấu hình).
 */
export class DependencyNotConfiguredError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.DEPENDENCY_NOT_CONFIGURED, message, details);
  }
}

/**
 * Tệp vượt quá giới hạn kích thước. Ứng với HTTP 413.
 */
export class FileTooLargeError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.FILE_TOO_LARGE, message, details);
  }
}

/**
 * Bản ghi đã tồn tại (duplicate key) — phát hiện ở tầng hạ tầng khi ghi DB.
 * Ứng với HTTP 409.
 */
export class DuplicateResourceError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.DUPLICATE_RESOURCE, message, details);
  }
}
