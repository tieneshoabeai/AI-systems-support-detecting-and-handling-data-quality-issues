/**
 * NOTIFICATIONS — Tạo thông báo qua port (dùng chung cho module khác).
 *
 * Cùng cách module `issues` đang làm (`issues.utils.ts#dispatchViaPorts`), mở
 * rộng cho mọi loại thông báo + `payload` + `sourceEventId`: kiểm công tắc của
 * người nhận → `createIfEventNotExists` (unique `(user_id, source_event_id)`
 * chống trùng) → realtime `notification.created`. Không gửi email.
 *
 * Dùng bởi `analysis` cho `analysis_completed` / `analysis_failed` /
 * `ai_analysis_ready` (Phần 9 v7 mục 3.14, Phần 7 v16 mục 3.26 NT-*).
 */
import type { RealtimePort } from '../realtime';
import type { UserRepositoryPort } from '../users';
import {
  MAX_SUMMARY_LENGTH,
  MAX_TITLE_LENGTH,
  isMandatoryNotification,
  shouldDispatch,
  type Notification,
  type NotificationPayload,
  type NotificationRepositoryPort,
  type NotificationType,
} from './notifications.types';

export interface DispatchViaPortsInput {
  userId: string;
  type: NotificationType;
  title: string;
  summary?: string | null;
  payload?: NotificationPayload | null;
  /** Khoá chống trùng theo người nhận (vd `analysis_completed:<runId>`). */
  sourceEventId?: string | null;
  isMandatory?: boolean;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @returns thông báo vừa tạo; `null` khi người nhận tắt thông báo (và loại không
 *   bắt buộc) hoặc `sourceEventId` đã có. Lỗi repository được ném lại — bên gọi
 *   tự quyết định nuốt lỗi để không làm hỏng luồng nghiệp vụ.
 */
export async function dispatchNotificationViaPorts(
  repo: NotificationRepositoryPort,
  users: Pick<UserRepositoryPort, 'findById'>,
  realtime: RealtimePort | undefined,
  input: DispatchViaPortsInput,
): Promise<Notification | null> {
  const user = await users.findById(input.userId).catch(() => null);
  const enabled = user ? user.notificationsEnabled : undefined;
  const mandatory = isMandatoryNotification(input.type, input.isMandatory ?? false);
  if (!shouldDispatch(enabled, mandatory)) return null;
  const created = await repo.createIfEventNotExists({
    userId: input.userId,
    type: input.type,
    title: clip(input.title, MAX_TITLE_LENGTH),
    summary: input.summary ? clip(input.summary, MAX_SUMMARY_LENGTH) : null,
    payload: input.payload ?? null,
    sourceEventId: input.sourceEventId ?? null,
    isMandatory: mandatory,
  });
  if (created) {
    try {
      realtime?.emitToUser(input.userId, 'notification.created', {
        notificationId: created.id,
        notificationType: created.type,
      });
    } catch {
      // realtime không bao giờ làm hỏng luồng nghiệp vụ chính
    }
  }
  return created;
}
