/**
 * Public contract của module FEEDBACK.
 *
 * Các module khác chỉ được import qua file này (quy tắc CA8 — cross-module
 * import phải đi qua public contract), không import sâu vào
 * `domain/ports/...` hay `application/...`.
 */

export {
  FEEDBACK_REPOSITORY_PORT,
  type CreateFeedbackRecord,
  type FeedbackListQuery,
  type FeedbackRecord,
  type FeedbackRepositoryPort,
  type FeedbackScope,
} from './domain/ports/feedback.repository.port';

export {
  FEEDBACK_LABELS,
  FEEDBACK_SEVERITIES,
  LABELS_REQUIRING_REASON,
  assertReasonForLabel,
  requiresReason,
  type FeedbackLabel,
  type FeedbackSeverity,
} from './domain/value-objects/feedback-label.vo';

// ── Handlers (Command/Query) ──────────────────────────
// ── Queries (đọc) ──────────────────────────────────────────────
export { ListFindingFeedbackHandler } from './application/queries/list-finding-feedback.handler';
export { ListRunFeedbackHandler } from './application/queries/list-run-feedback.handler';

// ── Commands (ghi) ─────────────────────────────────────────────
export { AiQualityMetricsHandler } from './application/commands/ai-quality-metrics.handler';
export { CreateFindingFeedbackHandler } from './application/commands/create-finding-feedback.handler';
export { CreateRunFeedbackHandler } from './application/commands/create-run-feedback.handler';
export { RemoveHandler } from './application/commands/remove.handler';
export { UpdateMineHandler } from './application/commands/update-mine.handler';
