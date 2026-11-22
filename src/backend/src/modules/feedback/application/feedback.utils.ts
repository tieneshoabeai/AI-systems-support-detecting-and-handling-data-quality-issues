/**
 * FEEDBACK — Hàm thuần dùng chung cho handlers.
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 *
 * **Bước 3 — Rich Domain Model:** `toPlain()` nhận **entity** `Feedback`.
 */

import type { Feedback } from '../domain/entities/feedback.entity';

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
