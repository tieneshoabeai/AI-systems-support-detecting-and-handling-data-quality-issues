/**
 * Public contract của module AUDIT.
 *
 * Các module khác chỉ được import qua file này (quy tắc CA8 — cross-module
 * import phải đi qua public contract), không import sâu vào
 * `domain/ports/...` hay `application/...`.
 *
 * Module `audit` chỉ cung cấp khả năng GHI log (`AUDIT_LOGGER_PORT`).
 * Không mở repository — audit log là append-only, chỉ đọc qua màn hình quản trị.
 */

export {
  AUDIT_LOGGER_PORT,
  type AuditLoggerPort,
} from './domain/ports/audit-logger.port';

export {
  AUDIT_REPOSITORY_PORT,
  type AuditAction,
  type AuditChangeInput,
  type AuditLogRecord,
  type AuditRepositoryPort,
  type AuditTargetType,
  type CreateAuditLogInput,
} from './domain/ports/audit.repository.port';

// ── Handlers (Command/Query) ──────────────────────────
// ── Commands (ghi) ─────────────────────────────────────────────
export { LogHandler } from './application/commands/log.handler';
