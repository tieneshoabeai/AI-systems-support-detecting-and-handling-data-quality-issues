import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IAuditLog, IAuditChange } from './audit-log.schema';
import {
  AUDIT_REPOSITORY_PORT,
  type AuditLogRecord,
  type AuditRepositoryPort,
  type CreateAuditLogInput,
  type AuditChangeInput,
} from '../../domain/ports/audit.repository.port';
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';

function toOid(v: string | null | undefined): Types.ObjectId | null {
  if (!v || !isObjectIdHex(v)) return null;
  return new Types.ObjectId(v);
}

const RETENTION_DAYS = 365;

@Injectable()
export class AuditRepository implements AuditRepositoryPort {
  constructor(
    @InjectModel('AuditLog') private readonly logModel: Model<IAuditLog>,
    @InjectModel('AuditChange') private readonly changeModel: Model<IAuditChange>,
  ) {}

  async createLog(input: CreateAuditLogInput, changes?: AuditChangeInput[]): Promise<AuditLogRecord> {
    const now = new Date();
    const expires = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const doc = new this.logModel({
      actor_id: toOid(input.actorId),
      actor_role: input.actorRole ?? null,
      action: String(input.action),
      target_type: String(input.targetType),
      target_id: input.targetId ?? null,
      target_label: input.targetLabel ?? null,
      workspace_id: toOid(input.workspaceId ?? null),
      project_id: toOid(input.projectId ?? null),
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ? String(input.userAgent).slice(0, 500) : null,
      metadata: input.metadata ?? {},
      expires_at: expires,
    });
    const saved = await doc.save();
    if (changes && changes.length > 0) {
      const docs = changes.slice(0, 50).map((c) => ({
        audit_log_id: saved._id,
        field: String(c.field).slice(0, 200),
        before_value: c.beforeValue ?? null,
        after_value: c.afterValue ?? null,
        expires_at: expires,
      }));
      await this.changeModel.insertMany(docs).catch(() => undefined);
    }
    void AUDIT_REPOSITORY_PORT;
    return {
      id: saved._id.toString(),
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      action: String(input.action),
      targetType: String(input.targetType),
      targetId: input.targetId ?? null,
      createdAt: saved.created_at,
    };
  }
}
