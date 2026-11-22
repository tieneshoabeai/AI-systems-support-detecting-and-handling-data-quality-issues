import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Ghi log mỗi request kèm `X-Request-Id` (do RequestIdMiddleware gán).
 * Nhờ đó có thể đối chiếu log server với log Cloudflare Tunnel / gateway.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const requestId = (request as unknown as Record<string, unknown>).requestId;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        const trace = typeof requestId === 'string' && requestId ? ` [${requestId}]` : '';
        this.logger.log(`${trace}[${method}] ${url} - Completed in ${duration}ms`);
      }),
    );
  }
}
