/**
 * ISSUE-REPORT — Domain repository port (hexagonal chuẩn).
 */

import type { IssueStatus } from '../value-objects/issue-status.vo';
import type { IssueType } from '../value-objects/issue-type.vo';

export const ISSUE_REPORT_REPOSITORY_PORT = Symbol('IssueReportRepositoryPort');

export interface IssueAttachmentRecord {
  id: string;
  filename: string;
  storageKey: string;
  sizeBytes: number;
  contentType: string;
}

export interface IssueReportRecord {
  id: string;
  userId: string;
  workspaceId: string | null;
  issueType: string;
  title: string;
  description: string;
  status: IssueStatus;
  attachments: Array<{ id: string; filename: string; storageKey?: string; sizeBytes: number; contentType: string }>;
  context: { apiPath?: string | null; errorMessage?: string | null; occurredAt?: Date | null } | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueListQuery {
  limit: number;
  sortBy: 'createdAt' | 'updatedAt' | 'status';
  sortOrder: 'asc' | 'desc';
  cursorCreatedAt?: Date;
  cursorId?: string;
  status?: IssueStatus;
  userId?: string;
}

export interface CreateIssueRecord {
  userId: string;
  workspaceId?: string | null;
  issueType: IssueType;
  title: string;
  description: string;
  context?: { apiPath?: string | null; errorMessage?: string | null; occurredAt?: Date | null };
}

/** Dữ liệu người dùng tự sửa khi admin yêu cầu bổ sung thông tin. */
export interface UpdateIssueByUserInput {
  userId: string;
  title?: string;
  description?: string;
  /** Danh sách id tệp đính kèm cần gỡ khỏi báo cáo. */
  removeAttachmentIds?: string[];
  expectedVersion: number;
}

export interface IssueReportRepositoryPort {
  create(doc: CreateIssueRecord): Promise<IssueReportRecord>;
  findById(id: string): Promise<IssueReportRecord | null>;
  findByIdForUser(id: string, userId: string): Promise<IssueReportRecord | null>;
  addAttachment(id: string, attachment: { id: string; filename: string; storageKey: string; sizeBytes: number; contentType: string }): Promise<IssueReportRecord | null>;
  list(opts: IssueListQuery): Promise<IssueReportRecord[]>;
  updateStatus(id: string, status: IssueStatus, expectedVersion: number): Promise<IssueReportRecord | null>;
  /**
   * Người dùng tự sửa báo cáo của chính mình (chỉ khi `status = needs_info`).
   * Ghi đè `title`/`description`, gỡ tệp đính kèm theo yêu cầu, tăng `version`
   * và chuyển trạng thái về `in_progress` (luồng "gửi lại sau khi bổ sung").
   */
  updateByUser(id: string, input: UpdateIssueByUserInput): Promise<IssueReportRecord | null>;
  findStatusById(id: string): Promise<IssueStatus | null>;
}
