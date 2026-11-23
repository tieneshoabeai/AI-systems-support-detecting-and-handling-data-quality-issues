/**
 * FEEDBACK — Domain repository port (hexagonal chuẩn).
 *
 * **Bước 3 — Rich Domain Model:** port trả **entity** `Feedback`
 * (không phải record trần) → handler có thể gọi hành vi của entity
 * (`updateByAuthor()`, `softDelete()`).
 */

import type { Feedback } from '../entities/feedback.entity';

export const FEEDBACK_REPOSITORY_PORT = Symbol('FeedbackRepositoryPort');

export type { Feedback, FeedbackProps } from '../entities/feedback.entity';

export interface FeedbackListQuery {
  analysisRunId: string;
  findingId: string | null;
  limit: number;
  label?: string;
  sortOrder: 'asc' | 'desc';
  cursorCreatedAt?: Date;
  cursorId?: string;
}

export interface CreateFeedbackRecord {
  analysisRunId: string;
  projectId: string;
  workspaceId: string;
  findingId: string | null;
  findingKey?: string | null;
  authorId: string;
  label: string;
  reason?: string | null;
  suggestedSeverity?: string | null;
  aiConfidence?: number | null;
  aiRationale?: string | null;
  authorRoleAtTime?: string | null;
  modelId?: string | null;
  promptVersion?: string | null;
}

export interface FeedbackScope {
  workspaceId: string;
  findingId: string;
  label: string;
}

export interface FeedbackRepositoryPort {
  create(doc: CreateFeedbackRecord & Record<string, unknown>): Promise<Feedback>;
  listByScope(params: FeedbackListQuery): Promise<Feedback[]>;
  listActiveByRun(analysisRunId: string): Promise<Feedback[]>;
  findByIdActive(id: string): Promise<Feedback | null>;
  updateById(id: string, update: Partial<CreateFeedbackRecord> & Record<string, unknown>): Promise<Feedback | null>;
  softDelete(id: string): Promise<boolean>;
  countByProject(projectId: string): Promise<number>;
  countDistinctAuthors(scope: FeedbackScope): Promise<number>;
  countDistinctRuns(projectId: string): Promise<number>;
  aggregateByProject(projectId: string): Promise<Array<{ label: string; count: number }>>;
  /** Đếm theo phạm vi run/finding để dựng `summary` — không cắt ở 1000. */
  summaryByScope?(params: { analysisRunId: string; findingId?: string | null; label?: string }): Promise<Record<string, number>>;
}
