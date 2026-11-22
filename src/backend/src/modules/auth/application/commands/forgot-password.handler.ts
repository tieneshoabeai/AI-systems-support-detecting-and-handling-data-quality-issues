/**
 * ForgotPasswordHandler — Use case: `forgotPassword()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * Luồng (AUTH-05 — Phần 9 v3 §3.5.5):
 *   1. Chuẩn hoá email; email không tồn tại → trả thông báo trung tính
 *      (không rò rỉ email nào đã có tài khoản).
 *   2. Giới hạn tần suất: tối đa 5 lần gửi / 1 giờ → `LIMIT_EXCEEDED` (429).
 *   3. Sinh OTP 6 số, lưu **dạng hash** (SHA-256 của `otp:{email}:{otp}`), hạn 10 phút.
 *   4. Gửi email chứa mã OTP.
 *
 * Quy tắc bắt buộc:
 *   - OTP lưu dạng hash trong `user.password_reset_otp_hash`, hạn 10 phút,
 *     tối đa 5 lần thử sai → khoá OTP (§3.5.5 quy tắc 5).
 *   - Lỗi gửi email **không** làm fail thao tác chính — log cảnh báo (§3.5.5 quy tắc 3).
 *   - KHÔNG trả OTP ra API response (chống rò rỉ) — chỉ gửi qua email.
 */
import {
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { isAccountLocked } from '../../domain/value-objects/auth-policy.vo';
import { computeSha256Buffer } from '../../../../shared/domain/crypto/crypto.util';
import { EMAIL_SENDER_PORT, type EmailSenderPort } from '../../../../shared/application/ports/email.port';
import { passwordResetOtpTemplate } from '../../../../shared/domain/utils/email-templates';
import {
  AUTH_USER_LOOKUP_PORT,
  type AuthUserLookupPort,
} from '../../domain/ports/auth-session.port';
import {
  DomainError,
  RateLimitExceededError,
} from '../../../../shared/domain/errors';

/** Hạn hiệu lực của OTP (phút) — §3.5.5 quy tắc 5. */
const OTP_TTL_MINUTES = 10;
/** Số lần gửi tối đa trong 1 giờ. */
const MAX_SENDS_PER_WINDOW = 5;
/** Cửa sổ giới hạn tần suất (ms). */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

@Injectable()
export class ForgotPasswordHandler {
  private readonly logger = new Logger(ForgotPasswordHandler.name);
  constructor(
    @Inject(AUTH_USER_LOOKUP_PORT)
    private readonly users: AuthUserLookupPort,
    @Optional()
    @Inject(EMAIL_SENDER_PORT)
    private readonly email: EmailSenderPort,
  ) {}

  async execute(emailRaw: string): Promise<{ message: string }> {
    const email = emailRaw.toLowerCase().trim();
    const neutral = {
      message: `Nếu email tồn tại trong hệ thống, mã OTP đã được gửi. Mã có hiệu lực ${OTP_TTL_MINUTES} phút.`,
    };
    try {
      const existing = await this.users.findByEmailWithResetSecret(email);
      if (!existing) return neutral;
      if (isAccountLocked(existing.status)) return neutral;
      const now = new Date();
      const windowStart = existing.windowStart ? new Date(existing.windowStart) : null;
      let sentCount = existing.sentCount ?? 0;
      let win: Date | null = windowStart;
      if (!win || now.getTime() - win.getTime() > RATE_LIMIT_WINDOW_MS) {
        sentCount = 0;
        win = now;
      }
      if (sentCount >= MAX_SENDS_PER_WINDOW) {
        throw new RateLimitExceededError(
          `Bạn đã gửi OTP quá ${MAX_SENDS_PER_WINDOW} lần trong 1 giờ. Vui lòng thử lại sau.`,
          {
            retryAfterSeconds: Math.max(
              1,
              Math.ceil((RATE_LIMIT_WINDOW_MS - (now.getTime() - (win?.getTime() ?? now.getTime()))) / 1000),
            ),
          },
        );
      }
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const tokenHash = computeSha256Buffer(`otp:${email}:${otp}`);
      const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);
      await this.users.setPasswordResetOtp(
        email,
        tokenHash,
        expiresAt,
        sentCount + 1,
        win ?? now,
      );

      await this.sendOtpEmail(email, otp);
    } catch (e) {
      if (e instanceof DomainError) throw e;
      this.logger.error(`forgotPassword lỗi: ${(e as Error).message}`);
    }
    return neutral;
  }

  /**
   * Gửi email chứa mã OTP.
   *
   * Lỗi gửi **không** làm fail thao tác chính — chỉ log cảnh báo
   * (§3.5.5 quy tắc 3). OTP vẫn được lưu để người dùng có thể thử lại
   * (hoặc quản trị viên hỗ trợ nếu hạ tầng email đang lỗi).
   */
  private async sendOtpEmail(email: string, otp: string): Promise<void> {
    if (!this.email?.isConfigured()) {
      this.logger.warn(
        `[AUTH-05] Chưa cấu hình SMTP — không gửi được OTP cho ${email}. ` +
          'Cần đặt SMTP_HOST/SMTP_USER/SMTP_PASS.',
      );
      return;
    }
    const draft = passwordResetOtpTemplate(otp, OTP_TTL_MINUTES);
    try {
      const ok = await this.email.send({
        to: email,
        template: 'password_reset_otp',
        subject: draft.subject,
        html: draft.html,
        text: draft.text,
      });
      if (ok) {
        this.logger.log(`[AUTH-05] Đã gửi OTP đặt lại mật khẩu tới ${email}.`);
      } else {
        this.logger.warn(`[AUTH-05] Gửi OTP tới ${email} không thành công.`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[AUTH-05] Lỗi khi gửi OTP tới ${email}: ${msg}`);
    }
  }
}
