import * as crypto from 'crypto';
/**
 * RefreshAccessTokenHandler — Use case: `refreshAccessToken()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_BYTES,
  isAccountLocked,
} from '../../domain/value-objects/auth-policy.vo';
import { computeSha256Buffer } from '../../../../shared/crypto/crypto.util';
import {
  AUTH_SESSION_POLICY_PORT,
  AUTH_TOKEN_ISSUER_PORT,
  AUTH_USER_LOOKUP_PORT,
  type AuthSessionPolicyPort,
  type AuthTokenIssuerPort,
  type AuthUserLookupPort,
} from '../../domain/ports/auth-session.port';
import { AUTH_SESSION_PORT, type AuthSessionPort } from '../../domain/ports/auth-session.port';

@Injectable()
export class RefreshAccessTokenHandler {
  private readonly logger = new Logger(RefreshAccessTokenHandler.name);
  constructor(
    @Inject(AUTH_SESSION_PORT)
    private readonly sessions: AuthSessionPort,
    @Inject(AUTH_USER_LOOKUP_PORT)
    private readonly users: AuthUserLookupPort,
    @Inject(AUTH_SESSION_POLICY_PORT)
    private readonly policy: AuthSessionPolicyPort,
    @Inject(AUTH_TOKEN_ISSUER_PORT)
    private readonly tokens: AuthTokenIssuerPort,
  ) {}

  async execute(rawRefreshToken: string) {
    const refreshTokenHash = computeSha256Buffer(rawRefreshToken);
    const session = await this.sessions.findSessionByTokenHash(refreshTokenHash);
    if (session) {
      // `session.expires_at` là nguồn sự thật của hạn phiên (không phải `exp` của JWT).
      if (new Date(session.expiresAt).getTime() <= Date.now()) {
        throw new UnauthorizedException({
          message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
          error: 'TOKEN_EXPIRED',
        } as never);
      }
      const user = await this.users.findById(session.userId);
      if (!user || isAccountLocked(user.status) || user.deletedAt !== null) {
        throw new UnauthorizedException('Tài khoản liên kết không còn hoạt động');
      }
      // Rotation: revoke session cũ, tạo session mới (giữ nguyên cờ remember-me & hạn còn lại)
      await this.sessions.revokeSessionById(session.id).catch(() => undefined);
      const rawNew = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
      const newHash = computeSha256Buffer(rawNew);
      const rememberMe = session.rememberMe === true;
      const created = await this.sessions.createSession({
        userId: session.userId,
        refreshTokenHash: newHash,
        deviceName: session.deviceName ?? undefined,
        ipAddress: session.ipAddress ?? undefined,
        userAgent: session.userAgent ?? undefined,
        rememberMe,
        expiresAt: new Date(Date.now() + this.policy.refreshTtlMs(rememberMe)),
      });
      await this.sessions.touchSession(created.id, new Date()).catch(() => undefined);
      const newAccessToken = this.tokens.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
        sessionId: created.id,
      });
      return {
        access_token: newAccessToken,
        refresh_token: rawNew,
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        remember_me: rememberMe,
        expires_at: created.expiresAt.toISOString(),
      };
    }
    // Không thấy session còn hiệu lực => kiểm tra có phải reuse token cũ đã revoke không
    try {
      const revoked = await (
        this.sessions as unknown as {
          findSessionByTokenHashIncludingRevoked(h: string): Promise<{ userId: string } | null>;
        }
      ).findSessionByTokenHashIncludingRevoked(refreshTokenHash);
      if (revoked) {
        await this.sessions.revokeAllUserSessions(revoked.userId).catch(() => undefined);
        this.logger.warn(
          `[AUTH-12] Phát hiện tái sử dụng refresh token — đã thu hồi toàn bộ phiên của user ${revoked.userId}.`,
        );
        throw new UnauthorizedException({
          message: 'Phiên đã bị thu hồi do phát hiện tái sử dụng token. Vui lòng đăng nhập lại.',
          error: 'TOKEN_INVALID',
        } as never);
      }
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
    }
    throw new UnauthorizedException({
      message: 'Refresh token không hợp lệ hoặc đã hết hạn',
      error: 'TOKEN_EXPIRED',
    } as never);
  }
}
