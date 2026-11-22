import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  DOMAIN_EVENT_HANDLER_REGISTRY,
  type DomainEventHandler,
  type DomainEventHandlerRegistry,
} from '../../../shared/application/ports/domain-event-handler.port';
import {
  RealtimeRevocationEvents,
  type RealtimeRevocationStatus,
} from '../../../shared/domain/utils/realtime-events';
import { REALTIME_PORT, type RealtimePort } from '../../../shared/application/ports/realtime.port';

/**
 * REALTIME — Subscriber thu hồi socket (OPEN-08).
 *
 * Khi tài khoản bị **khoá** (`USER_BLOCKED`) hoặc bị **xoá mềm**
 * (`USER_REMOVED`) ⇒ mọi socket realtime đang mở của user đó phải bị đóng
 * **tức thì**, không đợi access token hết hạn.
 *
 * Vì sao là **event-driven** (quyết định OPEN-08) chứ không polling:
 * - Đóng socket đúng lúc xảy ra sự kiện ⇒ không có độ trễ "chu kỳ quét".
 * - Không phụ thuộc vào việc module nào gọi realtime trực tiếp (giữ được
 *   ranh giới module: `users` chỉ phát event, không biết tới socket.io).
 *
 * **Lớp phòng thủ thứ hai** (giữ nguyên theo quyết định): `realtime-auth.service.ts`
 * vẫn kiểm tra trạng thái tài khoản **lúc kết nối** ⇒ socket mới của user đã bị
 * khoá vẫn bị từ chối handshake, kể cả khi event bị lỡ.
 *
 * Handler **idempotent**: đóng socket đã đóng là no-op.
 */
@Injectable()
export class RealtimeRevocationSubscriber implements OnModuleInit {
  private readonly logger = new Logger(RealtimeRevocationSubscriber.name);

  constructor(
    @Inject(DOMAIN_EVENT_HANDLER_REGISTRY)
    private readonly registry: DomainEventHandlerRegistry,
    @Inject(REALTIME_PORT)
    private readonly realtime: RealtimePort,
  ) {}

  onModuleInit(): void {
    const handler: DomainEventHandler = {
      consumerName: 'realtime-revocation',
      eventTypes: [
        RealtimeRevocationEvents.USER_BLOCKED,
        RealtimeRevocationEvents.USER_REMOVED,
      ],
      handle: async (envelope) => {
        const userId = this.extractUserId(envelope.payload ?? {});
        if (!userId) {
          this.logger.warn(
            `Event ${envelope.eventType} không có user id — bỏ qua thu hồi socket`,
          );
          return;
        }
        const status: RealtimeRevocationStatus =
          envelope.eventType === RealtimeRevocationEvents.USER_BLOCKED
            ? 'blocked'
            : 'removed';
        this.realtime.disconnectUser(userId, status);
      },
    };
    this.registry.register(handler);
  }

  /**
   * Lấy id user từ payload event.
   *
   * Chấp nhận cả `user_id` (kiểu snake_case của outbox hiện tại) và `userId`
   * (kiểu camelCase) để tương thích với cả hai cách phát event.
   */
  private extractUserId(payload: Record<string, unknown>): string | null {
    const raw = payload.user_id ?? payload.userId;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
