import { Injectable, Logger } from '@nestjs/common';
import type { DomainEventEnvelope, EventPublisherPort } from '../ports/event-publisher.port';

@Injectable()
export class InProcessEventPublisher implements EventPublisherPort {
  readonly mode = 'in-process' as const;
  private readonly logger = new Logger(InProcessEventPublisher.name);
  private handlers: Array<(e: DomainEventEnvelope) => Promise<void> | void> = [];

  onEvent(handler: (e: DomainEventEnvelope) => Promise<void> | void): void {
    this.handlers.push(handler);
  }

  async publish(envelope: DomainEventEnvelope): Promise<void> {
    for (const h of this.handlers) {
      try { await h(envelope); } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`In-process handler loi: ${msg}`);
      }
    }
  }
}
