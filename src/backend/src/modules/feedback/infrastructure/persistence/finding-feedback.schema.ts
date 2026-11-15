import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';

export type FeedbackLabel =
  | 'correct'
  | 'partially_correct'
  | 'false_positive'
  | 'missed_issue'
  | 'other';

export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';

export const FeedbackLabels: FeedbackLabel[] = [
  'correct',
  'partially_correct',
  'false_positive',
  'missed_issue',
  'other',
];

export const LabelsRequiringReason: FeedbackLabel[] = [
  'false_positive',
  'missed_issue',
  'other',
];

export interface IFindingFeedback extends Document, BaseEntity {
  _id: Types.ObjectId;
  analysis_run_id: Types.ObjectId;
  finding_id: string | null;
  project_id: Types.ObjectId;
  workspace_id: Types.ObjectId;
  label: FeedbackLabel;
  reason: string | null;
  suggested_severity: FeedbackSeverity | null;
  ai_confidence: number | null;
  ai_rationale: string | null;
  author_id: Types.ObjectId;
  author_role_at_time: string;
  model_id: string | null;
  prompt_version: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const FindingFeedbackSchema = new Schema<IFindingFeedback>(
  {
    analysis_run_id: {
      type: Schema.Types.ObjectId,
      ref: 'AnalysisRun',
      required: true,
      index: true,
    },
    finding_id: { type: String, default: null, index: true },
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    label: { type: String, enum: [...FeedbackLabels], required: true, index: true },
    reason: { type: String, default: null, maxlength: 2000 },
    suggested_severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: null,
    },
    ai_confidence: { type: Number, default: null },
    ai_rationale: { type: String, default: null, maxlength: 1000 },
    author_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    author_role_at_time: { type: String, required: true },
    model_id: { type: String, default: null, index: true },
    prompt_version: { type: String, default: null },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

FindingFeedbackSchema.index({ analysis_run_id: 1, finding_id: 1, created_at: -1 });
FindingFeedbackSchema.index({ project_id: 1, created_at: -1 });
FindingFeedbackSchema.index({ label: 1, created_at: -1 });
FindingFeedbackSchema.index({ model_id: 1, created_at: -1 });
FindingFeedbackSchema.index({ author_id: 1, created_at: -1 });
FindingFeedbackSchema.index({ created_at: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });
