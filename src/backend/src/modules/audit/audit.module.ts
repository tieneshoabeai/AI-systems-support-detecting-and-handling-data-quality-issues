import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogSchema, AuditChangeSchema } from './infrastructure/persistence/audit-log.schema';
import { AuditRepository } from './infrastructure/persistence/audit.repository';
import { AUDIT_REPOSITORY_PORT } from './domain/ports/audit.repository.port';
import { AUDIT_LOGGER_PORT } from './domain/ports/audit-logger.port';
import { AuditLoggerAdapter } from './infrastructure/adapters/audit-logger.adapter';
import { LogHandler } from './application/commands/log.handler';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'AuditLog', schema: AuditLogSchema },
      { name: 'AuditChange', schema: AuditChangeSchema },
    ]),
  ],
  providers: [
    AuditRepository,
    { provide: AUDIT_REPOSITORY_PORT, useExisting: AuditRepository },
    LogHandler,
    AuditLoggerAdapter,
    { provide: AUDIT_LOGGER_PORT, useExisting: AuditLoggerAdapter },
  ],
  exports: [AuditRepository, AUDIT_REPOSITORY_PORT, AUDIT_LOGGER_PORT],
})
export class AuditModule {}
