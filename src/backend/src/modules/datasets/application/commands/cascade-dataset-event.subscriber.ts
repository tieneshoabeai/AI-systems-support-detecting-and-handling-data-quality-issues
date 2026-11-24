import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  DOMAIN_EVENT_HANDLER_REGISTRY,
  type DomainEventHandler,
  type DomainEventHandlerRegistry,
} from '../../../../shared/application/ports/domain-event-handler.port';
import { CascadeProjectDatasetsHandler } from './cascade-project-datasets.handler';

/**
 * DATASETS — Đăng ký handler cascade vào registry của `shared`.
 *
 * Module `datasets` sở hữu collection `datasets` + `dataset_records` nên nó tự
 * xóa dữ liệu của mình (kèm file R2) khi nhận event `PROJECT_DELETED`.
 *
 * Đăng ký trong `onModuleInit` để chắc chắn registry đã sẵn sàng nhận.
 */
@Injectable()
export class CascadeDatasetEventSubscriber implements OnModuleInit {
  constructor(
    @Inject(DOMAIN_EVENT_HANDLER_REGISTRY)
    private readonly registry: DomainEventHandlerRegistry,
    private readonly cascade: CascadeProjectDatasetsHandler,
  ) {}

  onModuleInit(): void {
    const handler: DomainEventHandler = {
      consumerName: 'cascade-project-datasets',
      eventTypes: ['PROJECT_DELETED'],
      handle: async (envelope) => {
        await this.cascade.handleEvent(envelope.eventType, envelope.payload ?? {});
      },
    };
    this.registry.register(handler);
  }
}
