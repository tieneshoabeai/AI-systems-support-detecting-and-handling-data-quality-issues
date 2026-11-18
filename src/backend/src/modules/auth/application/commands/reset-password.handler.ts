/**
 * ResetPasswordHandler — Use case: `resetPassword()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { isAccountLocked } from '../../domain/value-objects/auth-policy.vo';
import { computeSha256Buffer } from '../../../../shared/domain/crypto/crypto.util';
import {
  AUTH_USER_LOOKUP_PORT,
  PASSWORD_HASHER_PORT,
  type AuthUserLookupPort,
  type PasswordHasherPort,
} from '../../domain/ports/auth-session.port';
import { AUTH_SESSION_PORT, type AuthSessionPort } from '../../domain/ports/auth-session.port';
import { SecurityAlertService } from '../security-alert.service';
import { UnauthenticatedError, ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class ResetPasswordHandler {
  private readonly logger = new Logger(ResetPasswordHandler.name);
  constructor(
    @Inject(AUTH_USER_LOOKUP_PORT)
    private readonly users: AuthUserLookupPort,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly hasher: PasswordHasherPort,
    @Inject(AUTH_SESSION_PORT)
    private readonly sessions: AuthSessionPort,
    @Optional()
    private readonly securityAlerts: SecurityAlertService,
  ) {}

  async execute(emailRaw: string, otp: string, newPassword: string): Promise<{ message: string }> {
    const email = emailRaw.toLowerCase().trim();
    const st = await this.users.findByEmailWithResetSecret(email);
    if (!st || !st.tokenHash || !st.expiresAt)
      throw new ValidationError('Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng gửi lại mã mới.',);
    if (isAccountLocked(st.status))
      throw new UnauthenticatedError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',);
    if (new Date() > new Date(st.expiresAt)) {
      await this.users.clearPasswordReset(email);
      throw new ValidationError('Mã OTP đã hết hạn (10 phút). Vui lòng gửi lại mã mới.');
    }
    if ((st.attempts ?? 0) >= 3) {
      await this.users.clearPasswordReset(email);
      throw new ValidationError('Bạn đã nhập sai OTP quá 3 lần. OTP đã bị vô hiệu hoá, vui lòng gửi lại mã mới.',);
    }
    const expect = computeSha256Buffer(`otp:${email}:${otp.trim()}`);
    if (expect !== st.tokenHash) {
      const n = await this.users.incrementResetAttempts(email);
      if (n >= 3) {
        await this.users.clearPasswordReset(email);
        throw new ValidationError('Bạn đã nhập sai OTP quá 3 lần. OTP đã bị vô hiệu hoá, vui lòng gửi lại mã mới.',);
      }
      throw new ValidationError(`Mã OTP không đúng (còn ${3 - n} lần thử).`);
    }
    const hash = await this.hasher.hash(newPassword);
    await this.users.setPasswordHash(st.id, hash);
    await this.users.clearPasswordReset(email);
    await this.sessions.revokeAllUserSessions(st.id);
    this.logger.log(
      `[AUTH-06] Đặt lại mật khẩu thành công cho ${email}; đã thu hồi toàn bộ phiên.`,
    );
    // Cảnh báo bảo mật — email bắt buộc (Phần 9 v3 §3.5.5).
    await this.securityAlerts?.send(
      email,
      'Mật khẩu đã được đặt lại',
      'Mật khẩu của bạn vừa được đặt lại qua OTP. Toàn bộ phiên đăng nhập cũ đã bị đăng xuất.',
    );
    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' };
  }
}
