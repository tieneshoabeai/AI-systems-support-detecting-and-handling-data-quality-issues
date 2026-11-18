import { Injectable, Logger } from '@nestjs/common';
import {
  DOMAIN_EVENT_HANDLER_REGISTRY,
  type DomainEventHandler,
  type DomainEventHandlerRegistry,
} from '../../application/ports/domain-event-handler.port';

/**
 * SHARED — Bản hiện thực của `DOMAIN_EVENT_HANDLER_REGISTRY`.
 *
 * Module nghiệp vụ gọi `register()` lúc khởi động (`onModuleInit`); dispatcher
 * gọi `handlersFor()` khi có event tới.
 *
 * Nếu không có handler nào đăng ký → event bị bỏ qua (inbox vẫn đánh dấu
 * completed) — để một event lạ không làm hỏng luồng.
 */
@Injectable()
export class InMemoryDomainEventHandlerRegistry implements DomainEventHandlerRegistry {
  private readonly logger = new Logger(InMemoryDomainEventHandlerRegistry.name);
  private readonly handlers = new Map<string, DomainEventHandler>();

  register(handler: DomainEventHandler): void {
    for (const eventType of handler.eventTypes) {
      const key = `${handler.consumerName}:${eventType}`;
      if (this.handlers.has(key)) {
        this.logger.warn(`Handler ${key} đã đăng ký — bỏ qua bản đăng ký trùng`);
        continue;
      }
      this.handlers.set(key, handler);
    }
  }

  handlersFor(eventType: string): DomainEventHandler[] {
    const out: DomainEventHandler[] = [];
    for (const [key, handler] of this.handlers) {
      if (key.endsWith(`:${eventType}`)) out.push(handler);
    }
    return out;
  }
}

/** Token để bind adapter vào `DOMAIN_EVENT_HANDLER_REGISTRY`. */
export const DOMAIN_EVENT_HANDLER_REGISTRY_ADAPTER = DOMAIN_EVENT_HANDLER_REGISTRY;
