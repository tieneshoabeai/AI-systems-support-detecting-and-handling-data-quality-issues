/**
 * Public contract của module ISSUES.
 *
 * Các module khác chỉ được import qua file này (quy tắc CA8 — cross-module
 * import phải đi qua public contract), không import sâu vào
 * `domain/ports/...` hay `application/...`.
 */

export {
  ISSUE_REPORT_REPOSITORY_PORT,
  type CreateIssueRecord,
  type IssueAttachmentRecord,
  type IssueListQuery,
  type IssueReportRecord,
  type IssueReportRepositoryPort,
  type UpdateIssueByUserInput,
} from './domain/ports/issue-report.repository.port';

export {
  ALLOWED_ISSUE_TRANSITIONS,
  ISSUE_STATUSES,
  USER_EDITABLE_ISSUE_STATUSES,
  assertAllowedIssueTransition,
  isAllowedIssueTransition,
  isUserEditableIssueStatus,
  type IssueStatus,
} from './domain/value-objects/issue-status.vo';

export {
  ISSUE_TYPES,
  type IssueType,
} from './domain/value-objects/issue-type.vo';

// ── Handlers (Command/Query) ──────────────────────────
// ── Queries (đọc) ──────────────────────────────────────────────
export { DownloadAttachmentHandler } from './application/queries/download-attachment.handler';
export { GetForAdminHandler } from './application/queries/get-for-admin.handler';
export { GetMineHandler } from './application/queries/get-mine.handler';
export { ListForAdminHandler } from './application/queries/list-for-admin.handler';
export { ListMineHandler } from './application/queries/list-mine.handler';

// ── Commands (ghi) ─────────────────────────────────────────────
export { CreateReportHandler } from './application/commands/create-report.handler';
export { UpdateMyReportHandler } from './application/commands/update-my-report.handler';
export { UpdateStatusHandler } from './application/commands/update-status.handler';
export { UploadAttachmentHandler } from './application/commands/upload-attachment.handler';
