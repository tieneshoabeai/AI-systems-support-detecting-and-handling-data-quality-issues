/**
 * UserAccessRevocationService — OPEN-08: **thu hồi realtime tức thì**.
 *
 * Khi tài khoản bị **khoá** hoặc bị **xoá mềm**, mọi socket realtime đang mở
 * của user đó phải bị đóng ngay lập tức — không đợi access token hết hạn.
 *
 * Vì sao cần **hai** đường phát event:
 *
 * 1. **Phát tức thì** (`EVENT_PUBLISHER_PORT`) — đi qua in-process publisher →
 *    `EventDispatcherService` → handler của module `realtime` → đóng socket.
 *    Đường này cho độ trễ ~0, đúng nghĩa "tức thì" của quyết định.
 * 2. **Ghi outbox** (`OUTBOX_PORT`) — đảm bảo event **không mất** nếu process
 *    chết giữa chừng, và cho đường Kafka/event-driven ở chế độ phân tán.
 *    Đường này có độ trễ theo chu kỳ relay (mặc định 30s) nên không thay thế
 *    được đường (1).
 *
 * Vì `disconnect` là thao tác **idempotent**, việc event tới hai lần (tức thì +
 * outbox relay) là vô hại.
 *
 * ── OPEN-09 (Conflict #4): phân biệt *best-effort* và *nghiêm* ─────────────
 * - `revoke()` — **best-effort**: nuốt lỗi. Dùng cho thao tác không nằm trong
 *   transaction (ví dụ chặn tài khoản: đã chặn thì không được "rollback" việc
 *   chặn chỉ vì event lỗi).
 * - `revokeStrict()` — **nghiêm**: lỗi ghi outbox được **ném ra** ⇒ caller
 *   rollback được thao tác chính. Dùng khi thao tác chính nằm trong
 *   transaction (xoá tài khoản) — để không rơi vào trạng thái "đã xoá tài
 *   khoản nhưng event thu hồi mất".
 */
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  EVENT_PUBLISHER_PORT,
  type EventPublisherPort,
} from '../../../../shared/application/ports/event-publisher.port';
import { OUTBOX_PORT, type OutboxPort } from '../../../../shared/application/ports/outbox.port';
import { USER_OUTBOX_EVENTS } from '../../domain/events/user-events';

export type UserRevocationStatus = 'blocked' | 'removed';

@Injectable()
export class UserAccessRevocationService {
  private readonly logger = new Logger(UserAccessRevocationService.name);

  constructor(
    @Optional()
    @Inject(EVENT_PUBLISHER_PORT)
    private readonly publisher?: EventPublisherPort,
    @Optional()
    @Inject(OUTBOX_PORT)
    private readonly outbox?: OutboxPort,
  ) {}

  /**
   * Phát sự kiện thu hồi realtime cho một user — **best-effort**.
   *
   * Không ném lỗi ra ngoài: đây là tác vụ phụ trợ, không được làm hỏng luồng
   * nghiệp vụ chính (đã ghi DB xong rồi). Lỗi được log lại để tra cứu.
   *
   * @param userId Id của tài khoản bị khoá / bị xoá.
   * @param status Lý do thu hồi (`blocked` | `removed`).
   */
  async revoke(userId: string, status: UserRevocationStatus): Promise<void> {
    // (1) Phát tức thì — đóng socket ngay trong lần chạy hiện tại.
    await this.publishImmediate(userId, status);

    // (2) Ghi outbox — không mất event, có đường phân tán.
    if (this.outbox) {
      try {
        await this.outbox.recordEvent(this.buildOutboxEvent(userId, status));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Ghi outbox ${this.eventType(status)} thất bại (user=${userId}): ${message}`);
      }
    }
  }

  /**
   * Phát sự kiện thu hồi realtime — **nghiêm (strict)**.
   *
   * Dùng bên trong transaction: nếu ghi outbox thất bại ⇒ lỗi được ném ra ⇒
   * transaction rollback ⇒ thao tác chính (xoá tài khoản) **không** xảy ra.
   * Nhờ vậy không bao giờ có trạng thái "tài khoản đã xoá nhưng sự kiện thu hồi
   * realtime bị mất" (⇒ socket cũ vẫn sống tới hết hạn token).
   *
   * LƯU Ý: hàm này **chỉ ghi outbox**, cố ý **không** đóng socket ngay — vì nó
   * được gọi *bên trong* transaction. Nếu transaction rollback, tài khoản vẫn
   * còn sống ⇒ không được đóng socket của nó. Việc đóng socket được caller thực
   * hiện **sau khi transaction commit** qua {@link publishImmediateNow}.
   *
   * @param userId Id của tài khoản bị khoá / bị xoá.
   * @param status Lý do thu hồi (`blocked` | `removed`).
   */
  async revokeStrict(userId: string, status: UserRevocationStatus): Promise<void> {
    if (this.outbox) {
      // Nghiêm — lỗi ném ra để transaction rollback.
      await this.outbox.recordEvent(this.buildOutboxEvent(userId, status));
    }
  }

  /**
   * Đóng socket realtime ngay lập tức (best-effort).
   *
   * Gọi **sau khi** transaction đã commit — chỉ khi đó việc đóng socket mới
   * đúng ngữ nghĩa ("tài khoản đã bị thu hồi quyền truy cập").
   */
  async publishImmediateNow(userId: string, status: UserRevocationStatus): Promise<void> {
    await this.publishImmediate(userId, status);
  }

  // ── Nội bộ ───────────────────────────────────────────────────────────────

  private eventType(status: UserRevocationStatus): string {
    return status === 'blocked' ? USER_OUTBOX_EVENTS.BLOCKED : USER_OUTBOX_EVENTS.REMOVED;
  }

  private buildOutboxEvent(
    userId: string,
    status: UserRevocationStatus
  ): Parameters<OutboxPort['recordEvent']>[0] {
    return {
      aggregate_type: 'USER',
      aggregate_id: userId,
      event_type: this.eventType(status),
      payload: { user_id: userId, userId, status },
      actor_id: null,
      workspace_id: null,
      project_id: null,
    };
  }

  /** Phát event tức thì qua in-process event bus (đóng socket ngay). */
  private async publishImmediate(userId: string, status: UserRevocationStatus): Promise<void> {
    if (!this.publisher) return;
    try {
      await this.publisher.publish({
        eventId: randomUUID(),
        eventType: this.eventType(status),
        aggregateType: 'USER',
        aggregateId: userId,
        payload: { user_id: userId, userId, status },
        actorId: null,
        workspaceId: null,
        projectId: null,
        occurredAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Phát event ${this.eventType(status)} tức thì thất bại (user=${userId}): ${message}`,
      );
    }
  }
}
