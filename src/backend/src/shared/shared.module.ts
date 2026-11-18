import { Module, Global } from '@nestjs/common';
import { DatabaseModule } from './infrastructure/database/database.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { CaslModule } from './interfaces/casl/casl.module';
import { SmtpEmailSenderAdapter } from './infrastructure/adapters/smtp-email-sender.adapter';
import { NtfyPushSenderAdapter } from './infrastructure/adapters/ntfy-push-sender.adapter';
import { EMAIL_SENDER_PORT } from './application/ports/email.port';
import { PUSH_SENDER_PORT } from './application/ports/push.port';

/**
 * SHARED — Lớp cross-cutting của hệ thống.
 *
 * Bao gồm các hạ tầng dùng chung cho nhiều module nghiệp vụ:
 *   - `DatabaseModule`  → Mongoose connection
 *   - `StorageModule`   → S3/R2 (STORAGE_PORT)
 *   - `CaslModule`      → phân quyền
 *   - `SmtpEmailSenderAdapter` → EMAIL_SENDER_PORT (gửi OTP, lời mời, thông báo)
 *   - `NtfyPushSenderAdapter`  → PUSH_SENDER_PORT (push notification)
 *
 * Cả hai adapter đều có **fallback an toàn**: thiếu cấu hình → `isConfigured()` = false
 * và `send()` trả `false` — hệ thống khởi động và vận hành bình thường
 * (Phần 9 v3 §3.2 quy tắc 4).
 *
 * `@Global()` để mọi module inject được mà không phải import lặp lại.
 */
@Global()
@Module({
  imports: [DatabaseModule, StorageModule, CaslModule],
  providers: [
    SmtpEmailSenderAdapter,
    { provide: EMAIL_SENDER_PORT, useExisting: SmtpEmailSenderAdapter },
    NtfyPushSenderAdapter,
    { provide: PUSH_SENDER_PORT, useExisting: NtfyPushSenderAdapter },
  ],
  exports: [
    DatabaseModule,
    StorageModule,
    CaslModule,
    EMAIL_SENDER_PORT,
    PUSH_SENDER_PORT,
  ],
})
export class SharedModule {}
