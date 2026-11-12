import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogSchema, AuditChangeSchema } from './infrastructure/persistence/audit-log.schema';
import { AuditRepository } from './infrastructure/persistence/audit.repository';
import { AUDIT_REPOSITORY_PORT } from './domain/ports/audit.repository.port';
import { AuditService } from './application/audit.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'AuditLog', schema: AuditLogSchema },
      { name: 'AuditChange', schema: AuditChangeSchema },
    ]),
  ],
  providers: [AuditRepository, { provide: AUDIT_REPOSITORY_PORT, useExisting: AuditRepository }, AuditService],
  exports: [AuditService, AuditRepository, AUDIT_REPOSITORY_PORT],
})
export class AuditModule {}
