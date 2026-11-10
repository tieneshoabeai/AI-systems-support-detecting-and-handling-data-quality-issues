import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';

export interface IProjectSave extends Document, BaseEntity {
  _id: Types.ObjectId;
  project_id: Types.ObjectId;
  workspace_id: Types.ObjectId;
  analysis_run_id: Types.ObjectId | null;
  analysis_result_id: Types.ObjectId | null;
  input_fingerprint: string | null;
  is_stale: boolean;
  summary: {
    overview: string;
    issues: { dq: string; column: string | null; count: number; rate: number | null }[];
    evidence_refs: number;
    recommendations: string[];
    ai_section: unknown | null;
  };
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const ProjectSaveSchema = new Schema<IProjectSave>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    analysis_run_id: { type: Schema.Types.ObjectId, ref: 'AnalysisRun', default: null },
    analysis_result_id: { type: Schema.Types.ObjectId, ref: 'AnalysisResult', default: null },
    input_fingerprint: { type: String, default: null },
    is_stale: { type: Boolean, required: true, default: false },
    summary: { type: Schema.Types.Mixed, required: true },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

ProjectSaveSchema.index({ project_id: 1, created_at: -1 });
