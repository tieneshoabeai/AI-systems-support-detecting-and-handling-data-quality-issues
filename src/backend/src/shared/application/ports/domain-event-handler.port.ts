/**
 * SHARED — Registry cho **domain event handler** đăng ký từ module nghiệp vụ.
 *
 * Vì sao cần:
 * `EventDispatcherService` nằm ở tầng `shared` nên **không được** import từ
 * `modules/` (quy tắc CA5 — shared là lớp cross-cutting, không biết module
 * nghiệp vụ). Nhưng các module nghiệp vụ (projects, datasets) cần **tiêu thụ**
 * event để thực hiện cascade khi xóa.
 *
 * → Chiều phụ thuộc đảo ngược: module nghiệp vụ **đăng ký** handler vào registry
 * của shared (shared chỉ biết interface, không biết module nào đăng ký).
 *
 * Dùng cho: cascade xóa (workspace → project → dataset), và các tác vụ
 * hậu kiểm sau command khác.
 */
import type { DomainEventEnvelope } from './event-publisher.port';

export const DOMAIN_EVENT_HANDLER_REGISTRY = Symbol('DomainEventHandlerRegistry');

/**
 * Một handler xử lý các loại event cụ thể.
 *
 * Handler **phải idempotent**: event có thể được giao lại (retry, at-least-once
 * delivery) nên chạy lại phải cho kết quả đúng và không gây tác dụng phụ.
 */
export interface DomainEventHandler {
  /** Tên consumer — dùng cho idempotency key trong Inbox. */
  readonly consumerName: string;
  /** Danh sách `eventType` mà handler xử lý. */
  readonly eventTypes: readonly string[];
  /** Xử lý event. Ném lỗi → event bị đánh dấu failed để retry. */
  handle(envelope: DomainEventEnvelope): Promise<void>;
}

export interface DomainEventHandlerRegistry {
  /** Đăng ký handler (idempotent theo `consumerName` + `eventTypes`). */
  register(handler: DomainEventHandler): void;
  /** Các handler xử lý loại event này. */
  handlersFor(eventType: string): DomainEventHandler[];
}
