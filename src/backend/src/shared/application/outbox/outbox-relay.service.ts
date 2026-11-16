import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxService } from './outbox.service';
import type { EventPublisherPort } from '../../ports/event-publisher.port';
import { EVENT_PUBLISHER_PORT } from '../../ports/event-publisher.port';

@Injectable()
export class OutboxRelayService implements OnModuleInit {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  constructor(
    private readonly outbox: OutboxService,
    private readonly config: ConfigService,
    @Optional() @Inject(EVENT_PUBLISHER_PORT) private readonly publisher?: EventPublisherPort,
  ) {}
  onModuleInit(): void {
    const mode = (this.config.get<string>('WORKER_MODE') ?? 'all').toLowerCase();
    if (mode === 'api') { this.logger.log('Outbox relay tat trong API process (WORKER_MODE=api) - worker rieng dam nhan'); return; }
    const enabled = (this.config.get<string>('OUTBOX_RELAY_ENABLED') ?? 'true') !== 'false';
    if (!enabled) { this.logger.log('Outbox relay tat (OUTBOX_RELAY_ENABLED=false)'); return; }
    this.timer = setInterval(() => { void this.tick().catch((e: unknown) => this.logger.error(`relay loi: ${e instanceof Error ? e.message : String(e)}`)); }, 30000);
    const t = this.timer as unknown as { unref?: () => void };
    if (typeof t.unref === 'function' && this.config.get<string>('NODE_ENV') === 'test') t.unref();
    // quet ngay khi khoi dong de chua lanh event mo coi
    void this.tick().catch(() => undefined);
  }
  async tick(): Promise<number> {
    if (this.busy) return 0;
    this.busy = true;
    try {
      await this.outbox.reclaimStuckPublishing().catch(() => 0);
      const claimed = await this.outbox.claimForPublish(50);
      let ok = 0;
      for (const doc of claimed) {
        const raw = doc as unknown as Record<string, unknown>;
        const id = String((raw._id as { toString(): string }).toString());
        try {
          if (this.publisher) {
            await this.publisher.publish({
              eventId: id,
              eventType: String(raw.event_type ?? ''),
              aggregateType: String(raw.aggregate_type ?? ''),
              aggregateId: String(raw.aggregate_id ?? ''),
              payload: (raw.payload as Record<string, unknown>) ?? {},
              workspaceId: (raw.workspace_id as string) ?? null,
              projectId: (raw.project_id as string) ?? null,
              actorId: (raw.actor_id as string) ?? null,
              occurredAt: new Date().toISOString(),
            });
          }
          await this.outbox.markAsPublished(id);
          ok++;
        } catch (err: unknown) {
          await this.outbox.markAsFailed(id, err instanceof Error ? err.message : String(err)).catch(() => undefined);
        }
      }
      if (ok > 0) this.logger.log(`Outbox relay publish ${ok} events`);
      return ok;
    } finally { this.busy = false; }
  }
}
