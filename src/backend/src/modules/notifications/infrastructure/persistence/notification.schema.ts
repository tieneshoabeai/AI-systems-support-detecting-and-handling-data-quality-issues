import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';

export const NotificationTypes = [
  'project_created',
  'project_deleted',
  'project_member_added',
  'issue_needs_info',
  'issue_resolved',
  'analysis_completed',
  'analysis_failed',
  'ai_analysis_ready',
  'report_ready',
  'security_alert',
] as const;

export type NotificationType = (typeof NotificationTypes)[number];

export const MandatoryNotificationTypes: NotificationType[] = [
  'issue_needs_info',
  'security_alert',
];

export interface INotificationPayload {
  targetType?: string | null;
  targetId?: string | null;
  actionUrl?: string | null;
}

export interface INotification extends Document, BaseEntity {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  type: NotificationType;
  is_mandatory: boolean;
  title: string;
  summary?: string | null;
  payload?: INotificationPayload;
  source_event_id?: string | null;
  read_at: Date | null;
  expires_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

const NotificationPayloadSchema = new Schema<INotificationPayload>(
  {
    targetType: { type: String, default: null },
    targetId: { type: String, default: null },
    actionUrl: { type: String, default: null },
  },
  { _id: false },
);

export const NotificationSchema = new Schema<INotification>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: [...NotificationTypes], required: true, index: true },
    is_mandatory: { type: Boolean, required: true, default: false },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    summary: { type: String, default: null, maxlength: 500 },
    payload: { type: NotificationPayloadSchema, default: undefined },
    source_event_id: { type: String, default: null, index: true },
    read_at: { type: Date, default: null, index: true },
    expires_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

NotificationSchema.index({ user_id: 1, read_at: 1, created_at: -1 });
NotificationSchema.index({ user_id: 1, read_at: 1 });
NotificationSchema.index(
  { user_id: 1, source_event_id: 1 },
  { unique: true, partialFilterExpression: { source_event_id: { $ne: null } } },
);
NotificationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
