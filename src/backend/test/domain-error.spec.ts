/**
 * Unit test — hệ thống lỗi nghiệp vụ (Bước 2 — Phần 16).
 *
 * Kiểm tra 3 hợp đồng:
 *   1. `DomainError` mang mã lỗi ổn định (`SCREAMING_SNAKE_CASE`) + `details`.
 *   2. Lớp Error Mapping ánh xạ `code → HTTP status` đúng theo Phần 7 §3.4.
 *   3. Mọi mã lỗi trong `ERROR_CODES` đều có HTTP status tương ứng (không rơi
 *      vào fallback 500 ngoài ý muốn).
 */
import {
  ConflictError,
  DependencyNotConfiguredError,
  DependencyUnavailableError,
  DomainError,
  DuplicateResourceError,
  ERROR_CODES,
  ERROR_CODE_VALUES,
  FileTooLargeError,
  ForbiddenError,
  NotFoundError,
  RateLimitExceededError,
  TokenExpiredError,
  TokenInvalidError,
  UnauthenticatedError,
  ValidationError,
} from '../src/shared/domain/errors';
import {
  ERROR_CODE_TO_HTTP_STATUS,
  FALLBACK_HTTP_STATUS,
  httpStatusForErrorCode,
} from '../src/shared/interfaces/errors/error-http-mapping';
import { StatusError } from '../src/shared/application/errors';

describe('DomainError — lỗi nghiệp vụ thuần', () => {
  it('giữ đúng stack trace và prototype khi extend Error', () => {
    const err = new NotFoundError('Không tìm thấy project');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.stack).toContain('NotFoundError');
  });

  it('mỗi subclass gắn đúng mã lỗi nghiệp vụ', () => {
    expect(new ValidationError('a').code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(new NotFoundError('a').code).toBe(ERROR_CODES.NOT_FOUND);
    expect(new ConflictError('a').code).toBe(ERROR_CODES.CONFLICT);
    expect(new ForbiddenError('a').code).toBe(ERROR_CODES.FORBIDDEN);
    expect(new UnauthenticatedError('a').code).toBe(ERROR_CODES.UNAUTHENTICATED);
    expect(new TokenExpiredError('a').code).toBe(ERROR_CODES.TOKEN_EXPIRED);
    expect(new TokenInvalidError('a').code).toBe(ERROR_CODES.TOKEN_INVALID);
    expect(new RateLimitExceededError('a').code).toBe(ERROR_CODES.LIMIT_EXCEEDED);
    expect(new FileTooLargeError('a').code).toBe(ERROR_CODES.FILE_TOO_LARGE);
    expect(new DependencyUnavailableError('a').code).toBe(ERROR_CODES.DEPENDENCY_UNAVAILABLE);
    expect(new DependencyNotConfiguredError('a').code).toBe(ERROR_CODES.DEPENDENCY_NOT_CONFIGURED);
    expect(new DuplicateResourceError('a').code).toBe(ERROR_CODES.DUPLICATE_RESOURCE);
  });

  it('giữ message và details', () => {
    const err = new ValidationError('Dữ liệu sai', { field: 'email' });
    expect(err.message).toBe('Dữ liệu sai');
    expect(err.details).toEqual({ field: 'email' });
  });

  it('`details` là undefined khi không truyền (không phải null)', () => {
    const err = new NotFoundError('Không có');
    expect(err.details).toBeUndefined();
    // Quan trọng: `details` không được xuất hiện trong JSON response khi rỗng.
    expect(JSON.parse(JSON.stringify({ details: err.details }))).toEqual({});
  });

  it('`TokenExpiredError` là lỗi 401 (kế thừa `UnauthenticatedError`)', () => {
    const err = new TokenExpiredError('Hết hạn');
    expect(err).toBeInstanceOf(UnauthenticatedError);
    expect(err.code).toBe(ERROR_CODES.TOKEN_EXPIRED);
  });

  it('`TokenInvalidError` là lỗi 401 (kế thừa `UnauthenticatedError`)', () => {
    const err = new TokenInvalidError('Không hợp lệ');
    expect(err).toBeInstanceOf(UnauthenticatedError);
    expect(err.code).toBe(ERROR_CODES.TOKEN_INVALID);
  });

  it('`StatusError` ghi đè status nhưng giữ mã lỗi nghiệp vụ', () => {
    const err = new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'OAuth state sai');
    expect(err).toBeInstanceOf(DomainError);
    expect(err.status).toBe(401);
    expect(err.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(err.message).toBe('OAuth state sai');
  });
});

describe('Error Mapping — code → HTTP status', () => {
  it('ánh xạ đúng theo hợp đồng Phần 7 §3.4', () => {
    expect(httpStatusForErrorCode(ERROR_CODES.VALIDATION_ERROR)).toBe(400);
    expect(httpStatusForErrorCode(ERROR_CODES.UNAUTHENTICATED)).toBe(401);
    expect(httpStatusForErrorCode(ERROR_CODES.TOKEN_INVALID)).toBe(401);
    expect(httpStatusForErrorCode(ERROR_CODES.TOKEN_EXPIRED)).toBe(401);
    expect(httpStatusForErrorCode(ERROR_CODES.FORBIDDEN)).toBe(403);
    expect(httpStatusForErrorCode(ERROR_CODES.NOT_FOUND)).toBe(404);
    expect(httpStatusForErrorCode(ERROR_CODES.CONFLICT)).toBe(409);
    expect(httpStatusForErrorCode(ERROR_CODES.DUPLICATE_RESOURCE)).toBe(409);
    expect(httpStatusForErrorCode(ERROR_CODES.LIMIT_EXCEEDED)).toBe(429);
    expect(httpStatusForErrorCode(ERROR_CODES.FILE_TOO_LARGE)).toBe(413);
    expect(httpStatusForErrorCode(ERROR_CODES.ATTACHMENT_TOO_LARGE)).toBe(400);
    expect(httpStatusForErrorCode(ERROR_CODES.UNSUPPORTED_FILE_TYPE)).toBe(400);
    expect(httpStatusForErrorCode(ERROR_CODES.UNSUPPORTED_MEDIA_TYPE)).toBe(400);
    expect(httpStatusForErrorCode(ERROR_CODES.DEPENDENCY_UNAVAILABLE)).toBe(503);
    expect(httpStatusForErrorCode(ERROR_CODES.DEPENDENCY_NOT_CONFIGURED)).toBe(501);
    expect(httpStatusForErrorCode(ERROR_CODES.INTERNAL_ERROR)).toBe(500);
  });

  it('mã lạ → fallback 500', () => {
    expect(httpStatusForErrorCode('KHONG_CO_TRONG_BANG')).toBe(FALLBACK_HTTP_STATUS);
    expect(httpStatusForErrorCode('')).toBe(500);
  });

  it('MỌI mã lỗi trong ERROR_CODES đều có ánh xạ HTTP tường minh', () => {
    for (const code of ERROR_CODE_VALUES) {
      expect(ERROR_CODE_TO_HTTP_STATUS[code]).toBeDefined();
      expect(ERROR_CODE_TO_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
      expect(ERROR_CODE_TO_HTTP_STATUS[code]).toBeLessThan(600);
    }
  });

  it('mọi mã lỗi đều theo định dạng SCREAMING_SNAKE_CASE', () => {
    for (const code of ERROR_CODE_VALUES) {
      expect(code).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('không mã lỗi nào chứa số HTTP trong tên', () => {
    for (const code of ERROR_CODE_VALUES) {
      expect(code).not.toMatch(/\d{3}/);
    }
  });
});
