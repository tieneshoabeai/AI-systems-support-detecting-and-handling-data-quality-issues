/**
 * FEEDBACK — Utils (Template Simple). Ham toPlain nhan entity Feedback.
 */

import type { Feedback } from './feedback.types';

export function toPlain(
  doc: Feedback,
  viewerId: string,
  authorDisplayName: string | null,
): Record<string, unknown> {
  const isMine = doc.isOwnedBy(viewerId);
  const base: Record<string, unknown> = {
    id: doc.id,
    analysisRunId: doc.analysisRunId,
    findingId: doc.findingId,
    projectId: doc.projectId,
    label: doc.label,
    reason: doc.reason,
    suggestedSeverity: doc.suggestedSeverity,
    aiConfidence: doc.aiConfidence,
    aiRationale: doc.aiRationale,
    authorRoleAtTime: doc.authorRoleAtTime,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  if (isMine) {
    return { ...base, isMine: true, authorId: doc.authorId, authorDisplayName };
  }
  return { ...base, isMine: false, authorDisplayName };
}
