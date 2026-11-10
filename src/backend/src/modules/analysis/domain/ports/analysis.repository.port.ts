/**
 * ANALYSIS — Domain repository port (hexagonal chuan).
 * Gop moi persistence ma Analysis/Summary/Report/AiWorker/RagFewShot can.
 * Application chi goi qua port nay, khong cham Mongoose.
 */

export const ANALYSIS_REPOSITORY_PORT = Symbol('AnalysisRepositoryPort');

export interface AnalysisRunRecord {
  _id?: unknown;
  id: string;
  projectId: string;
  workspaceId: string;
  datasetId: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  inputFingerprint: string;
  config: Record<string, unknown>;
  startedBy: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  error: { code: string; message: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CorrelationMatrixShape {
  method: 'pearson' | 'spearman';
  columns: string[];
  cells: Array<{ colA: string; colB: string; coef: number | null; kind: string; n: number; totalScanned: number; missingAOnly: number; missingBOnly: number; missingBoth: number; computable: boolean; reason: string | null }>;
  notes?: unknown;
  excludedColumns?: Array<{ column: string; reason: string }>;
  totalScanned?: number;
}
export interface VifShape {
  columns: string[];
  rows: Array<{ column: string; vif: number | null; flag: 'ok' | 'review' | 'high'; computable: boolean; reason: string | null }>;
  commonN: number;
  totalScanned: number;
  commonNRate: number | null;
  lossWarning: string | null;
  excluded: Array<{ column: string; reason: string }>;
}
export interface AnalysisResultRecord {
  id: string;
  analysisRunId: string;
  projectId: string;
  datasetId?: string | null;
  inputFingerprint: string;
  dqSummary?: unknown;
  /** alias snake_case cu */
  dq_summary?: unknown;
  dq05?: unknown;
  descriptive?: unknown;
  correlation?: CorrelationMatrixShape | null;
  /** alias cu cho correlation */
  correlationMatrix?: CorrelationMatrixShape | null;
  vif?: VifShape | null;
  imbalance?: unknown;
  temporal?: unknown;
  /** alias cu cho temporal */
  timeAnalysis?: unknown;
  evidenceSummary?: unknown;
  aiCorrelationAssessment?: unknown;
  isStale: boolean;
  staleReason?: string | null;
  createdAt: Date;
  updatedAt?: Date;
}

export interface AiJobRecord {
  id: string;
  analysisRunId?: string | null;
  projectId?: string | null;
  datasetId?: string | null;
  inputFingerprint?: string | null;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  attempt: number;
  modelId?: string | null;
  promptVersion?: string | null;
  prompt?: string | null;
  result?: Record<string, unknown> | null;
  error?: { code: string; message: string; retryable?: boolean } | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  durationMs?: number | null;
  heartbeatAt?: Date | null;
  leaseExpiresAt?: Date | null;
  // snake aliases cu
  analysis_run_id?: unknown;
  project_id?: unknown;
  dataset_id?: unknown;
  model_id?: string | null;
  prompt_version?: string | null;
  heartbeat_at?: Date | null;
  lease_expires_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalysisConfigRecord {
  projectId: string;
  workspaceId: string;
  selectedColumns: string[] | null;
  labelColumn: string | null;
  timeColumn: string | null;
  timeGranularity: string;
  valueColumn: string | null;
  correlationMethod?: string;
  outlierMethod?: string;
  topN?: number;
  // snake aliases cu
  selected_columns?: string[] | null;
  label_column?: string | null;
  time_column?: string | null;
  time_granularity?: string;
  value_column?: string | null;
  correlation_method?: string;
  outlier_method?: string;
  top_n?: number;
}

export interface ProjectSaveRecord {
  id: string;
  projectId: string;
  workspaceId?: string;
  analysisRunId: string | null;
  analysisResultId?: string | null;
  inputFingerprint: string;
  summary: Record<string, unknown>;
  isStale: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ReportJobRecord {
  id: string;
  projectId: string;
  workspaceId?: string;
  projectSaveId: string | null;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  storageKey?: string | null;
  fileSizeBytes?: number | null;
  error?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FewShotExampleRecord {
  id: string;
  workspaceId: string;
  projectId?: string | null;
  errorType: string;
  columnTraits?: string;
  description: string;
  label: string;
  trustScore: number;
  agreementCount: number;
  embedding: number[];
  language?: string | null;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CellEvidenceRecord {
  analysisRunId: string;
  column: string;
  rowIndex: number;
  reason?: string | null;
}

export interface AnalysisRepositoryPort {
  create(data: Partial<AnalysisRunRecord> & Record<string, unknown> & { projectId: string; workspaceId: string; datasetId: string }): Promise<AnalysisRunRecord>;
  findById(id: string): Promise<AnalysisRunRecord | null>;
  updateById(id: string, update: Partial<AnalysisRunRecord> & Record<string, unknown>): Promise<AnalysisRunRecord | null>;
  findRunByFingerprint(fingerprint: string): Promise<AnalysisRunRecord | null>;
  findLatestRunByProject(projectId: string): Promise<AnalysisRunRecord | null>;
  saveResult(doc: Partial<AnalysisResultRecord> & Record<string, unknown>): Promise<AnalysisResultRecord>;
  findResultByRun(runId: string): Promise<AnalysisResultRecord | null>;
  updateResultById(id: string, update: Record<string, unknown>): Promise<AnalysisResultRecord | null>;
  markResultsStale(projectId: string, keepRunId: string, reason: string): Promise<unknown>;
  createJob(doc: Partial<AiJobRecord> & Record<string, unknown>): Promise<AiJobRecord>;
  findJobById(id: string): Promise<AiJobRecord | null>;
  updateJobById(id: string, update: Record<string, unknown>): Promise<AiJobRecord | null>;
  claimPendingJob(leaseMs?: number): Promise<AiJobRecord | null>;
  skipStaleJobs(leaseMs?: number): Promise<unknown>;
  heartbeatJob(id: string, leaseMs?: number): Promise<AiJobRecord | null>;
  insertEvidences(docs: Partial<CellEvidenceRecord>[]): Promise<number>;
  countEvidencesByRun(runId: string): Promise<number>;
  findEvidencesByRun(runId: string, limit?: number): Promise<CellEvidenceRecord[]>;
  upsertConfig(projectId: string, workspaceId: string, doc: Record<string, unknown>): Promise<AnalysisConfigRecord>;
  findConfigByProject(projectId: string): Promise<AnalysisConfigRecord | null>;
  createSave(doc: Partial<ProjectSaveRecord> & Record<string, unknown> & { projectId: string }): Promise<ProjectSaveRecord>;
  findLatestSaveByProject(projectId: string): Promise<ProjectSaveRecord | null>;
  markSavesStale(projectId: string, keepId: string): Promise<unknown>;
  createReportJob(doc: Partial<ReportJobRecord> & Record<string, unknown> & { projectId: string }): Promise<ReportJobRecord>;
  findReportById(id: string): Promise<ReportJobRecord | null>;
  updateReportById(id: string, update: Record<string, unknown>): Promise<ReportJobRecord | null>;
  claimPendingReport(): Promise<ReportJobRecord | null>;
  saveFewShotExample(doc: Partial<FewShotExampleRecord> & Record<string, unknown>): Promise<FewShotExampleRecord>;
  enforceFewShotCap(cap?: number): Promise<number>;
  findFewShotCandidates(params: { workspaceId: string; errorType?: string; language?: string; minTrustScore: number; maxAgeDays: number; limit: number }): Promise<FewShotExampleRecord[]>;
  findDuplicateExample(params: { workspaceId: string; errorType: string; description: string; label: string }): Promise<FewShotExampleRecord | null>;
  updateFewShotTrust(id: string, update: { agreementCount: number; trustScore: number; embedding: number[] }): Promise<FewShotExampleRecord | null>;
  countFewShotExamples(workspaceId: string): Promise<number>;
}
