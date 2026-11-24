import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  DOMAIN_EVENT_HANDLER_REGISTRY,
  type DomainEventHandler,
  type DomainEventHandlerRegistry,
} from '../../../../shared/application/ports/domain-event-handler.port';
import { CascadeWorkspaceProjectsHandler } from './cascade-workspace-projects.handler';

/**
 * PROJECTS — Đăng ký handler cascade vào registry của `shared`.
 *
 * Module `projects` sở hữu collection `projects` nên nó tự xóa project khi
 * nhận event `WORKSPACE_DELETED`. Module `workspaces` không được import ngược
 * lại module này (CA9 — không chu trình phụ thuộc) → dùng event.
 *
 * Đăng ký trong `onModuleInit` để chắc chắn registry đã sẵn sàng nhận.
 */
@Injectable()
export class CascadeProjectEventSubscriber implements OnModuleInit {
  constructor(
    @Inject(DOMAIN_EVENT_HANDLER_REGISTRY)
    private readonly registry: DomainEventHandlerRegistry,
    private readonly cascade: CascadeWorkspaceProjectsHandler,
  ) {}

  onModuleInit(): void {
    const handler: DomainEventHandler = {
      consumerName: 'cascade-workspace-projects',
      eventTypes: ['WORKSPACE_DELETED'],
      handle: async (envelope) => {
        await this.cascade.handleEvent(envelope.eventType, envelope.payload ?? {});
      },
    };
    this.registry.register(handler);
  }
}
