/**
 * ISSUES — Hàm thuần dùng chung cho handlers.
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 */

import { isMandatoryNotification, shouldDispatch } from '../../notifications';
import type { NotificationRepositoryPort } from '../../notifications';
import type { UserRepositoryPort } from '../../users';
import type { RealtimePort } from '../../realtime';

import { type IssueReportRecord } from '../domain/ports/issue-report.repository.port';

export function toResponse(doc: IssueReportRecord): Record<string, unknown> {
  return {
    id: doc.id,
    userId: doc.userId,
    workspaceId: doc.workspaceId,
    issueType: doc.issueType,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    attachments: (doc.attachments ?? []).map((a) => ({
      ...(a as unknown as Record<string, unknown>),
      downloadUrl: `/api/v1/issues/${doc.id}/attachments/${(a as unknown as { id: string }).id}`,
    })),
    context: doc.context,
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function dispatchViaPorts(
  repo: NotificationRepositoryPort,
  users: UserRepositoryPort,
  realtime: RealtimePort | undefined,
  params: { userId: string; type: 'issue_needs_info' | 'issue_resolved'; title: string; summary: string; targetId: string; isMandatory: boolean },
): Promise<void> {
  const user = await users.findById(params.userId).catch(() => null);
  const enabled = user ? user.notificationsEnabled : undefined;
  const mandatory = isMandatoryNotification(params.type, params.isMandatory);
  if (!shouldDispatch(enabled, mandatory)) return;
  const created = await repo.createIfEventNotExists({
    userId: params.userId,
    type: params.type,
    title: params.title,
    summary: params.summary,
    payload: { targetType: 'issue', targetId: params.targetId },
    sourceEventId: null,
    isMandatory: mandatory,
  });
  if (created) {
    try {
      realtime?.emitToUser(params.userId, 'notification.created', {
        notificationId: created.id,
        notificationType: created.type,
      });
    } catch {
      // realtime không bao giờ làm hỏng luồng nghiệp vụ chính
    }
  }
}
