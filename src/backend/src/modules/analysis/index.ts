/**
 * Public contract của module ANALYSIS.
 *
 * Các module khác chỉ được import qua file này (quy tắc CA8 — cross-module
 * import phải đi qua public contract), không import sâu vào
 * `domain/ports/...` hay `application/...`.
 */

export {
  ANALYSIS_REPOSITORY_PORT,
  type AiJobRecord,
  type AnalysisConfigRecord,
  type AnalysisRepositoryPort,
  type AnalysisResultRecord,
  type AnalysisRunRecord,
  type CellEvidenceRecord,
  type CorrelationMatrixShape,
  type FewShotExampleRecord,
  type ProjectSaveRecord,
  type ReportJobRecord,
  type VifShape,
} from './domain/ports/analysis.repository.port';

export {
  RAG_FEW_SHOT_PORT,
  type RagFewShotPort,
} from './domain/ports/rag-few-shot.port';

export {
  DEFAULT_MAX_AGE_DAYS,
  DEFAULT_MIN_TRUST_SCORE,
  DEFAULT_TOP_K,
  KNOWN_ERROR_TYPES,
  MAX_FEW_SHOT_STORE,
  computeTrustScore,
  embedText,
  extractErrorType,
  isEligibleForStore,
  mapFeedbackLabelToExampleLabel,
  normalizeExample,
  rankFewShot,
  renderFewShotBlock,
  stripIdentifiers,
  type FewShotExample,
  type RagQuery,
} from './domain/rag-few-shot.util';

// ── Handlers (Command/Query) ──────────────────────────
// ── Queries (đọc) ──────────────────────────────────────────────
export { DownloadReportFileHandler } from './application/queries/download-report-file.handler';
export { GetConfigHandler } from './application/queries/get-config.handler';
export { GetJobHandler } from './application/queries/get-job.handler';
export { GetReportFileMetaHandler } from './application/queries/get-report-file-meta.handler';
export { GetResultHandler } from './application/queries/get-result.handler';
export { GetSummaryHandler } from './application/queries/get-summary.handler';

// ── Commands (ghi) ─────────────────────────────────────────────
export { BuildPromptForJobHandler } from './application/commands/build-prompt-for-job.handler';
export { CreateSummaryHandler } from './application/commands/create-summary.handler';
export { IngestAiResultHandler } from './application/commands/ingest-ai-result.handler';
export { RequestReportHandler } from './application/commands/request-report.handler';
export { RetryJobHandler } from './application/commands/retry-job.handler';
export { RunAnalysisHandler } from './application/commands/run-analysis.handler';
export { SaveConfigHandler } from './application/commands/save-config.handler';

// ── Policy loaders (dùng cho `@PolicyResource` — tầng động chống IDOR) ────
export { AnalysisJobPolicyLoader } from './application/policy-loaders/analysis-job-policy.loader';
export { AnalysisRunPolicyLoader } from './application/policy-loaders/analysis-run-policy.loader';
