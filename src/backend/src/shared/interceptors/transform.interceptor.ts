import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data: T): ApiResponse<T> => {
        const httpCtx = context.switchToHttp();
        const response = httpCtx.getResponse<Response>();
        const contentDisposition = response.getHeader('Content-Disposition');
        const contentType = response.getHeader('Content-Type');
        if (
          (typeof contentDisposition === 'string' && contentDisposition.length > 0) ||
          (typeof contentType === 'string' && contentType.includes('text/csv'))
        ) {
          return data as unknown as ApiResponse<T>;
        }

        if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
          return data as unknown as ApiResponse<T>;
        }

        return {
          success: true,
          data,
        };
      })
    );
  }
}
