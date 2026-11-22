import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { DomainError } from '../../domain/errors/domain-error';
import { ERROR_CODES } from '../../domain/errors/error-codes';
import { StatusError } from '../../application/errors/status.error';
import { httpStatusForErrorCode } from '../errors/error-http-mapping';

/**
 * Bộ lọc lỗi toàn cục — **điểm tập trung duy nhất** của hợp đồng lỗi HTTP.
 *
 * Luồng xử lý (theo thứ tự ưu tiên):
 *   1. `DomainError` (tầng domain/application)  → ánh xạ `code → HTTP status`.
 *   2. `HttpException` (tầng presentation/framework) → giữ nguyên `getStatus()`.
 *   3. `ZodError`                                 → 400 `VALIDATION_ERROR`.
 *   4. Lỗi MongoDB duplicate key (code `11000`)   → 409 `DUPLICATE_RESOURCE`.
 *   5. `Error` khác                               → 500 `INTERNAL_ERROR`.
 *
 * Bước 2 (Bước 2 của Phần 16) đã thay toàn bộ `HttpException` ném từ tầng
 * `application`/`infrastructure` bằng `DomainError`. Nhánh `HttpException`
 * vẫn còn để phục vụ các exception do chính framework NestJS ném ra
 * (validation pipe, router, throttler) — không phải lỗi nghiệp vụ.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: unknown = 'Lỗi máy chủ nội bộ (Internal Server Error)';
    // `code` là mã lỗi nghiệp vụ hoặc mã dự phòng dạng `HTTP_<status>` cho
    // exception của framework (NestJS) — nên khai báo kiểu rộng.
    let code: string = ERROR_CODES.INTERNAL_ERROR;

    let details: unknown = undefined;
    const isThrottle =
      (exception as { name?: string })?.name === 'ThrottlerException' ||
      ((exception instanceof HttpException) && exception.getStatus() === HttpStatus.TOO_MANY_REQUESTS && String((exception as Error).message || '').includes('Throttler'));

    if (exception instanceof DomainError) {
      // ── Lỗi nghiệp vụ: mã ổn định + status do lớp Error Mapping quyết định.
      // `StatusError` được phép ghi đè status tường minh (VD: Google OAuth 401).
      status =
        exception instanceof StatusError
          ? exception.status
          : httpStatusForErrorCode(exception.code);
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as { message?: unknown; error?: string; details?: unknown; errors?: unknown };
        message = resObj.message ?? message;
        code = resObj.error ?? `HTTP_${status}`;
        details = (resObj as Record<string, unknown>).details ?? (resObj as Record<string, unknown>).errors;
        // Chuẩn hợp đồng: Zod pipe bắn { errors: [...] } -> map sang VALIDATION_ERROR + details.fields
        if (Array.isArray((resObj as Record<string, unknown>).errors) && code === `HTTP_${status}`) {
          code = ERROR_CODES.VALIDATION_ERROR;
        }
        if (Array.isArray(details) && code === ERROR_CODES.VALIDATION_ERROR) {
          details = { fields: details };
        }
        if (status === HttpStatus.TOO_MANY_REQUESTS && (isThrottle || code === `HTTP_${status}`)) {
          code = ERROR_CODES.LIMIT_EXCEEDED;
          if (message === 'ThrottlerException: Too Many Requests' || message === `HTTP_${status}`) {
            message = 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
          }
        }
      }
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = ERROR_CODES.VALIDATION_ERROR;
      message = exception.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
    } else if (exception instanceof Error) {
      message = exception.message;
      if (
        'code' in exception &&
        (exception as { code?: unknown }).code === 11000
      ) {
        status = HttpStatus.CONFLICT;
        code = ERROR_CODES.DUPLICATE_RESOURCE;
        message = 'Dữ liệu đã tồn tại trong hệ thống (Duplicate Key Error)';
      }
    }

    // Chiến lược ghi log phân tầng theo tiêu chuẩn Observability:
    // 1. Lỗi 5xx (Server Error): Ghi log ERROR kèm Stack Trace
    // 2. Lỗi 4xx (Client Error): Ghi log WARN gọn gàng, bỏ qua hoàn toàn request favicon.ico
    const formattedMessage = typeof message === 'object' ? JSON.stringify(message) : String(message);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url} - Status: ${status} - Error: ${formattedMessage}`,
        exception instanceof Error ? exception.stack : undefined
      );
    } else if (!request.url.includes('favicon.ico')) {
      this.logger.warn(
        `[${request.method}] ${request.url} - Status: ${status} - Client Error: ${formattedMessage}`
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
