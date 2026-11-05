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

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: unknown = 'Lỗi máy chủ nội bộ (Internal Server Error)';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as { message?: unknown; error?: string };
        message = resObj.message ?? message;
        code = resObj.error ?? `HTTP_${status}`;
      }
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'ZOD_VALIDATION_ERROR';
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
        code = 'DUPLICATE_RESOURCE';
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
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
