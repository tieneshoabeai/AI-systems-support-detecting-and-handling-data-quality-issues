import { Inject, Injectable, UnauthorizedException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_BYTES,
  isAccountLocked,
  refreshTokenExpiry,
} from '../domain/value-objects/auth-policy.vo';
import { computeSha256Buffer } from '../../../shared/crypto/crypto.util';
import { detectDeviceName } from '../../../shared/utils/device-detector.util';
import {
  AUTH_TOKEN_ISSUER_PORT,
  AUTH_USER_LOOKUP_PORT,
  PASSWORD_HASHER_PORT,
  type AuthTokenIssuerPort,
  type AuthUserLookupPort,
  type PasswordHasherPort,
} from '../domain/ports/auth-session.port';
import {
  AUTH_SESSION_PORT,
  type AuthSessionPort,
} from '../domain/ports/auth-session.port';

export interface RegisterInput { email: string; password: string; first_name: string; last_name: string; role?: 'admin' | 'analyst' }
export interface LoginInput { email: string; password: string }

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(AUTH_USER_LOOKUP_PORT) private readonly users: AuthUserLookupPort,
    @Inject(AUTH_SESSION_PORT) private readonly sessions: AuthSessionPort,
    @Inject(PASSWORD_HASHER_PORT) private readonly hasher: PasswordHasherPort,
    @Inject(AUTH_TOKEN_ISSUER_PORT) private readonly tokens: AuthTokenIssuerPort,
  ) {}

  async register(dto: RegisterInput) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email này đã được sử dụng bởi một tài khoản khác');
    }
    const passwordHash = await this.hasher.hash(dto.password);
    const created = await this.users.create({
      email,
      passwordHash,
      firstName: dto.first_name,
      lastName: dto.last_name,
      role: dto.role,
    });
    return {
      id: created.id,
      email: created.email,
      first_name: dto.first_name,
      last_name: dto.last_name,
      role: created.role,
      created_at: (created as unknown as { createdAt?: Date }).createdAt ?? new Date(),
    };
  }

  async login(dto: LoginInput, ipAddress?: string, userAgent?: string) {
    const user = await this.users.findByEmail(dto.email, true);
    if (!user || !user.passwordHash) throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    if (isAccountLocked(user.status)) throw new UnauthorizedException('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
    const ok = await this.hasher.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    const rawRefreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const refreshTokenHash = computeSha256Buffer(rawRefreshToken);
    const expiresAt = refreshTokenExpiry();
    const resolvedDeviceName = detectDeviceName(userAgent);
    const session = await this.sessions.createSession({
      userId: user.id,
      refreshTokenHash,
      deviceName: resolvedDeviceName,
      ipAddress,
      userAgent,
      expiresAt,
    });
    const accessToken = this.tokens.sign({ sub: user.id, email: user.email, role: user.role, sessionId: session.id });
    return {
      access_token: accessToken,
      refresh_token: rawRefreshToken,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      device_name: resolvedDeviceName,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  async refreshAccessToken(rawRefreshToken: string) {
    const refreshTokenHash = computeSha256Buffer(rawRefreshToken);
    const session = await this.sessions.findSessionByTokenHash(refreshTokenHash);
    if (!session) throw new UnauthorizedException('Refresh token không hợp lệ hoặc phiên đăng nhập đã hết hạn');
    const user = await this.users.findById(session.userId);
    if (!user || isAccountLocked(user.status) || user.deletedAt !== null) {
      throw new UnauthorizedException('Tài khoản liên kết không còn hoạt động');
    }
    const newAccessToken = this.tokens.sign({ sub: user.id, email: user.email, role: user.role, sessionId: session.id });
    return { access_token: newAccessToken, expires_in: ACCESS_TOKEN_TTL_SECONDS };
  }

  async logout(sessionId?: string) {
    if (sessionId) await this.sessions.revokeSessionById(sessionId);
    return { message: 'Đăng xuất thành công' };
  }

  async getSessions(userId: string) {
    return this.sessions.findActiveSessions(userId);
  }

  async revokeSession(userId: string, sessionId: string) {
    const success = await this.sessions.revokeSession(userId, sessionId);
    if (!success) throw new BadRequestException('Không tìm thấy phiên đăng nhập hoặc phiên đã bị thu hồi trước đó');
    return { message: 'Đã thu hồi phiên đăng nhập thành công' };
  }
}
