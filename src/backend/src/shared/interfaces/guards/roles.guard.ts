import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ForbiddenError } from '../../domain/errors';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { CurrentUserPayload } from '../../domain/security/current-user-payload';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user?: CurrentUserPayload }>();
    if (!user) {
      throw new ForbiddenError('Yêu cầu xác thực tài khoản để truy cập tài nguyên này');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenError(`Tài khoản không có quyền hạn cần thiết: Yêu cầu vai trò [${requiredRoles.join(', ')}]`);
    }

    return true;
  }
}
