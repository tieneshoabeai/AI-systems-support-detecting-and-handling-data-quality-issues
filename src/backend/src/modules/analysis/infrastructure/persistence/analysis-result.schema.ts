import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';

export type CorrelationKind = 'pearson' | 'spearman' | 'cramers_v' | 'eta_squared';
export type VifFlag = 'ok' | 'review' | 'high';

export interface ICorrelationCell {
  colA: string;
  colB: string;
  coef: number | null;
  kind: CorrelationKind;
  n: number;
  /** tong dong quet cho cap nay (pairwise denominator) */
  totalScanned: number;
  /** chi thieu/khong hop le o colA */
  missingAOnly: number;
  /** chi thieu/khong hop le o colB */
  missingBOnly: number;
  /** thieu/khong hop le o ca hai cot */
  missingBoth: number;
  computable: boolean;
  reason: string | null;
}

export interface IVifRow {
  column: string;
  vif: number | null;
  flag: VifFlag;
  computable: boolean;
  reason: string | null;
}

export interface IAiCorrelationAssessment {
  status: 'pending' | 'succeeded' | 'failed';
  notablePairs: { colA: string; colB: string; coef: number; kind: string; n: number }[];
  highVif: string[];
  limits: string[];
  nextSteps: string[];
  modelId: string | null;
  promptVersion: 'corr-v1';
  error: string | null;
  droppedClaims: string[];
}

export interface IAnalysisResult extends Document, BaseEntity {
  _id: Types.ObjectId;
  analysis_run_id: Types.ObjectId;
  project_id: Types.ObjectId;
  dataset_id: Types.ObjectId;
  input_fingerprint: string;
  is_stale: boolean;
  stale_reason: string | null;
  dq05: {
    status: 'unassessed' | 'assessed';
    reason: string | null;
    rules: unknown[];
    violations: unknown[];
  };
  correlationMatrix: {
    method: 'pearson' | 'spearman';
    columns: string[];
    cells: ICorrelationCell[];
    notes: string[];
    excludedColumns: { column: string; reason: string }[];
    totalScanned: number;
  } | null;
  vif: {
    columns: string[];
    rows: IVifRow[];
    commonN: number;
    totalScanned: number;
    commonNRate: number | null;
    lossWarning: string | null;
    excluded: { column: string; reason: string }[];
  } | null;
  aiCorrelationAssessment: IAiCorrelationAssessment | null;
  dq_summary: {
    totalScanned: number;
    columns: {
      column: string;
      missingCount: number;
      missingRate: number | null;
      invalidCount: number;
      invalidRate: number | null;
      outlierCount: number;
      outlierRate: number | null;
      checkedRows: number;
      excludedRows: number;
      method: string;
      reason: string | null;
    }[];
    duplicateGroups: { key: string; rowIndexes: number[]; count: number; hasPartialMissing: boolean }[];
    duplicateRowCount: number;
    fullyMissingRows: number;
    partiallyMissingRows: number;
    notes: string[];
  } | null;
  descriptive: unknown | null;
  imbalance: unknown | null;
  timeAnalysis: unknown | null;
  evidenceSummary: { total: number; byKind: Record<string, number>; byColumn: Record<string, number>; capped: boolean } | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const AnalysisResultSchema = new Schema<IAnalysisResult>(
  {
    analysis_run_id: { type: Schema.Types.ObjectId, ref: 'AnalysisRun', required: true, index: true },
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    dataset_id: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true },
    input_fingerprint: { type: String, required: true, index: true },
    is_stale: { type: Boolean, required: true, default: false },
    stale_reason: { type: String, default: null },
    dq05: { type: Schema.Types.Mixed, required: true },
    correlationMatrix: { type: Schema.Types.Mixed, default: null },
    vif: { type: Schema.Types.Mixed, default: null },
    aiCorrelationAssessment: { type: Schema.Types.Mixed, default: null },
    dq_summary: { type: Schema.Types.Mixed, default: null },
    descriptive: { type: Schema.Types.Mixed, default: null },
    imbalance: { type: Schema.Types.Mixed, default: null },
    timeAnalysis: { type: Schema.Types.Mixed, default: null },
    evidenceSummary: { type: Schema.Types.Mixed, default: null },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

AnalysisResultSchema.index({ project_id: 1, created_at: -1 });
AnalysisResultSchema.index({ input_fingerprint: 1, is_stale: 1 });
