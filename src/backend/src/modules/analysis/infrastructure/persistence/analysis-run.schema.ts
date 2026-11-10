import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';

export type AnalysisRunStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface IAnalysisConfigSnapshot {
  selected_column_keys: string[];
  correlation_method: 'pearson' | 'spearman';
  outlier_method: 'iqr' | 'modified_zscore' | 'both';
  top_n: number;
}

export interface IAnalysisRun extends Document, BaseEntity {
  _id: Types.ObjectId;
  project_id: Types.ObjectId;
  workspace_id: Types.ObjectId;
  dataset_id: Types.ObjectId;
  status: AnalysisRunStatus;
  input_fingerprint: string;
  config: IAnalysisConfigSnapshot;
  started_by: Types.ObjectId | null;
  started_at: Date | null;
  finished_at: Date | null;
  duration_ms: number | null;
  error: { code: string; message: string } | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const AnalysisRunSchema = new Schema<IAnalysisRun>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    dataset_id: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'succeeded', 'failed'],
      required: true,
      default: 'pending',
      index: true,
    },
    input_fingerprint: { type: String, required: true, index: true },
    config: { type: Schema.Types.Mixed, required: true },
    started_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    started_at: { type: Date, default: null },
    finished_at: { type: Date, default: null },
    duration_ms: { type: Number, default: null },
    error: { type: Schema.Types.Mixed, default: null },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

AnalysisRunSchema.index({ project_id: 1, created_at: -1 });
AnalysisRunSchema.index({ input_fingerprint: 1, status: 1 });
