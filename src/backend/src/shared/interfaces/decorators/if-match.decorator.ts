import type { ExecutionContext} from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import { ValidationError } from '../../domain/errors';
import type { Request } from 'express';

/**
 * Decorator trích xuất header If-Match phục vụ Optimistic Locking khi chỉnh sửa Cell
 */
export const IfMatch = createParamDecorator(
  (required = true, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const headerValue: string | string[] | undefined = request.headers['if-match'];
    const ifMatch: string | undefined = Array.isArray(headerValue)
      ? (headerValue as string[])[0]
      : (headerValue as string | undefined);

    if (required && !ifMatch) {
      throw new ValidationError(
        'Yêu cầu header If-Match (ETag hoặc Version) để thực hiện cập nhật an toàn tránh xung đột dữ liệu'
      );
    }

    return ifMatch;
  }
);
