/**
 * ISSUE-REPORT — Domain repository port (chuẩn hexagonal).
 *
 * **Bước 3 — Rich Domain Model:** port trả **entity** `IssueReport`
 * (không phải record trần) → handler có thể gọi hành vi của entity
 * (`transitionTo()`, `updateByUser()`, `addAttachment()`).
 */

import type { IssueReport } from '../entities/issue-report.entity';
import type { IssueAttachment, IssueContext } from '../entities/issue-report.entity';
import type { IssueStatus } from '../value-objects/issue-status.vo';
import type { IssueType } from '../value-objects/issue-type.vo';

export const ISSUE_REPORT_REPOSITORY_PORT = Symbol('IssueReportRepositoryPort');

export type { IssueReport, IssueAttachment, IssueContext } from '../entities/issue-report.entity';

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
  context?: IssueContext | null;
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
  create(doc: CreateIssueRecord): Promise<IssueReport>;
  findById(id: string): Promise<IssueReport | null>;
  findByIdForUser(id: string, userId: string): Promise<IssueReport | null>;
  addAttachment(id: string, attachment: IssueAttachment): Promise<IssueReport | null>;
  list(opts: IssueListQuery): Promise<IssueReport[]>;
  updateStatus(id: string, status: IssueStatus, expectedVersion: number): Promise<IssueReport | null>;
  /**
   * Người dùng tự sửa báo cáo của chính mình (chỉ khi `status = needs_info`).
   * Ghi đè `title`/`description`, gỡ tệp đính kèm theo yêu cầu, tăng `version`
   * và chuyển trạng thái về `in_progress` (luồng "gửi lại sau khi bổ sung").
   */
  updateByUser(id: string, input: UpdateIssueByUserInput): Promise<IssueReport | null>;
  findStatusById(id: string): Promise<IssueStatus | null>;
}
