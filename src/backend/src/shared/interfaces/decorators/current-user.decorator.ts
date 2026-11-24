import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentUserPayload } from '../../domain/security/current-user-payload';

/**
 * `CurrentUserPayload` được khai báo ở `shared/domain/security/current-user-payload.ts`
 * (tầng Domain) vì cả `JwtStrategy` (infrastructure) lẫn decorator/guard
 * (interfaces) đều cần đến nó.
 *
 * Vẫn re-export tại đây để giữ public contract cũ của decorator.
 */
export type { CurrentUserPayload };

/** Request đã gắn user sau khi JwtStrategy/PoliciesGuard xử lý. */
type RequestWithUser = Request & { user?: CurrentUserPayload };

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext): string | CurrentUserPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    return data ? user?.[data] : user;
  }
);
