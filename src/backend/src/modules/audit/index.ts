/**
 * Public contract cua module AUDIT (Template Simple).
 *
 * Cac module khac chi duoc import qua file nay (MM2) - khong import sau.
 * Module `audit` chi cung cap kha nang GHI log (`AUDIT_LOGGER_PORT`).
 * Khong mo repository - audit log la append-only.
 */

export {
  AUDIT_LOGGER_PORT,
  type AuditLoggerPort,
  AUDIT_REPOSITORY_PORT,
  type AuditAction,
  type AuditChangeInput,
  type AuditLogRecord,
  type AuditRepositoryPort,
  type AuditTargetType,
  type CreateAuditLogInput,
} from './audit.types';

export { AuditService } from './audit.service';
export { AuditRepository } from './audit.repository';
