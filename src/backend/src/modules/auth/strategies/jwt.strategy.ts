import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { CurrentUserPayload } from '../../../shared/decorators/current-user.decorator';

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
    private readonly config: ConfigService,
    private readonly usersService: UsersService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') || 'default_jwt_secret',
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserPayload> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status === 'blocked' || user.deleted_at !== null) {
      throw new UnauthorizedException('Tài khoản không tồn tại, đã bị khóa hoặc đã bị xóa mềm');
    }

    return {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      sessionId: payload.sessionId,
    };
  }
}
