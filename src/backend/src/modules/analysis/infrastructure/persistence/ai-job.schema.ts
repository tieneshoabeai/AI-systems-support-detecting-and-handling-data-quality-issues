import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';

export type AiJobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface IAiJob extends Document, BaseEntity {
  _id: Types.ObjectId;
  analysis_run_id: Types.ObjectId;
  project_id: Types.ObjectId;
  dataset_id: Types.ObjectId;
  input_fingerprint: string;
  status: AiJobStatus;
  attempt: number;
  model_id: string | null;
  prompt_version: string | null;
  error: { code: string; message: string; retryable: boolean } | null;
  started_at: Date | null;
  finished_at: Date | null;
  duration_ms: number | null;
  /** Phan 10 v6: heartbeat/lease — worker giu lease de job khong bi nhan gia */
  heartbeat_at: Date | null;
  lease_expires_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const AiJobSchema = new Schema<IAiJob>(
  {
    analysis_run_id: { type: Schema.Types.ObjectId, ref: 'AnalysisRun', required: true, index: true },
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    dataset_id: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true },
    input_fingerprint: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'succeeded', 'failed', 'skipped'],
      required: true,
      default: 'pending',
      index: true,
    },
    attempt: { type: Number, required: true, default: 0 },
    model_id: { type: String, default: null },
    prompt_version: { type: String, default: null },
    error: { type: Schema.Types.Mixed, default: null },
    started_at: { type: Date, default: null },
    finished_at: { type: Date, default: null },
    duration_ms: { type: Number, default: null },
    heartbeat_at: { type: Date, default: null },
    lease_expires_at: { type: Date, default: null, index: true },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

AiJobSchema.index({ input_fingerprint: 1, status: 1 });
AiJobSchema.index({ project_id: 1, created_at: -1 });
