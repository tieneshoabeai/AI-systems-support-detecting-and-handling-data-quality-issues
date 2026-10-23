import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';

/**
 * Decorator trích xuất header If-Match phục vụ Optimistic Locking khi chỉnh sửa Cell
 */
export const IfMatch = createParamDecorator(
  (required = true, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const ifMatch = request.headers['if-match'];

    if (required && !ifMatch) {
      throw new BadRequestException(
        'Yêu cầu header If-Match (ETag hoặc Version) để thực hiện cập nhật an toàn tránh xung đột dữ liệu'
      );
    }

    return ifMatch;
  }
);
