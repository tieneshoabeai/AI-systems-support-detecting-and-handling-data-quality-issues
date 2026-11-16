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

export interface IssueReportRepositoryPort {
  create(doc: CreateIssueRecord): Promise<IssueReportRecord>;
  findById(id: string): Promise<IssueReportRecord | null>;
  findByIdForUser(id: string, userId: string): Promise<IssueReportRecord | null>;
  addAttachment(id: string, attachment: { id: string; filename: string; storageKey: string; sizeBytes: number; contentType: string }): Promise<IssueReportRecord | null>;
  list(opts: IssueListQuery): Promise<IssueReportRecord[]>;
  updateStatus(id: string, status: IssueStatus, expectedVersion: number): Promise<IssueReportRecord | null>;
  findStatusById(id: string): Promise<IssueStatus | null>;
}
