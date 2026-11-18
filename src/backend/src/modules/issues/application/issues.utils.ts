/**
 * ISSUES — Hàm thuần dùng chung cho handlers.
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 *
 * **Bước 3 — Rich Domain Model:** `toResponse()` nhận **entity** `IssueReport`.
 *
 * **Bảo mật:** `storageKey` của tệp đính kèm là **chi tiết hạ tầng** (đường dẫn
 * R2) — tuyệt đối không lộ ra API. Trước đây mapper trả nguyên object
 * attachment (`...a`) nên `storageKey` bị lộ cùng response. Nay chỉ trả
 * `id`, `filename`, `sizeBytes`, `contentType` + `downloadUrl`.
 */

import { isMandatoryNotification, shouldDispatch } from '../../notifications';
import type { NotificationRepositoryPort } from '../../notifications';
import type { UserRepositoryPort } from '../../users';
import type { RealtimePort } from '../../realtime';

import type { IssueReport } from '../domain/entities/issue-report.entity';

/** Shape trả về cho client — giữ nguyên hợp đồng cũ (camelCase). */
export function toResponse(doc: IssueReport): Record<string, unknown> {
  return {
    id: doc.id,
    userId: doc.userId,
    workspaceId: doc.workspaceId,
    issueType: doc.issueType,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    attachments: (doc.attachments ?? []).map((a) => ({
      id: a.id,
      filename: a.filename,
      sizeBytes: a.sizeBytes,
      contentType: a.contentType,
      downloadUrl: `/api/v1/issues/${doc.id}/attachments/${a.id}`,
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
