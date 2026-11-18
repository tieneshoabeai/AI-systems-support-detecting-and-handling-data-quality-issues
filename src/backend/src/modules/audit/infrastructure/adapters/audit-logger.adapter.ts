/**
 * AUDIT — Adapter cho facade port `AUDIT_LOGGER_PORT`.
 *
 * Sau khi tách `AuditService` thành handler (Command/Query pattern), controller
 * của module khác không còn import được application service. `AuditLoggerPort`
 * vẫn là hợp đồng công khai của module `audit`; adapter này là cầu nối giữa
 * port và `LogHandler`.
 */
import { Injectable } from '@nestjs/common';

import { AUDIT_LOGGER_PORT, type AuditLoggerPort } from '../../domain/ports/audit-logger.port';
import type {
  AuditChangeInput,
  CreateAuditLogInput,
} from '../../domain/ports/audit.repository.port';
import { LogHandler } from '../../application/commands/log.handler';

@Injectable()
export class AuditLoggerAdapter implements AuditLoggerPort {
  constructor(private readonly logHandler: LogHandler) {}

  log(input: CreateAuditLogInput, changes?: AuditChangeInput[]): Promise<void> {
    return this.logHandler.execute(input, changes);
  }
}

export { AUDIT_LOGGER_PORT };
