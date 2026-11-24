/**
 * REALTIME — Hợp đồng push (cross-cutting infrastructure).
 *
 * Vì sao nằm ở `shared/ports/` mà không phải `modules/realtime/`?
 * --------------------------------------------------------------
 * `shared/events/event-dispatcher.service.ts` là lớp cross-cutting: nó nhận
 * domain event từ outbox và đẩy sang realtime. Nếu hợp đồng realtime nằm trong
 * module nghiệp vụ `realtime`, thì `shared/` sẽ phải import từ `modules/` —
 * vi phạm quy tắc CA5 ("shared là lớp cross-cutting, không biết module nghiệp vụ").
 *
 * Vì vậy hợp đồng được đặt cùng cấp với `storage.port.ts`, `outbox.port.ts`,
 * `event-publisher.port.ts` — những port hạ tầng dùng chung đã có sẵn.
 * Module `realtime` chỉ implement hợp đồng này và re-export lại qua
 * `modules/realtime/index.ts` để các module khác có một public contract ổn định.
 *
 * Phần khai báo sự kiện/envelope (thuần, không framework) nằm ở
 * `shared/utils/realtime-events.ts` — để tầng `domain/` của module khác
 * được phép dùng mà không vi phạm CA11.
 */

import type {
  RealtimeEventName,
  RealtimeFields,
} from '../../domain/utils/realtime-events';

export const REALTIME_PORT = Symbol('RealtimePort');

export interface RealtimePort {
  emitToUser(userId: string, event: RealtimeEventName, fields: RealtimeFields): void;
  emitToProject(projectId: string, event: RealtimeEventName, fields: RealtimeFields): void;
  emitToAnalysis(analysisId: string, event: RealtimeEventName, fields: RealtimeFields): void;
  emitAnalysisLifecycle(
    projectId: string,
    analysisId: string,
    event: Extract<RealtimeEventName, 'analysis.progress' | 'analysis.completed' | 'analysis.failed' | 'ai.job.status'>,
    fields: Omit<RealtimeFields, 'projectId' | 'analysisId'>,
  ): void;

  /**
   * OPEN-08 — **Đóng socket tức thì** của một user (tài khoản bị khoá / bị xoá).
   *
   * - Gửi `user.force_disconnect` cho client trước (để client biết nguyên nhân).
   * - Sau đó server đóng hẳn socket (`disconnectSockets(true)`) — không chỉ
   *   "emit rồi để client tự đóng", vì client có thể bỏ qua và tiếp tục giữ socket.
   *
   * Phải **không ném lỗi**: đây là tác vụ phụ trợ, không được làm hỏng luồng chính.
   */
  disconnectUser(userId: string, status: 'blocked' | 'removed'): void;
}

export type {
  RealtimeEnvelope,
  RealtimeEventName,
  RealtimeFields,
} from '../../domain/utils/realtime-events';
