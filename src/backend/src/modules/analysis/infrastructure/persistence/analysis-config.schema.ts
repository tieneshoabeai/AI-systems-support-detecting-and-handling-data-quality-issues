import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';

export interface IAnalysisConfig extends Document, BaseEntity {
  _id: Types.ObjectId;
  project_id: Types.ObjectId;
  workspace_id: Types.ObjectId;
  selected_columns: string[] | null;
  label_column: string | null;
  time_column: string | null;
  time_granularity: 'day' | 'week' | 'month' | 'year';
  value_column: string | null;
  correlation_method: 'pearson' | 'spearman';
  outlier_method: 'iqr' | 'modified_zscore' | 'both';
  top_n: number;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const AnalysisConfigSchema = new Schema<IAnalysisConfig>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    selected_columns: { type: [String], default: null },
    label_column: { type: String, default: null },
    time_column: { type: String, default: null },
    time_granularity: { type: String, enum: ['day', 'week', 'month', 'year'], default: 'day' },
    value_column: { type: String, default: null },
    correlation_method: { type: String, enum: ['pearson', 'spearman'], default: 'pearson' },
    outlier_method: { type: String, enum: ['iqr', 'modified_zscore', 'both'], default: 'iqr' },
    top_n: { type: Number, default: 10 },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);
