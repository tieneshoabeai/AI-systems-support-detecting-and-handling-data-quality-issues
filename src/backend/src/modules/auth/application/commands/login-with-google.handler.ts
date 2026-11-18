/**
 * LoginWithGoogleHandler — Use case: đăng nhập/đăng ký liền mạch qua Google (AUTH-03).
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * Luồng nghiệp vụ (xem `docs/restructures/3_business_workflows_v5.md` UC-34):
 *   1. Đổi `code` → hồ sơ Google (adapter lo phần HTTP + verify id_token).
 *   2. `email_verified` phải là `true` → nếu không: `VALIDATION_ERROR`.
 *   3. `google_id` đã gắn với tài khoản nào → đăng nhập tài khoản đó.
 *      - Tài khoản `blocked` → `FORBIDDEN`.
 *   4. `google_id` chưa gắn NHƯNG email đã có tài khoản → **liên kết tự động**
 *      (email đã được Google xác minh `email_verified = true` → đủ cơ sở tin cậy).
 *      Gắn `google_id` vào tài khoản đó rồi đăng nhập. Mật khẩu (nếu có) giữ nguyên.
 *   5. Cả hai đều mới → tạo tài khoản (role `analyst`, không có mật khẩu).
 *   6. Tạo phiên + phát access/refresh token.
 */
import * as crypto from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_BYTES,
  isAccountLocked,
} from '../../domain/value-objects/auth-policy.vo';
import { computeSha256Buffer } from '../../../../shared/domain/crypto/crypto.util';
import { detectDeviceName } from '../../../../shared/domain/utils/device-detector.util';
import {
  AUTH_SESSION_POLICY_PORT,
  AUTH_TOKEN_ISSUER_PORT,
  AUTH_USER_LOOKUP_PORT,
  type AuthSessionPolicyPort,
  type AuthTokenIssuerPort,
  type AuthUserLookupPort,
} from '../../domain/ports/auth-session.port';
import { AUTH_SESSION_PORT, type AuthSessionPort } from '../../domain/ports/auth-session.port';
import {
  GOOGLE_OAUTH_PORT,
  type GoogleOAuthPort,
  type GoogleProfile,
} from '../../domain/ports/google-oauth.port';
import type { GoogleLoginResult } from '../auth.types';
import { ConflictError, ERROR_CODES, ForbiddenError } from '../../../../shared/domain/errors';
import { StatusError } from '../../../../shared/application/errors';

@Injectable()
export class LoginWithGoogleHandler {
  private readonly logger = new Logger(LoginWithGoogleHandler.name);
  constructor(
    @Inject(AUTH_USER_LOOKUP_PORT)
    private readonly users: AuthUserLookupPort,
    @Inject(AUTH_SESSION_POLICY_PORT)
    private readonly policy: AuthSessionPolicyPort,
    @Inject(AUTH_SESSION_PORT)
    private readonly sessions: AuthSessionPort,
    @Inject(AUTH_TOKEN_ISSUER_PORT)
    private readonly tokens: AuthTokenIssuerPort,
    @Inject(GOOGLE_OAUTH_PORT)
    private readonly google: GoogleOAuthPort,
  ) {}

  /** Dựng URL chuyển hướng tới Google (kèm state chống CSRF). */
  buildAuthorizationUrl(state: string): string {
    return this.google.buildAuthorizationUrl(state);
  }

  async execute(
    code: string,
    state: string,
    expectedState: string,
    ipAddress?: string,
    userAgent?: string,
    rememberMe = false,
  ): Promise<GoogleLoginResult> {
    const profile = await this.google.exchangeCode(code, state, expectedState);
    this.assertEmailVerified(profile);

    const email = profile.email.toLowerCase().trim();
    const linked = await this.users.findByGoogleId(profile.googleId);
    let user = linked;

    if (!user) {
      // `google_id` chưa gắn — kiểm tra email có sẵn tài khoản chưa.
      // Nếu có → liên kết tự động: email đã được Google xác minh
      // (`email_verified = true`) nên đủ cơ sở tin cậy để gắn `google_id`.
      // Mật khẩu hiện có (nếu có) được giữ nguyên — người dùng vẫn đăng nhập
      // được bằng cả mật khẩu lẫn Google.
      const existing = await this.users.findByEmail(email);
      if (existing) {
        const linked = await this.users.linkGoogleId(existing.id, profile.googleId);
        if (!linked) {
          throw new ConflictError( 'Không thể liên kết tài khoản Google. Định danh Google này đã được gắn với một tài khoản khác.');
        }
        this.logger.log(
          `[AUTH-03] Đã liên kết tự động tài khoản Google với tài khoản hiện có (email đã được xác minh).`,
        );
        user = linked;
      } else {
        user = await this.users.createWithGoogle({
          email,
          googleId: profile.googleId,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl ?? null,
        });
      }
    }

    if (isAccountLocked(user.status)) {
      throw new ForbiddenError( 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
    }

    return this.issueSession(user, ipAddress, userAgent, rememberMe);
  }

  private assertEmailVerified(profile: GoogleProfile): void {
    if (!profile.emailVerified) {
      throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'Email của tài khoản Google chưa được xác minh. Không thể đăng nhập.');
    }
  }

  private async issueSession(
    user: { id: string; email: string; role: string },
    ipAddress?: string,
    userAgent?: string,
    rememberMe = false,
  ): Promise<GoogleLoginResult> {
    const rawRefreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const refreshTokenHash = computeSha256Buffer(rawRefreshToken);
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
      user: { id: user.id, email: user.email, role: user.role as 'admin' | 'analyst' },
      provider: 'google',
    };
  }
}
