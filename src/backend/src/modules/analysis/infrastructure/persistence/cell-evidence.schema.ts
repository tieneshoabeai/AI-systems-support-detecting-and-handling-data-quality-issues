import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';

export type CellEvidenceKind = 'missing' | 'duplicate' | 'invalid_type' | 'outlier';

export interface ICellEvidence extends Document, BaseEntity {
  _id: Types.ObjectId;
  analysis_run_id: Types.ObjectId;
  project_id: Types.ObjectId;
  dataset_id: Types.ObjectId;
  column: string;
  row_index: number;
  kind: CellEvidenceKind;
  reason: string | null;
  value_masked: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const CellEvidenceSchema = new Schema<ICellEvidence>(
  {
    analysis_run_id: { type: Schema.Types.ObjectId, ref: 'AnalysisRun', required: true, index: true },
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    dataset_id: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
    column: { type: String, required: true },
    row_index: { type: Number, required: true },
    kind: { type: String, enum: ['missing', 'duplicate', 'invalid_type', 'outlier'], required: true },
    reason: { type: String, default: null },
    value_masked: { type: String, default: null },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

CellEvidenceSchema.index({ analysis_run_id: 1, column: 1, row_index: 1 });
