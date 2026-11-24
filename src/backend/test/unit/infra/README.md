# `test/unit/infra/` — 8 file: hạ tầng dùng chung (mock)

Test logic **gọi** adapter/service bằng mock — không cần Redis/Kafka/S3 thật. Muốn hành vi thật thì đọc `test/integration/`.

| File | Các `describe` thật trong code |
|---|---|
| `event-dispatcher.spec.ts` | `B2.8 — EventDispatcherService` |
| `storage.spec.ts` | `StorageService (Dual-mode Storage)` |
| `storage-cleanup.spec.ts` | `CLI Storage (scripts/lib/cli-storage)` ; `storageKeyForDataset` ; `Dọn storage — tính idempotent` |
| `group1-infra.spec.ts` | `Nhóm 1 — Realtime multi-instance (Socket.IO Redis adapter)` ; `Nhóm 1 — Event bus (Kafka + in-process fallback)` ; `Nhóm 1 — PDF report` |
| `ai-worker.spec.ts` | `B2.10 — AiWorkerService` ; `B2.10 — extractJsonObject` |
| `ai-adapters-outbox.spec.ts` | `B2.11 — LocalInferenceAdapter` ; `B2.11 — SystemResourceGuardAdapter` ; `B2.11 — OutboxRelayService` |
| `report-worker.spec.ts` | `GĐ3 — ReportWorkerService sinh PDF` |
| `external-services-email-push.spec.ts` | `Email templates` ; `SmtpEmailSenderAdapter` ; `NtfyPushSenderAdapter` ; `buildNotificationEmail` ; `DispatchHandler — kênh email & push` ; `ForgotPasswordHandler — gửi OTP qua email` (6 describe) |

Chạy: `npx jest test/unit/infra --no-coverage`.
