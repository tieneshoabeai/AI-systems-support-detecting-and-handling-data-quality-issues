import { Types } from 'mongoose';
import type { IFindingFeedback } from './finding-feedback.schema';
import type { CreateFeedbackRecord } from './feedback.types';
import { Feedback } from './feedback.types';
import type {
  FeedbackLabel,
  FeedbackSeverity,
} from './feedback.types';

function oid(v: unknown): string {
  if (v instanceof Types.ObjectId) return v.toString();
  return String(v ?? '');
}

/**
 * FEEDBACK — Mapper infrastructure ↔ domain entity.
 *
 * **Bước 3 — Rich Domain Model:** chiều document → entity dùng
 * `reconstitute()` (không phát domain event).
 */

/** Document Mongoose → entity `Feedback`. */
export function toFeedbackEntity(doc: IFindingFeedback): Feedback {
  const raw = doc as unknown as Record<string, unknown>;
  return Feedback.reconstitute({
    id: oid(doc._id),
    analysisRunId: oid(doc.analysis_run_id),
    projectId: oid(doc.project_id),
    workspaceId: oid(doc.workspace_id),
    findingId: doc.finding_id ?? null,
    findingKey: (raw.finding_key as string | null) ?? null,
    authorId: oid(doc.author_id),
    label: doc.label as FeedbackLabel,
    reason: doc.reason ?? null,
    suggestedSeverity: (doc.suggested_severity as FeedbackSeverity | null) ?? null,
    aiConfidence: doc.ai_confidence ?? null,
    aiRationale: doc.ai_rationale ?? null,
    authorRoleAtTime: doc.author_role_at_time ?? null,
    modelId: doc.model_id ?? null,
    promptVersion: doc.prompt_version ?? null,
    version: 1,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    deletedAt: doc.deleted_at ?? null,
  });
}

/** Dữ liệu tạo mới → shape lưu trữ (Mongoose). */
export function toFeedbackPersistence(data: CreateFeedbackRecord): Record<string, unknown> {
  return {
    analysis_run_id: new Types.ObjectId(data.analysisRunId),
    project_id: new Types.ObjectId(data.projectId),
    workspace_id: new Types.ObjectId(data.workspaceId),
    finding_id: data.findingId,
    finding_key: data.findingKey ?? null,
    author_id: new Types.ObjectId(data.authorId),
    label: data.label,
    reason: data.reason ?? null,
    suggested_severity: data.suggestedSeverity ?? null,
    ai_confidence: data.aiConfidence ?? null,
    ai_rationale: data.aiRationale ?? null,
    author_role_at_time: data.authorRoleAtTime ?? null,
  };
}
