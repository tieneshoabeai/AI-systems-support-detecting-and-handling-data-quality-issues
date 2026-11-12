import { Inject, Injectable, UnauthorizedException, BadRequestException, ConflictException, HttpException, HttpStatus, Logger } from '@nestjs/common';
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
    // Đặc tả §3.34.1: không có endpoint công khai để tự phong admin — ép analyst.
    const created = await this.users.create({
      email,
      passwordHash,
      firstName: dto.first_name,
      lastName: dto.last_name,
      role: 'analyst',
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

  // AUTH-12: Rotation + reuse detection — refresh cũ bị dùng lại => thu hồi toàn bộ phiên.
  async refreshAccessToken(rawRefreshToken: string) {
    const refreshTokenHash = computeSha256Buffer(rawRefreshToken);
    const session = await this.sessions.findSessionByTokenHash(refreshTokenHash);
    if (session) {
      const user = await this.users.findById(session.userId);
      if (!user || isAccountLocked(user.status) || user.deletedAt !== null) {
        throw new UnauthorizedException('Tài khoản liên kết không còn hoạt động');
      }
      // Rotation: revoke session cũ, tạo session mới
      await this.sessions.revokeSessionById(session.id).catch(() => undefined);
      const rawNew = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
      const newHash = computeSha256Buffer(rawNew);
      const created = await this.sessions.createSession({
        userId: session.userId,
        refreshTokenHash: newHash,
        deviceName: session.deviceName ?? undefined,
        ipAddress: session.ipAddress ?? undefined,
        userAgent: session.userAgent ?? undefined,
        expiresAt: refreshTokenExpiry(),
      });
      const newAccessToken = this.tokens.sign({ sub: user.id, email: user.email, role: user.role, sessionId: created.id });
      return { access_token: newAccessToken, refresh_token: rawNew, expires_in: ACCESS_TOKEN_TTL_SECONDS };
    }
    // Không thấy session còn hiệu lực => kiểm tra có phải reuse token cũ đã revoke không
    try {
      const revoked = await (this.sessions as unknown as { findSessionByTokenHashIncludingRevoked(h: string): Promise<{ userId: string } | null> }).findSessionByTokenHashIncludingRevoked(refreshTokenHash);
      if (revoked) {
        await this.sessions.revokeAllUserSessions(revoked.userId).catch(() => undefined);
        this.logger.warn(`[AUTH-12] Phát hiện tái sử dụng refresh token — đã thu hồi toàn bộ phiên của user ${revoked.userId}.`);
        throw new UnauthorizedException({ message: 'Phiên đã bị thu hồi do phát hiện tái sử dụng token. Vui lòng đăng nhập lại.', error: 'TOKEN_INVALID' } as never);
      }
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
    }
    throw new UnauthorizedException({ message: 'Refresh token không hợp lệ hoặc đã hết hạn', error: 'TOKEN_EXPIRED' } as never);
  }

  // AUTH-05: Quên mật khẩu — OTP 6 số, TTL 10 phút, tối đa 5 lần gửi/giờ/email, gửi lại vô hiệu hoá OTP cũ.
  // Phản hồi luôn giống nhau kể cả khi email không tồn tại (chống enumeration).
  async forgotPassword(emailRaw: string): Promise<{ message: string }> {
    const email = emailRaw.toLowerCase().trim();
    const neutral = { message: 'Nếu email tồn tại trong hệ thống, mã OTP đã được gửi. Mã có hiệu lực 10 phút.' };
    try {
      const existing = await (this.users as unknown as {
        findByEmailWithResetSecret(e: string): Promise<{ id: string; status: string; sentCount: number; windowStart: Date | null } | null>;
        setPasswordResetOtp(e: string, h: string, exp: Date, c: number, w: Date | null): Promise<boolean>;
      }).findByEmailWithResetSecret(email);
      if (!existing) return neutral;
      if (isAccountLocked(existing.status)) return neutral;
      const now = new Date();
      const windowStart = existing.windowStart ? new Date(existing.windowStart) : null;
      const windowMs = 60 * 60 * 1000;
      let sentCount = existing.sentCount ?? 0;
      let win: Date | null = windowStart;
      if (!win || now.getTime() - win.getTime() > windowMs) {
        sentCount = 0;
        win = now;
      }
      if (sentCount >= 5) {
        throw new HttpException(
          { message: 'Bạn đã gửi OTP quá 5 lần trong 1 giờ. Vui lòng thử lại sau.', error: 'LIMIT_EXCEEDED', details: { retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now.getTime() - (win?.getTime() ?? now.getTime()))) / 1000)) } },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const tokenHash = computeSha256Buffer(`otp:${email}:${otp}`);
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
      await (this.users as unknown as { setPasswordResetOtp(e: string, h: string, exp: Date, c: number, w: Date | null): Promise<boolean> }).setPasswordResetOtp(email, tokenHash, expiresAt, sentCount + 1, win ?? now);
      // Adapter email chưa có (mục 3.37.3) — ghi log để vận hành thủ công, không trả OTP ra API.
      this.logger.warn(`[AUTH-05] OTP đặt lại mật khẩu cho ${email}: ${otp} (hết hạn 10 phút). Cần cấu hình SMTP để gửi email thật.`);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.logger.error(`forgotPassword lỗi: ${(e as Error).message}`);
    }
    return neutral;
  }

  // AUTH-06: Đặt lại mật khẩu bằng OTP — sai 3 lần vô hiệu hoá OTP, xong thu hồi toàn bộ phiên.
  async resetPassword(emailRaw: string, otp: string, newPassword: string): Promise<{ message: string }> {
    const email = emailRaw.toLowerCase().trim();
    const st = await (this.users as unknown as {
      findByEmailWithResetSecret(e: string): Promise<{ id: string; status: string; tokenHash: string | null; expiresAt: Date | null; attempts: number } | null>;
      incrementResetAttempts(e: string): Promise<number>;
      clearPasswordReset(e: string): Promise<boolean>;
      setPasswordHash(id: string, h: string): Promise<boolean>;
    }).findByEmailWithResetSecret(email);
    if (!st || !st.tokenHash || !st.expiresAt) throw new BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng gửi lại mã mới.');
    if (isAccountLocked(st.status)) throw new UnauthorizedException('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
    if (new Date() > new Date(st.expiresAt)) {
      await (this.users as unknown as { clearPasswordReset(e: string): Promise<boolean> }).clearPasswordReset(email);
      throw new BadRequestException('Mã OTP đã hết hạn (10 phút). Vui lòng gửi lại mã mới.');
    }
    if ((st.attempts ?? 0) >= 3) {
      await (this.users as unknown as { clearPasswordReset(e: string): Promise<boolean> }).clearPasswordReset(email);
      throw new BadRequestException('Bạn đã nhập sai OTP quá 3 lần. OTP đã bị vô hiệu hoá, vui lòng gửi lại mã mới.');
    }
    const expect = computeSha256Buffer(`otp:${email}:${otp.trim()}`);
    if (expect !== st.tokenHash) {
      const n = await (this.users as unknown as { incrementResetAttempts(e: string): Promise<number> }).incrementResetAttempts(email);
      if (n >= 3) {
        await (this.users as unknown as { clearPasswordReset(e: string): Promise<boolean> }).clearPasswordReset(email);
        throw new BadRequestException('Bạn đã nhập sai OTP quá 3 lần. OTP đã bị vô hiệu hoá, vui lòng gửi lại mã mới.');
      }
      throw new BadRequestException(`Mã OTP không đúng (còn ${3 - n} lần thử).`);
    }
    const hash = await this.hasher.hash(newPassword);
    await (this.users as unknown as { setPasswordHash(id: string, h: string): Promise<boolean> }).setPasswordHash(st.id, hash);
    await (this.users as unknown as { clearPasswordReset(e: string): Promise<boolean> }).clearPasswordReset(email);
    await this.sessions.revokeAllUserSessions(st.id);
    this.logger.log(`[AUTH-06] Đặt lại mật khẩu thành công cho ${email}; đã thu hồi toàn bộ phiên.`);
    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' };
  }

  // AUTH-07: Đổi mật khẩu — xác minh mật khẩu hiện tại, 2 lần nhập khớp, mới khác cũ; giữ phiên hiện tại, thu hồi phiên khác.
  async changePassword(userId: string, currentSessionId: string | undefined, currentPassword: string, newPassword: string, confirmPassword: string): Promise<{ message: string }> {
    if (newPassword !== confirmPassword) throw new BadRequestException('Hai lần nhập mật khẩu mới không khớp.');
    const u = await (this.users as unknown as {
      findByIdWithResetSecret(id: string): Promise<{ id: string; status: string; passwordHash?: string | null } | null>;
      setPasswordHash(id: string, h: string): Promise<boolean>;
    }).findByIdWithResetSecret(userId);
    if (!u || !u.passwordHash) throw new BadRequestException('Không xác minh được mật khẩu hiện tại.');
    if (isAccountLocked(u.status)) throw new UnauthorizedException('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
    const ok = await this.hasher.compare(currentPassword, u.passwordHash);
    if (!ok) throw new BadRequestException('Mật khẩu hiện tại không đúng.');
    const same = await this.hasher.compare(newPassword, u.passwordHash);
    if (same) throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại.');
    const hash = await this.hasher.hash(newPassword);
    await (this.users as unknown as { setPasswordHash(id: string, h: string): Promise<boolean> }).setPasswordHash(userId, hash);
    // Giữ phiên hiện tại, thu hồi các phiên khác
    try {
      const actives = await this.sessions.findActiveSessions(userId);
      for (const s of actives) {
        if (currentSessionId && s.id === currentSessionId) continue;
        await this.sessions.revokeSession(userId, s.id).catch(() => undefined);
      }
    } catch { /* không chặn đổi mật khẩu vì lỗi thu hồi phiên */ }
    this.logger.log(`[AUTH-07] Đổi mật khẩu thành công cho user ${userId}; giữ phiên hiện tại.`);
    return { message: 'Đổi mật khẩu thành công.' };
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
