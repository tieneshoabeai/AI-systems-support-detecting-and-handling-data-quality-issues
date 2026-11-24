import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogSchema, AuditChangeSchema } from './audit.schema';
import { AuditRepository } from './audit.repository';
import { AUDIT_REPOSITORY_PORT } from './audit.types';
import { AUDIT_LOGGER_PORT } from './audit.types';
import { AuditService } from './audit.service';

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
    AuditService,
    { provide: AUDIT_LOGGER_PORT, useExisting: AuditService },
  ],
  exports: [AuditRepository, AUDIT_REPOSITORY_PORT, AUDIT_LOGGER_PORT],
})
export class AuditModule {}
