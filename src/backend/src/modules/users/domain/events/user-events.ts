import { RealtimeRevocationEvents } from '../../../../shared/domain/utils/realtime-events';

/**
 * USER — Danh mục domain event của module `users`.
 *
 * Hai nhóm tên sự kiện:
 *
 * 1. **Domain event của entity** (`user.created`, `user.blocked`, …) — dùng
 *    ký hiệu `dot.case` vì chúng gắn với hành vi của aggregate `User`.
 * 2. **Event outbox** (`USER_BLOCKED`, `USER_REMOVED`, …) — dùng `UPPER_SNAKE`
 *    như các event outbox khác của hệ thống (`WORKSPACE_DELETED`,
 *    `PROJECT_DELETED`, `DATASET_INGESTED`). Đây là tên mà
 *    `EventDispatcherService` và `DomainEventHandlerRegistry` khớp theo.
 *
 * OPEN-08 — `USER_BLOCKED` / `USER_REMOVED` là hai sự kiện **thu hồi
 * realtime**: tài khoản bị khoá hoặc bị xoá ⇒ mọi socket đang mở của user đó
 * phải bị đóng **tức thì**, không đợi access token hết hạn.
 *
 * Hằng tên được re-export từ `shared/domain/utils/realtime-events.ts` để
 * `shared/infrastructure/events` khớp tên mà không import ngược vào
 * `modules/` (quy tắc CA5).
 */
export const USER_EVENTS = {
  CREATED: 'user.created',
  BLOCKED: 'user.blocked',
  UNBLOCKED: 'user.unblocked',
  /** Tài khoản bị xoá mềm — thu hồi realtime (OPEN-08). */
  REMOVED: 'user.removed',
} as const;

export type UserEventName = (typeof USER_EVENTS)[keyof typeof USER_EVENTS];

/**
 * Tên event **outbox** (ghi vào collection `outbox_event`).
 *
 * Dùng để module khác (realtime) đăng ký handler theo tên mà không phải
 * import sâu vào module `users` (quy tắc CA8 — cross-module import qua
 * public contract).
 */
export const USER_OUTBOX_EVENTS = {
  /** Tài khoản bị khoá → đóng socket ngay. */
  BLOCKED: RealtimeRevocationEvents.USER_BLOCKED,
  /** Tài khoản bị xoá mềm → đóng socket ngay. */
  REMOVED: RealtimeRevocationEvents.USER_REMOVED,
} as const;

export type UserOutboxEventName = (typeof USER_OUTBOX_EVENTS)[keyof typeof USER_OUTBOX_EVENTS];
