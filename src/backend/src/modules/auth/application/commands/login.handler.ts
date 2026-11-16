import * as crypto from 'crypto';
/**
 * LoginHandler — Use case: `login()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_BYTES,
  isAccountLocked,
} from '../../domain/value-objects/auth-policy.vo';
import { computeSha256Buffer } from '../../../../shared/crypto/crypto.util';
import { detectDeviceName } from '../../../../shared/utils/device-detector.util';
import {
  AUTH_SESSION_POLICY_PORT,
  AUTH_TOKEN_ISSUER_PORT,
  AUTH_USER_LOOKUP_PORT,
  PASSWORD_HASHER_PORT,
  type AuthSessionPolicyPort,
  type AuthTokenIssuerPort,
  type AuthUserLookupPort,
  type PasswordHasherPort,
} from '../../domain/ports/auth-session.port';
import { AUTH_SESSION_PORT, type AuthSessionPort } from '../../domain/ports/auth-session.port';
import { LoginInput } from '../auth.types';

@Injectable()
export class LoginHandler {
  constructor(
    @Inject(AUTH_USER_LOOKUP_PORT)
    private readonly users: AuthUserLookupPort,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly hasher: PasswordHasherPort,
    @Inject(AUTH_SESSION_POLICY_PORT)
    private readonly policy: AuthSessionPolicyPort,
    @Inject(AUTH_SESSION_PORT)
    private readonly sessions: AuthSessionPort,
    @Inject(AUTH_TOKEN_ISSUER_PORT)
    private readonly tokens: AuthTokenIssuerPort,
  ) {}

  async execute(dto: LoginInput, ipAddress?: string, userAgent?: string): Promise<{ access_token: string; refresh_token: string; expires_in: number; device_name: string; remember_me: boolean; expires_at: string; user: { id: string; email: string; role: "admin" | "analyst"; }; }> {
    const user = await this.users.findByEmail(dto.email, true);
    if (!user || !user.passwordHash)
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    if (isAccountLocked(user.status))
      throw new UnauthorizedException(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
      );
    const ok = await this.hasher.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    const rawRefreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const refreshTokenHash = computeSha256Buffer(rawRefreshToken);
    // Hạn phiên do policy quyết định (7 ngày mặc định, 30 ngày nếu "ghi nhớ đăng nhập").
    const rememberMe = dto.remember_me === true;
    const expiresAt = new Date(Date.now() + this.policy.refreshTtlMs(rememberMe));
    const resolvedDeviceName = detectDeviceName(userAgent);
    const session = await this.sessions.createSession({
      userId: user.id,
      refreshTokenHash,
      deviceName: resolvedDeviceName,
      ipAddress,
      userAgent,
      rememberMe,
      expiresAt,
    });
    const accessToken = this.tokens.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });
    return {
      access_token: accessToken,
      refresh_token: rawRefreshToken,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      device_name: resolvedDeviceName,
      remember_me: rememberMe,
      expires_at: expiresAt.toISOString(),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
