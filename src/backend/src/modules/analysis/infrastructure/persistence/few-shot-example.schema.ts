import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';

/**
 * Phan 12 v8 §3.16.4 — Kho mau few-shot cho RAG (T1).
 * Vector luu trong MongoDB, truy van bang COSINE SIMILARITY thuan (nhom C).
 * Cap toi da 50.000 mau (FIFO).
 */
export type FewShotLabel = 'correct' | 'false_positive' | 'missed_issue';

export interface IFewShotExample extends Document, BaseEntity {
  _id: Types.ObjectId;
  workspace_id: Types.ObjectId;
  project_id: Types.ObjectId | null;
  error_type: string;
  column_traits: string;
  description: string;
  label: FewShotLabel;
  embedding: number[];
  trust_score: number;
  language: string;
  /** so nguoi dung dong y cung nhan — nhanh xet duoc dung khi >= 3 nguoi */
  agreement_count: number;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const FewShotExampleSchema = new Schema<IFewShotExample>(
  {
    workspace_id: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    error_type: { type: String, required: true, index: true },
    column_traits: { type: String, required: true },
    description: { type: String, required: true },
    label: {
      type: String,
      enum: ['correct', 'false_positive', 'missed_issue'],
      required: true,
    },
    embedding: { type: [Number], required: true },
    trust_score: { type: Number, required: true, default: 0.6, min: 0, max: 1 },
    language: { type: String, required: true, default: 'vi' },
    agreement_count: { type: Number, required: true, default: 0, min: 0 },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

FewShotExampleSchema.index({ workspace_id: 1, error_type: 1, created_at: -1 });
FewShotExampleSchema.index({ workspace_id: 1, language: 1, trust_score: -1 });
