/**
 * AUTH — Dịch vụ phát cảnh báo bảo mật qua email.
 *
 * Tách riêng khỏi handler để:
 *   - Không lặp lại logic gửi email ở nhiều handler (`ChangePassword`, `Refresh`).
 *   - Lỗi gửi email **không** làm fail thao tác xác thực chính
 *     (Phần 9 v3 §3.5.5 quy tắc 3) — lỗi bị nuốt và chỉ ghi log cảnh báo.
 *   - KHÔNG log nội dung email (Phần 9 v3 §3.5.5 quy tắc 2).
 *
 * Loại cảnh báo bảo mật (Phần 9 v3 §3.5.5):
 *   - Phát hiện tái sử dụng refresh token.
 *   - Thay đổi mật khẩu.
 *
 * Cảnh báo bảo mật là email **bắt buộc** — gửi bất kể công tắc
 * `notifications_enabled` (Phần 9 v3 §3.5.5 quy tắc 4).
 */
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EMAIL_SENDER_PORT, type EmailSenderPort } from '../../../shared/application/ports/email.port';
import { securityAlertTemplate } from '../../../shared/domain/utils/email-templates';

@Injectable()
export class SecurityAlertService {
  private readonly logger = new Logger(SecurityAlertService.name);

  constructor(
    @Optional()
    @Inject(EMAIL_SENDER_PORT)
    private readonly email: EmailSenderPort,
  ) {}

  /**
   * Gửi cảnh báo bảo mật tới một người dùng.
   *
   * @param email địa chỉ nhận (null → bỏ qua)
   * @param alertTitle tiêu đề cảnh báo (VD: "Đổi mật khẩu")
   * @param detail mô tả thêm (không nhạy cảm — KHÔNG ghi mật khẩu/token)
   */
  async send(
    email: string | null | undefined,
    alertTitle: string,
    detail?: string | null,
  ): Promise<void> {
    if (!email) return;
    if (!this.email?.isConfigured()) {
      this.logger.warn(
        `[SECURITY] Chưa cấu hình SMTP — không gửi được cảnh báo bảo mật "${alertTitle}".`,
      );
      return;
    }
    const draft = securityAlertTemplate(alertTitle, detail ?? null);
    try {
      const ok = await this.email.send({
        to: email,
        template: 'security_alert',
        subject: draft.subject,
        html: draft.html,
        text: draft.text,
      });
      if (ok) {
        this.logger.log(`[SECURITY] Đã gửi cảnh báo bảo mật "${alertTitle}" tới ${email}.`);
      } else {
        this.logger.warn(`[SECURITY] Gửi cảnh báo bảo mật tới ${email} không thành công.`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[SECURITY] Lỗi khi gửi cảnh báo bảo mật tới ${email}: ${msg}`);
    }
  }
}
