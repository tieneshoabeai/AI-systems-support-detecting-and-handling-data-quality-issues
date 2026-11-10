import { Types } from 'mongoose';
import type { IAnalysisRun } from './analysis-run.schema';
import type { IAnalysisResult } from './analysis-result.schema';
import type { IAiJob } from './ai-job.schema';
import type { IAnalysisConfig } from './analysis-config.schema';
import type { IProjectSave } from './project-save.schema';
import type { IReportJob } from './report-job.schema';
import type { IFewShotExample } from './few-shot-example.schema';
import type { ICellEvidence } from './cell-evidence.schema';
import type {
  CorrelationMatrixShape,
  VifShape,
  AiJobRecord,
  AnalysisConfigRecord,
  AnalysisResultRecord,
  AnalysisRunRecord,
  CellEvidenceRecord,
  FewShotExampleRecord,
  ProjectSaveRecord,
  ReportJobRecord,
} from '../../domain/ports/analysis.repository.port';

function oid(v: unknown): string {
  if (v instanceof Types.ObjectId) return v.toString();
  if (v && typeof (v as { toString: () => string }).toString === 'function') return (v as { toString: () => string }).toString();
  return String(v ?? '');
}

export function toAnalysisRunRecord(doc: IAnalysisRun): AnalysisRunRecord {
  return {
    id: oid(doc._id),
    projectId: oid(doc.project_id),
    workspaceId: oid(doc.workspace_id),
    datasetId: oid(doc.dataset_id),
    status: doc.status,
    inputFingerprint: doc.input_fingerprint,
    config: ((doc.config ?? {}) as unknown as Record<string, unknown>),
    startedBy: doc.started_by ? oid(doc.started_by) : null,
    startedAt: doc.started_at ?? null,
    finishedAt: doc.finished_at ?? null,
    durationMs: doc.duration_ms ?? null,
    error: doc.error ?? null,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

export function toAnalysisRunPersistence(data: {
  projectId: string; workspaceId: string; datasetId: string;
  status: AnalysisRunRecord['status']; inputFingerprint: string;
  config: Record<string, unknown>; startedBy: string | null; startedAt: Date | null;
}): Record<string, unknown> {
  return {
    project_id: new Types.ObjectId(data.projectId),
    workspace_id: new Types.ObjectId(data.workspaceId),
    dataset_id: new Types.ObjectId(data.datasetId),
    status: data.status,
    input_fingerprint: data.inputFingerprint,
    config: data.config,
    started_by: data.startedBy ? new Types.ObjectId(data.startedBy) : null,
    started_at: data.startedAt,
  };
}

export function toAnalysisResultRecord(doc: IAnalysisResult): AnalysisResultRecord {
  const raw = doc as unknown as Record<string, unknown>;
  const corr = (raw.correlationMatrix ?? null) as unknown as CorrelationMatrixShape | null;
  const vif = (raw.vif ?? null) as unknown as VifShape | null;
  const dqSummary = (raw.dq_summary ?? null) as unknown;
  const dq05 = (raw.dq05 ?? null) as unknown;
  return {
    id: oid(doc._id),
    analysisRunId: oid(doc.analysis_run_id),
    projectId: oid(doc.project_id),
    datasetId: doc.dataset_id ? oid(doc.dataset_id) : null,
    inputFingerprint: doc.input_fingerprint,
    dqSummary,
    dq_summary: dqSummary,
    dq05,
    descriptive: (raw.descriptive ?? null) as unknown,
    correlation: corr,
    correlationMatrix: corr,
    vif,
    imbalance: (raw.imbalance ?? null) as unknown,
    temporal: (raw.timeAnalysis ?? null) as unknown,
    timeAnalysis: (raw.timeAnalysis ?? null) as unknown,
    evidenceSummary: (raw.evidenceSummary ?? null) as unknown,
    aiCorrelationAssessment: (raw.aiCorrelationAssessment ?? null) as unknown,
    isStale: doc.is_stale ?? false,
    staleReason: (raw.stale_reason ?? null) as string | null,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

export function toAiJobRecord(doc: IAiJob): AiJobRecord {
  return {
    id: oid(doc._id),
    analysisRunId: doc.analysis_run_id ? oid(doc.analysis_run_id) : null,
    projectId: doc.project_id ? oid(doc.project_id) : null,
    datasetId: doc.dataset_id ? oid(doc.dataset_id) : null,
    inputFingerprint: doc.input_fingerprint ?? null,
    status: doc.status,
    attempt: doc.attempt ?? 0,
    modelId: doc.model_id ?? null,
    promptVersion: doc.prompt_version ?? null,
    prompt: null,
    result: null,
    error: doc.error ?? null,
    startedAt: doc.started_at ?? null,
    finishedAt: doc.finished_at ?? null,
    durationMs: doc.duration_ms ?? null,
    heartbeatAt: doc.heartbeat_at ?? null,
    leaseExpiresAt: doc.lease_expires_at ?? null,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

export function toAnalysisConfigRecord(doc: IAnalysisConfig): AnalysisConfigRecord {
  return {
    projectId: oid(doc.project_id),
    workspaceId: oid(doc.workspace_id),
    selectedColumns: doc.selected_columns ?? null,
    labelColumn: doc.label_column ?? null,
    timeColumn: doc.time_column ?? null,
    timeGranularity: String(doc.time_granularity ?? 'day'),
    valueColumn: doc.value_column ?? null,
    correlationMethod: doc.correlation_method ?? 'pearson',
    outlierMethod: doc.outlier_method ?? 'iqr',
    topN: doc.top_n ?? 10,
  };
}

export function toProjectSaveRecord(doc: IProjectSave): ProjectSaveRecord {
  return {
    id: oid(doc._id),
    projectId: oid(doc.project_id),
    workspaceId: oid(doc.workspace_id),
    analysisRunId: doc.analysis_run_id ? oid(doc.analysis_run_id) : null,
    analysisResultId: doc.analysis_result_id ? oid(doc.analysis_result_id) : null,
    inputFingerprint: doc.input_fingerprint ?? '',
    summary: (doc.summary ?? {}) as Record<string, unknown>,
    isStale: doc.is_stale ?? false,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

export function toReportJobRecord(doc: IReportJob): ReportJobRecord {
  return {
    id: oid(doc._id),
    projectId: oid(doc.project_id),
    workspaceId: oid(doc.workspace_id),
    projectSaveId: doc.project_save_id ? oid(doc.project_save_id) : null,
    status: doc.status,
    storageKey: doc.storage_key ?? null,
    fileSizeBytes: doc.file_size_bytes ?? null,
    error: (doc.error ?? null) as Record<string, unknown> | null,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

export function toFewShotRecord(doc: IFewShotExample): FewShotExampleRecord {
  return {
    id: oid(doc._id),
    workspaceId: oid(doc.workspace_id),
    projectId: doc.project_id ? oid(doc.project_id) : null,
    errorType: doc.error_type,
    columnTraits: doc.column_traits ?? '',
    description: doc.description,
    label: doc.label,
    trustScore: doc.trust_score ?? 0.6,
    agreementCount: doc.agreement_count ?? 0,
    embedding: doc.embedding ?? [],
    language: doc.language ?? null,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

export function toCellEvidenceRecord(doc: ICellEvidence): CellEvidenceRecord {
  return {
    analysisRunId: oid(doc.analysis_run_id),
    column: doc.column,
    rowIndex: doc.row_index,
    reason: doc.reason ?? null,
  };
}
