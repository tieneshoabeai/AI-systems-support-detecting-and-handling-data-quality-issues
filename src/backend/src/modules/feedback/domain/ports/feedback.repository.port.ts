/**
 * FEEDBACK — Domain repository port (hexagonal chuẩn).
 */

export const FEEDBACK_REPOSITORY_PORT = Symbol('FeedbackRepositoryPort');

export interface FeedbackRecord {
  id: string;
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
  createdAt: Date;
  updatedAt: Date;
}

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
}

export interface FeedbackScope {
  workspaceId: string;
  findingId: string;
  label: string;
}

export interface FeedbackRepositoryPort {
  create(doc: CreateFeedbackRecord & Record<string, unknown>): Promise<FeedbackRecord>;
  listByScope(params: FeedbackListQuery): Promise<FeedbackRecord[]>;
  listActiveByRun(analysisRunId: string): Promise<FeedbackRecord[]>;
  findByIdActive(id: string): Promise<FeedbackRecord | null>;
  updateById(id: string, update: Partial<CreateFeedbackRecord> & Record<string, unknown>): Promise<FeedbackRecord | null>;
  softDelete(id: string): Promise<boolean>;
  countByProject(projectId: string): Promise<number>;
  countDistinctAuthors(scope: FeedbackScope): Promise<number>;
  countDistinctRuns(projectId: string): Promise<number>;
  aggregateByProject(projectId: string): Promise<Array<{ label: string; count: number }>>;
}
