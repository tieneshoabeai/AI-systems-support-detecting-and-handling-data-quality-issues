import { Schema, Document, Types } from 'mongoose';

export type OutboxStatus = 'PENDING' | 'PUBLISHING' | 'PUBLISHED' | 'PROCESSED' | 'FAILED';

export interface IOutboxEvent extends Document {
  _id: Types.ObjectId;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  retry_count: number;
  error_message?: string | null;
  processed_at?: Date | null;
  published_at?: Date | null;
  lease_expires_at?: Date | null;
  workspace_id?: string | null;
  project_id?: string | null;
  actor_id?: string | null;
  created_at: Date;
  updated_at: Date;
}

export const OutboxEventSchema = new Schema<IOutboxEvent>(
  {
    aggregate_type: {
      type: String,
      required: true,
      index: true,
    },
    aggregate_id: {
      type: String,
      required: true,
      index: true,
    },
    event_type: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PUBLISHING', 'PUBLISHED', 'PROCESSED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    retry_count: {
      type: Number,
      default: 0,
    },
    error_message: {
      type: String,
      default: null,
    },
    processed_at: {
      type: Date,
      default: null,
    },
    published_at: {
      type: Date,
      default: null,
    },
    lease_expires_at: {
      type: Date,
      default: null,
    },
    workspace_id: { type: String, default: null },
    project_id: { type: String, default: null },
    actor_id: { type: String, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

OutboxEventSchema.index({ status: 1, retry_count: 1, created_at: 1 });
OutboxEventSchema.index({ status: 1, lease_expires_at: 1 });
