import { Schema, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actor_id: Types.ObjectId | null;
  actor_role: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  workspace_id: Types.ObjectId | null;
  project_id: Types.ObjectId | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  expires_at: Date;
}

export const AuditLogSchema = new Schema<IAuditLog>(
  {
    actor_id: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actor_role: { type: String, default: null },
    action: { type: String, required: true, index: true },
    target_type: { type: String, required: true },
    target_id: { type: String, default: null },
    target_label: { type: String, default: null, maxlength: 200 },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'Workspace', default: null },
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    ip_address: { type: String, default: null, maxlength: 45 },
    user_agent: { type: String, default: null, maxlength: 500 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    expires_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false },
);

AuditLogSchema.index({ actor_id: 1, created_at: -1 });
AuditLogSchema.index({ target_type: 1, target_id: 1, created_at: -1 });
AuditLogSchema.index({ workspace_id: 1, created_at: -1 });
AuditLogSchema.index({ action: 1, created_at: -1 });
AuditLogSchema.index({ created_at: -1 });
AuditLogSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export interface IAuditChange extends Document {
  _id: Types.ObjectId;
  audit_log_id: Types.ObjectId;
  field: string;
  before_value: unknown;
  after_value: unknown;
  created_at: Date;
  expires_at: Date;
}

export const AuditChangeSchema = new Schema<IAuditChange>(
  {
    audit_log_id: { type: Schema.Types.ObjectId, ref: 'AuditLog', required: true, index: true },
    field: { type: String, required: true },
    before_value: { type: Schema.Types.Mixed, default: null },
    after_value: { type: Schema.Types.Mixed, default: null },
    expires_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false },
);
