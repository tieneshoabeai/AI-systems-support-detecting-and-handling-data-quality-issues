/**
 * Script kiểm chứng tích hợp thật — Gửi email qua Gmail SMTP + push ntfy.
 *
 * Chạy:  npx ts-node -r tsconfig-paths/register scripts/verify-external-services.ts
 * Hoặc:  pnpm exec ts-node scripts/verify-external-services.ts
 *
 * Script KHÔNG nằm trong unit test (cần mạng + credential thật).
 * Nó chỉ gửi 1 email thử nghiệm + 1 push thử nghiệm rồi báo cáo kết quả.
 */
import { config as loadEnv } from 'dotenv';
import path from 'path';
import { SmtpEmailSenderAdapter } from '../src/shared/infrastructure/adapters/smtp-email-sender.adapter';
import { NtfyPushSenderAdapter } from '../src/shared/infrastructure/adapters/ntfy-push-sender.adapter';
import { passwordResetOtpTemplate } from '../src/shared/domain/utils/email-templates';
import type { EmailMessage } from '../src/shared/application/ports/email.port';

loadEnv({ path: path.resolve(__dirname, '../.env') });

/** ConfigService tối giản — chỉ cần `get()`. */
const config = {
  get: (key: string): unknown => process.env[key],
} as never;

async function main(): Promise<void> {
  const smtp = new SmtpEmailSenderAdapter(config);
  const ntfy = new NtfyPushSenderAdapter(config);

  console.log('─── Cấu hình ───');
  console.log('SMTP configured :', smtp.isConfigured());
  console.log('ntfy configured :', ntfy.isConfigured());
  console.log('SMTP host/port  :', process.env.SMTP_HOST, process.env.SMTP_PORT);
  console.log('SMTP user       :', process.env.SMTP_USER);
  console.log('ntfy topic      :', process.env.NTFY_TOPIC);
  console.log('');

  if (!smtp.isConfigured()) {
    console.error('✗ Chưa cấu hình SMTP — dừng.');
    process.exitCode = 1;
    return;
  }

  // ── 1. Gửi email OTP thử nghiệm ───────────────────────────────────────
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const draft = passwordResetOtpTemplate(otp, 10);
  const message: EmailMessage = {
    to: process.env.SMTP_USER ?? '',
    template: 'password_reset_otp',
    subject: '[KIỂM CHỨNG] Mã đặt lại mật khẩu',
    html: draft.html,
    text: draft.text,
  };
  console.log('─── Gửi email thử nghiệm ───');
  const emailOk = await smtp.send(message);
  console.log(emailOk ? '✓ Email gửi thành công' : '✗ Email gửi thất bại');
  console.log('');

  // ── 2. Gửi push ntfy thử nghiệm ───────────────────────────────────────
  if (ntfy.isConfigured()) {
    console.log('─── Gửi push ntfy thử nghiệm ───');
    const pushOk = await ntfy.send({
      title: '[KIỂM CHỨNG] AI Data Quality Platform',
      body: 'Kết nối push notification đã hoạt động.',
      priority: 'default',
      tags: ['test'],
    });
    console.log(pushOk ? '✓ Push gửi thành công' : '✗ Push gửi thất bại');
  } else {
    console.log('─── Push ntfy: bỏ qua (chưa cấu hình) ───');
  }

  console.log('');
  console.log(emailOk ? '✅ Tất cả kết nối bên ngoài hoạt động.' : '❌ Có kết nối chưa hoạt động.');
  if (!emailOk) process.exitCode = 1;
}

void main();
