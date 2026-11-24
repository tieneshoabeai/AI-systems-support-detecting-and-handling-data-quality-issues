/**
 * AUDIT — Types + ports (Template Simple).
 * Gop tu domain/ports/audit.repository.port.ts + audit-logger.port.ts — giu nguyen Symbol.
 * Append-only, khong co update/delete. Ghi log la tac dung phu (best-effort).
 */

export const AUDIT_REPOSITORY_PORT = Symbol('AuditRepositoryPort');

export type AuditAction =
  | 'ISSUE_STATUS_CHANGED'
  | 'ISSUE_REPORT_UPDATED'
  | 'ISSUE_LIST_VIEWED'
  | 'USER_PROFILE_VIEWED'
  | 'USER_LIST_VIEWED'
  | 'WORKSPACE_ROLE_CHANGED'
  | 'PROJECT_ROLE_CHANGED'
  | 'WORKSPACE_OWNER_TRANSFERRED'
  | 'PROJECT_OWNER_TRANSFERRED'
  | 'DATASET_FILE_DOWNLOADED'
  | 'REPORT_FILE_DOWNLOADED'
  | 'ISSUE_ATTACHMENT_DOWNLOADED'
  /** Chủ nhận xét sửa nhận xét — lịch sử nội bộ (Phần 7 v14 §3.24 FB-R9). */
  | 'FEEDBACK_UPDATED'
  /** Owner / SYS-ADMIN xoá nhận xét vi phạm của người khác (FB-R8). */
  | 'FEEDBACK_MODERATION_DELETED'
  /** Thử lại job AI qua HTTP (Phần 6 v9 §3.22, Phần 7 v15 VA-2). */
  | 'AI_JOB_RETRIED'
  /** SYS-ADMIN nạp kết quả AI thủ công (VA-1, VA-2). */
  | 'AI_RESULT_INGESTED'
  | 'ISSUE_ATTACHMENT_UPLOADED'
  | 'WORKSPACE_DELETED'
  | 'PROJECT_DELETED'
  | 'DATASET_RESET';

export type AuditTargetType =
  | 'workspace'
  | 'project'
  | 'issue_report'
  | 'user'
  | 'dataset'
  | 'project_save'
  | 'report'
  | 'finding_feedback'
  | 'ai_job';

export interface CreateAuditLogInput {
  actorId: string | null;
  actorRole: string | null;
  action: AuditAction | string;
  targetType: AuditTargetType | string;
  targetId: string | null;
  targetLabel?: string | null;
  workspaceId?: string | null;
  projectId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditChangeInput {
  field: string;
  beforeValue?: unknown;
  afterValue?: unknown;
}

export interface AuditLogRecord {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: Date;
}

export interface AuditRepositoryPort {
  createLog(input: CreateAuditLogInput, changes?: AuditChangeInput[]): Promise<AuditLogRecord>;
}

export const AUDIT_LOGGER_PORT = Symbol('AuditLoggerPort');

export interface AuditLoggerPort {
  /** Ghi một dòng audit log (best-effort — lỗi ghi log KHÔNG làm hỏng luồng chính). */
  log(input: CreateAuditLogInput, changes?: AuditChangeInput[]): Promise<void>;
}
