import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import {
  USER_REPOSITORY_PORT,
  canUserLogin,
  type UserRepositoryPort,
} from '../../../users';

import { CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'admin' | 'analyst';
  sessionId?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') || 'default_jwt_secret',
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserPayload> {
    const user = await this.users.findById(payload.sub);
    if (!user || !canUserLogin(user.status, user.deletedAt)) {
      throw new UnauthorizedException('Tài khoản không tồn tại, đã bị khóa hoặc đã bị xóa mềm');
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: payload.sessionId,
    };
  }
}
