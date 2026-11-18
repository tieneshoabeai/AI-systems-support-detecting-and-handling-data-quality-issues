import { Model } from 'mongoose';
import { IAuditLog, IAuditChange } from './audit-log.schema';
import { type AuditLogRecord, type AuditRepositoryPort, type CreateAuditLogInput, type AuditChangeInput } from '../../domain/ports/audit.repository.port';
export declare class AuditRepository implements AuditRepositoryPort {
    private readonly logModel;
    private readonly changeModel;
    constructor(logModel: Model<IAuditLog>, changeModel: Model<IAuditChange>);
    createLog(input: CreateAuditLogInput, changes?: AuditChangeInput[]): Promise<AuditLogRecord>;
}
