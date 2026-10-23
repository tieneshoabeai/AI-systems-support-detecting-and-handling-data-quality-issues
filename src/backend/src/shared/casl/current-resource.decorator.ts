import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator trích xuất đối tượng tài nguyên (Resource) đã được nạp sẵn từ PoliciesGuard
 * Giúp Controller/Service sử dụng lại ngay mà không cần truy vấn lại CSDL (loại bỏ Double Query)
 */
export const CurrentResource = createParamDecorator(
  <T = unknown>(_data: unknown, ctx: ExecutionContext): T | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.resource as T;
  }
);
