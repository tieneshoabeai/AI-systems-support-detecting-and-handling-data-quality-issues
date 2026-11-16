import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

export interface CurrentUserPayload {
  userId: string;
  email: string;
  role: 'admin' | 'analyst';
  sessionId?: string;
}

/** Request đã gắn user sau khi JwtStrategy/PoliciesGuard xử lý. */
type RequestWithUser = Request & { user?: CurrentUserPayload };

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext): string | CurrentUserPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    return data ? user?.[data] : user;
  }
);
