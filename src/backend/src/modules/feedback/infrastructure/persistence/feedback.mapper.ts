import { Types } from 'mongoose';
import type { IFindingFeedback } from './finding-feedback.schema';
import type { CreateFeedbackRecord, FeedbackRecord } from '../../domain/ports/feedback.repository.port';

function oid(v: unknown): string {
  if (v instanceof Types.ObjectId) return v.toString();
  return String(v ?? '');
}

export function toFeedbackRecord(doc: IFindingFeedback): FeedbackRecord {
  const raw = doc as unknown as Record<string, unknown>;
  return {
    id: oid(doc._id),
    analysisRunId: oid(doc.analysis_run_id),
    projectId: oid(doc.project_id),
    workspaceId: oid(doc.workspace_id),
    findingId: doc.finding_id ?? null,
    findingKey: (raw.finding_key as string | null) ?? null,
    authorId: oid(doc.author_id),
    label: doc.label,
    reason: doc.reason ?? null,
    suggestedSeverity: doc.suggested_severity ?? null,
    aiConfidence: doc.ai_confidence ?? null,
    aiRationale: doc.ai_rationale ?? null,
    authorRoleAtTime: doc.author_role_at_time ?? null,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

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
