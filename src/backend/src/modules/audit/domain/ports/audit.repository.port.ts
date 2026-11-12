/**
 * AUDIT — Domain repository port (hexagonal chuan).
 * Append-only, khong co update/delete. Ghi log la tac dung phu (best-effort).
 */

export const AUDIT_REPOSITORY_PORT = Symbol('AuditRepositoryPort');

export type AuditAction =
  | 'ISSUE_STATUS_CHANGED'
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
  | 'report';

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
