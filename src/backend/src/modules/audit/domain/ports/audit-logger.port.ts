/**
 * AUDIT — Facade port (driving port) cho module khác.
 *
 * Vì sao cần (L3a — quy tắc R2):
 * Controller của module khác (datasets/issues/analysis) KHÔNG được import
 * trực tiếp `AuditService` (application của module `audit`). Module `audit`
 * **sở hữu** hợp đồng này, export qua `modules/audit/index.ts`
 * (public contract — L4/R6) và bind token tới `AuditService` trong `AuditModule`.
 *
 * Hợp đồng chỉ gồm thao tác ghi log — không mở repository (append-only,
 * không có đường đọc trực tiếp từ nơi khác).
 */
import type {
  AuditChangeInput,
  CreateAuditLogInput,
} from './audit.repository.port';

export const AUDIT_LOGGER_PORT = Symbol('AuditLoggerPort');

export interface AuditLoggerPort {
  /** Ghi một dòng audit log (best-effort — lỗi ghi log KHÔNG làm hỏng luồng chính). */
  log(input: CreateAuditLogInput, changes?: AuditChangeInput[]): Promise<void>;
}
