/**
 * ISSUES — Kiểu dữ liệu tầng application (input/output contract).
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 * Không import HTTP, không import infrastructure.
 */

import { type IssueType } from '../domain/value-objects/issue-type.vo';
import { type IssueStatus } from '../domain/value-objects/issue-status.vo';

export interface CreateIssueInput {
  issueType: IssueType;
  title: string;
  description: string;
  workspaceId?: string;
  apiPath?: string;
  errorMessage?: string;
  occurredAt?: string;
}

export interface ListIssuesInput {
  cursor?: string;
  limit: number;
  sortBy: 'createdAt' | 'updatedAt' | 'status';
  sortOrder: 'asc' | 'desc';
  status?: IssueStatus;
}

export interface AdminListIssuesInput {
  cursor?: string;
  limit: number;
  sortBy: 'createdAt' | 'updatedAt' | 'status' | 'severity';
  sortOrder: 'asc' | 'desc';
  status?: IssueStatus;
}
