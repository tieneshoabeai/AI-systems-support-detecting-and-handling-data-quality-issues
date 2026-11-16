/**
 * ForgotPasswordHandler — Use case: `forgotPassword()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { isAccountLocked } from '../../domain/value-objects/auth-policy.vo';
import { computeSha256Buffer } from '../../../../shared/crypto/crypto.util';
import {
  AUTH_USER_LOOKUP_PORT,
  type AuthUserLookupPort,
} from '../../domain/ports/auth-session.port';

@Injectable()
export class ForgotPasswordHandler {
  private readonly logger = new Logger(ForgotPasswordHandler.name);
  constructor(
    @Inject(AUTH_USER_LOOKUP_PORT)
    private readonly users: AuthUserLookupPort,
  ) {}

  async execute(emailRaw: string): Promise<{ message: string }> {
    const email = emailRaw.toLowerCase().trim();
    const neutral = {
      message: 'Nếu email tồn tại trong hệ thống, mã OTP đã được gửi. Mã có hiệu lực 10 phút.',
    };
    try {
      const existing = await (
        this.users as unknown as {
          findByEmailWithResetSecret(e: string): Promise<{
            id: string;
            status: string;
            sentCount: number;
            windowStart: Date | null;
          } | null>;
          setPasswordResetOtp(
            e: string,
            h: string,
            exp: Date,
            c: number,
            w: Date | null,
          ): Promise<boolean>;
        }
      ).findByEmailWithResetSecret(email);
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
          {
            message: 'Bạn đã gửi OTP quá 5 lần trong 1 giờ. Vui lòng thử lại sau.',
            error: 'LIMIT_EXCEEDED',
            details: {
              retryAfterSeconds: Math.max(
                1,
                Math.ceil((windowMs - (now.getTime() - (win?.getTime() ?? now.getTime()))) / 1000),
              ),
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const tokenHash = computeSha256Buffer(`otp:${email}:${otp}`);
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
      await (
        this.users as unknown as {
          setPasswordResetOtp(
            e: string,
            h: string,
            exp: Date,
            c: number,
            w: Date | null,
          ): Promise<boolean>;
        }
      ).setPasswordResetOtp(email, tokenHash, expiresAt, sentCount + 1, win ?? now);
      // Adapter email chưa có (mục 3.37.3) — ghi log để vận hành thủ công, không trả OTP ra API.
      this.logger.warn(
        `[AUTH-05] OTP đặt lại mật khẩu cho ${email}: ${otp} (hết hạn 10 phút). Cần cấu hình SMTP để gửi email thật.`,
      );
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.logger.error(`forgotPassword lỗi: ${(e as Error).message}`);
    }
    return neutral;
  }
}
