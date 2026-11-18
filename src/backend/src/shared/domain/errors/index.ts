/**
 * Public contract của lớp lỗi nghiệp vụ.
 *
 * Tầng `application` và `presentation` chỉ import qua `index.ts` này để giữ
 * hợp đồng ổn định khi cấu trúc file nội bộ thay đổi (CA8 — cross-module
 * import phải đi qua public contract).
 */

export {
  DomainError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  UnauthenticatedError,
  TokenExpiredError,
  TokenInvalidError,
  RateLimitExceededError,
  DependencyUnavailableError,
  DependencyNotConfiguredError,
  FileTooLargeError,
  DuplicateResourceError,
} from './domain-error';

export { ERROR_CODES, ERROR_CODE_VALUES, type ErrorCode } from './error-codes';
