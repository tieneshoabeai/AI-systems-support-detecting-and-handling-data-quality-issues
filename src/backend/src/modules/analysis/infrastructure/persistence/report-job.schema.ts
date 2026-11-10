import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';

export type ReportJobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface IReportJob extends Document, BaseEntity {
  _id: Types.ObjectId;
  project_id: Types.ObjectId;
  workspace_id: Types.ObjectId;
  project_save_id: Types.ObjectId | null;
  status: ReportJobStatus;
  storage_key: string | null;
  file_size_bytes: number | null;
  error: { code: string; message: string } | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const ReportJobSchema = new Schema<IReportJob>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    project_save_id: { type: Schema.Types.ObjectId, ref: 'ProjectSave', default: null },
    status: { type: String, enum: ['pending', 'running', 'succeeded', 'failed'], required: true, default: 'pending', index: true },
    storage_key: { type: String, default: null },
    file_size_bytes: { type: Number, default: null },
    error: { type: Schema.Types.Mixed, default: null },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

ReportJobSchema.index({ project_id: 1, created_at: -1 });
