import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import {
  type EmailMessage,
  type EmailSenderPort,
} from '../../application/ports/email.port';
import { genericTemplate } from '../../domain/utils/email-templates';

/**
 * Adapter EMAIL_SENDER_PORT — gửi email qua SMTP (nodemailer).
 *
 * Vì sao ở `shared/adapters/`?
 * --------------------------------------------------------------
 * Phần 9 v3 §3.2 quy định: "Adapter nằm ở `infrastructure/` của module sở hữu,
 * hoặc ở `shared/infrastructure/` nếu là hạ tầng dùng chung". SMTP là hạ tầng
 * dùng chung cho `auth`, `workspaces`, `notifications` → đặt ở `shared/`.
 *
 * Hành viết:
 *   - Thiếu cấu hình SMTP → `isConfigured()` = false, `send()` trả `false`
 *     và log cảnh báo. **KHÔNG crash** (Phần 9 v3 §3.2 quy tắc 4:
 *     "hệ thống phải khởi động được khi thiếu cấu hình SMTP").
 *   - Lỗi gửi → trả `false`, log cảnh báo. **KHÔNG ném lỗi** — lỗi gửi email
 *     không được làm fail thao tác chính (§3.5.5 quy tắc 3).
 *   - Retry tối đa 3 lần với backoff tuyến tính (§3.5.5 quy tắc 3).
 *   - KHÔNG log nội dung email (§3.5.5 quy tắc 2) — chỉ log địa chỉ nhận + template.
 */
@Injectable()
export class SmtpEmailSenderAdapter implements EmailSenderPort, OnModuleDestroy {
  private readonly logger = new Logger(SmtpEmailSenderAdapter.name);
  private readonly host: string | undefined;
  private readonly port: number;
  private readonly user: string | undefined;
  private readonly pass: string | undefined;
  private readonly from: string;
  private transporter: Transporter | null = null;

  /** Số lần thử tối đa cho một lần gửi (Phần 9 v3 §3.5.5 quy tắc 3). */
  private static readonly MAX_ATTEMPTS = 3;
  /** Delay giữa các lần thử (ms). */
  private static readonly RETRY_DELAY_MS = 1000;

  constructor(config: ConfigService) {
    this.host = config.get<string>('SMTP_HOST')?.trim() || undefined;
    this.port = config.get<number>('SMTP_PORT') ?? 587;
    this.user = config.get<string>('SMTP_USER')?.trim() || undefined;
    // Gmail App Password điền tay có thể chứa khoảng trắng → bỏ hết.
    this.pass = config.get<string>('SMTP_PASS')?.replace(/\s+/g, '') || undefined;
    this.from =
      config.get<string>('SMTP_FROM')?.trim() ||
      'AI Data Quality Platform <noreply@data-quality.local>';
  }

  isConfigured(): boolean {
    return Boolean(this.host && this.user && this.pass);
  }

  async send(message: EmailMessage): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Chưa cấu hình SMTP (SMTP_HOST/SMTP_USER/SMTP_PASS) — bỏ qua gửi email. ' +
          'Kiểm tra .env hoặc đặt SMTP_ENABLED=false nếu cố ý tắt.',
      );
      return false;
    }

    const subject = message.subject?.trim();
    const to = message.to?.trim();
    if (!subject || !to) {
      this.logger.warn('Email thiếu `to` hoặc `subject` — bỏ qua gửi.');
      return false;
    }

    // Nội dung: ưu tiên html/text do caller truyền; nếu không có thì dựng từ template.
    let html = message.html;
    let text = message.text;
    if (!html && !text) {
      const built = genericTemplate(subject, '', null);
      html = built.html;
      text = built.text;
    }

    let lastError = '';
    for (let attempt = 1; attempt <= SmtpEmailSenderAdapter.MAX_ATTEMPTS; attempt += 1) {
      try {
        const transporter = this.getTransporter();
        await transporter.sendMail({
          from: this.from,
          to,
          subject,
          html,
          text,
          replyTo: message.replyTo,
        });
        this.logger.log(
          `Đã gửi email [${message.template}] tới ${to} (lần thử ${attempt}/${SmtpEmailSenderAdapter.MAX_ATTEMPTS}).`,
        );
        return true;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Gửi email [${message.template}] tới ${to} thất bại (lần ${attempt}/${SmtpEmailSenderAdapter.MAX_ATTEMPTS}): ${lastError}`,
        );
        // Bỏ qua connection cache để lần thử sau tạo kết nối mới.
        this.transporter = null;
        if (attempt < SmtpEmailSenderAdapter.MAX_ATTEMPTS) {
          await this.sleep(SmtpEmailSenderAdapter.RETRY_DELAY_MS * attempt);
        }
      }
    }
    this.logger.error(
      `Gửi email [${message.template}] tới ${to} thất bại sau ${SmtpEmailSenderAdapter.MAX_ATTEMPTS} lần thử: ${lastError}`,
    );
    return false;
  }

  onModuleDestroy(): void {
    this.transporter?.close();
    this.transporter = null;
  }

  // ── Nội bộ ────────────────────────────────────────────────────────────────

  /** Tạo (và cache) transporter SMTP. */
  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    this.transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      // Gmail/Google dùng STARTTLS trên cổng 587.
      secure: this.port === 465,
      auth: { user: this.user, pass: this.pass },
      // Timeout hợp lý để không treo request.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    return this.transporter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      // Không giữ process sống vì timer này.
      (timer as unknown as { unref?: () => void }).unref?.();
    });
  }
}
