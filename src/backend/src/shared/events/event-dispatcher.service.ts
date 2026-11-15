import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { InProcessEventPublisher } from './in-process-event.publisher';
import type { DomainEventEnvelope } from '../ports/event-publisher.port';
import type { RealtimePort } from '../../modules/realtime/domain/ports/realtime.port';
import { REALTIME_PORT } from '../../modules/realtime/domain/ports/realtime.port';
import type { InboxService } from '../application/outbox/inbox.service';
import { InboxService as InboxServiceToken } from '../application/outbox/inbox.service';

/**
 * Nhom 4 - Event dispatcher (consumer in-process).
 * Moi event qua EventPublisherPort deu di qua day 1 lan duy nhat nho Inbox (processed_event).
 * Quy tac: chi push realtime (id + trang thai), khong bao gio lam hong luong nghiep vu chinh.
 */
@Injectable()
export class EventDispatcherService implements OnModuleInit {
  private readonly logger = new Logger(EventDispatcherService.name);
  constructor(
    private readonly inProcess: InProcessEventPublisher,
    @Optional() @Inject(REALTIME_PORT) private readonly realtime?: RealtimePort,
    @Optional() @Inject(InboxServiceToken) private readonly inbox?: InboxService,
  ) {}
  onModuleInit(): void {
    this.inProcess.onEvent((e) => { void this.handle(e).catch(() => undefined); });
  }
  async handle(envelope: DomainEventEnvelope): Promise<void> {
    // Idempotency: consumer 'event-dispatcher' + eventId
    try {
      if (this.inbox) {
        const claim = await this.inbox.claim('event-dispatcher', envelope.eventId);
        if (claim !== 'claimed') return;
      }
    } catch { /* inbox loi -> van xu ly best-effort, khong chan */ }
    try {
      this.route(envelope);
      if (this.inbox) await this.inbox.complete('event-dispatcher', envelope.eventId).catch(() => undefined);
    } catch (err: unknown) {
      if (this.inbox) await this.inbox.fail('event-dispatcher', envelope.eventId).catch(() => undefined);
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`dispatch loi event=${envelope.eventType}: ${msg}`);
    }
  }
  private route(e: DomainEventEnvelope): void {
    if (!this.realtime) return;
    try {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      const projectId = e.projectId ?? (typeof p.project_id === 'string' ? p.project_id : undefined);
      const analysisId = typeof p.analysis_id === 'string' ? p.analysis_id : (typeof p.analysisId === 'string' ? p.analysisId : undefined);
      switch (e.eventType) {
        case 'DATASET_INGESTED':
          if (projectId) this.realtime.emitToProject(projectId, 'ai.quality.updated', { projectId, status: 'dataset_ready' });
          break;
        case 'ANALYSIS_STARTED':
        case 'ANALYSIS_PROGRESS':
          if (projectId && analysisId) this.realtime.emitAnalysisLifecycle(projectId, analysisId, 'analysis.progress', { status: 'running' });
          else if (projectId) this.realtime.emitToProject(projectId, 'analysis.progress', { status: 'running' });
          break;
        case 'ANALYSIS_COMPLETED':
          if (projectId && analysisId) this.realtime.emitAnalysisLifecycle(projectId, analysisId, 'analysis.completed', { status: 'completed' });
          else if (projectId) this.realtime.emitToProject(projectId, 'analysis.completed', { status: 'completed' });
          break;
        case 'ANALYSIS_FAILED':
          if (projectId && analysisId) this.realtime.emitAnalysisLifecycle(projectId, analysisId, 'analysis.failed', { status: 'failed' });
          else if (projectId) this.realtime.emitToProject(projectId, 'analysis.failed', { status: 'failed' });
          break;
        case 'NOTIFICATION_CREATED': {
          const uid = typeof p.user_id === 'string' ? p.user_id : (typeof p.userId === 'string' ? p.userId : undefined);
          if (uid) this.realtime.emitToUser(uid, 'notification.created', { status: 'created' });
          break;
        }
        case 'FEEDBACK_CREATED':
          if (projectId) this.realtime.emitToProject(projectId, 'feedback.created', { projectId, status: 'created' });
          break;
        case 'ISSUE_CREATED':
        case 'ISSUE_UPDATED':
          if (projectId) this.realtime.emitToProject(projectId, 'ai.quality.updated', { projectId, status: 'issue_changed' });
          break;
        default:
          if (projectId) this.realtime.emitToProject(projectId, 'ai.quality.updated', { projectId, status: 'updated' });
          break;
      }
    } catch { /* realtime khong bao gio lam hong nghiep vu */ }
  }
}
