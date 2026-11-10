import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/application/users.service';

export interface RealtimeClientIdentity {
  userId: string;
  email: string;
  role: string;
}

/**
 * REALTIME-01 — Xác thực handshake WebSocket (Phần 7 v6 §3.17.2).
 * WebSocket không gửi header custom trong trình duyệt nên token nằm ở query param
 * `?token=<accessToken>` (fallback `auth.token` của Socket.IO).
 * Token hết hạn 15 phút → client phải kết nối lại bằng token mới.
 * Thất bại → từ chối handshake, client nhận mã 4401.
 */
@Injectable()
export class RealtimeAuthService {
  private readonly logger = new Logger(RealtimeAuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  extractToken(handshake: {
    auth?: Record<string, unknown>;
    query?: Record<string, unknown>;
  }): string | null {
    const fromAuth = handshake.auth?.['token'];
    if (typeof fromAuth === 'string' && fromAuth.trim().length > 0) return fromAuth.trim();
    const fromQuery = handshake.query?.['token'];
    if (typeof fromQuery === 'string' && fromQuery.trim().length > 0) return fromQuery.trim();
    if (Array.isArray(fromQuery) && typeof fromQuery[0] === 'string' && (fromQuery[0] as string).trim().length > 0) {
      return (fromQuery[0] as string).trim();
    }
    return null;
  }

  async verifyToken(token: string): Promise<RealtimeClientIdentity> {
    const secret = this.config.get<string>('JWT_ACCESS_SECRET') ?? 'default_jwt_secret';
    let payload: Record<string, unknown>;
    try {
      const decoded = await this.jwtService.verifyAsync(token, { secret });
      payload = decoded as Record<string, unknown>;
    } catch {
      throw new Error('4401: token không hợp lệ hoặc đã hết hạn');
    }
    const sub = payload['sub'];
    if (typeof sub !== 'string' || sub.trim().length === 0) {
      throw new Error('4401: token thiếu định danh người dùng');
    }
    const user = await this.usersService.findById(sub);
    if (!user || user.status === 'blocked' || user.deletedAt !== null) {
      throw new Error('4401: tài khoản không tồn tại, đã bị khóa hoặc đã xóa');
    }
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
