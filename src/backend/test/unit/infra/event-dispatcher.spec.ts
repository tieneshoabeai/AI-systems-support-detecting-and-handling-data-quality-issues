/**
 * B2.8 — Test unit cho `EventDispatcherService`.
 *
 * Đây là **đầu mối tiêu thụ event duy nhất** của hệ thống. Trước đây file này
 * 0% coverage ⇒ mọi quyết định "event này đẩy realtime sang room nào" và mọi
 * quy tắc idempotency (Inbox) đều không được kiểm chứng.
 *
 * Bộ test chứng minh:
 *   1. Idempotency qua Inbox: event đã `completed` ⇒ không xử lý lại.
 *   2. Định tuyến realtime đúng theo `eventType` (DATASET_INGESTED,
 *      ANALYSIS_*, NOTIFICATION_CREATED, FEEDBACK_CREATED, ISSUE_*).
 *   3. Domain handler registry: mỗi handler có consumer name riêng ⇒
 *      idempotency tách riêng; handler lỗi không chặn handler khác.
 *   4. Realtime lỗi KHÔNG được làm hỏng luồng nghiệp vụ chính.
 */
import { Test } from '@nestjs/testing';
import { EventDispatcherService } from '../../../src/shared/infrastructure/events/event-dispatcher.service';
import { InboxService as InboxServiceToken } from '../../../src/shared/infrastructure/outbox/inbox.service';
import { InProcessEventPublisher } from '../../../src/shared/infrastructure/events/in-process-event.publisher';
import type { DomainEventEnvelope } from '../../../src/shared/application/ports/event-publisher.port';
import { REALTIME_PORT, type RealtimePort } from '../../../src/shared/application/ports/realtime.port';
import {
  DOMAIN_EVENT_HANDLER_REGISTRY,
  type DomainEventHandler,
} from '../../../src/shared/application/ports/domain-event-handler.port';

describe('B2.8 — EventDispatcherService', () => {
  let dispatcher: EventDispatcherService;
  let realtime: jest.Mocked<RealtimePort>;
  let inbox: {
    claim: jest.Mock;
    complete: jest.Mock;
    fail: jest.Mock;
  };
  let registry: { register: jest.Mock; handlersFor: jest.Mock };
  let onEventCallback: ((e: DomainEventEnvelope) => void) | undefined;

  const envelope = (over: Partial<DomainEventEnvelope> = {}): DomainEventEnvelope => ({
    eventId: 'evt-1',
    eventType: 'DATASET_INGESTED',
    aggregateType: 'Dataset',
    aggregateId: 'ds-1',
    payload: {},
    projectId: 'p1',
    occurredAt: new Date().toISOString(),
    ...over,
  });

  beforeEach(async () => {
    realtime = {
      emitToUser: jest.fn(),
      emitToProject: jest.fn(),
      emitToAnalysis: jest.fn(),
      emitAnalysisLifecycle: jest.fn(),
      disconnectUser: jest.fn(),
    };
    inbox = {
      claim: jest.fn(async () => 'claimed' as const),
      complete: jest.fn(async () => undefined),
      fail: jest.fn(async () => undefined),
    };
    registry = { register: jest.fn(), handlersFor: jest.fn(() => [] as DomainEventHandler[]) };

    const module = await Test.createTestingModule({
      providers: [
        EventDispatcherService,
        {
          provide: InProcessEventPublisher,
          useValue: {
            onEvent: jest.fn((cb: (e: DomainEventEnvelope) => void) => {
              onEventCallback = cb;
            }),
          },
        },
        { provide: REALTIME_PORT, useValue: realtime },
        { provide: InboxServiceToken, useValue: inbox },
        { provide: DOMAIN_EVENT_HANDLER_REGISTRY, useValue: registry },
      ],
    }).compile();

    dispatcher = module.get(EventDispatcherService);
    dispatcher.onModuleInit();
  });

  // ─── Đăng ký listener ────────────────────────────────────────────────────

  it('onModuleInit đăng ký listener vào InProcessEventPublisher', () => {
    expect(onEventCallback).toBeDefined();
  });

  // ─── Idempotency qua Inbox ───────────────────────────────────────────────

  describe('idempotency (Inbox)', () => {
    it('event đã xử lý (claim = already) ⇒ bỏ qua, không route', async () => {
      inbox.claim.mockResolvedValue('already' as never);

      await dispatcher.handle(envelope());

      expect(inbox.claim).toHaveBeenCalledWith('event-dispatcher', 'evt-1');
      expect(realtime.emitToProject).not.toHaveBeenCalled();
      expect(inbox.complete).not.toHaveBeenCalled();
    });

    it('claim lỗi (DB hạ tầng) ⇒ vẫn xử lý best-effort', async () => {
      inbox.claim.mockRejectedValue(new Error('db down'));

      await dispatcher.handle(envelope());

      expect(realtime.emitToProject).toHaveBeenCalled();
    });

    it('xử lý thành công ⇒ complete được gọi', async () => {
      await dispatcher.handle(envelope());

      expect(inbox.complete).toHaveBeenCalledWith('event-dispatcher', 'evt-1');
      expect(inbox.fail).not.toHaveBeenCalled();
    });

    it('route ném lỗi realtime ⇒ KHÔNG fail, vẫn complete (realtime không phá nghiệp vụ)', async () => {
      realtime.emitToProject.mockImplementation(() => {
        throw new Error('socket down');
      });

      await expect(dispatcher.handle(envelope())).resolves.toBeUndefined();
      // `route()` tự bắt lỗi realtime ⇒ nghiệp vụ chính vẫn coi là thành công.
      expect(inbox.fail).not.toHaveBeenCalled();
      expect(inbox.complete).toHaveBeenCalledWith('event-dispatcher', 'evt-1');
    });
  });

  // ─── Định tuyến realtime ─────────────────────────────────────────────────

  describe('định tuyến realtime', () => {
    it('DATASET_INGESTED ⇒ ai.quality.updated vào project', async () => {
      await dispatcher.handle(envelope({ eventType: 'DATASET_INGESTED' }));
      expect(realtime.emitToProject).toHaveBeenCalledWith(
        'p1',
        'ai.quality.updated',
        { projectId: 'p1', status: 'dataset_ready' },
      );
    });

    it('projectId lấy từ payload khi envelope không có', async () => {
      await dispatcher.handle(
        envelope({ projectId: undefined, payload: { project_id: 'p-from-payload' } }),
      );
      expect(realtime.emitToProject).toHaveBeenCalledWith(
        'p-from-payload',
        'ai.quality.updated',
        expect.anything(),
      );
    });

    it('ANALYSIS_STARTED có analysisId ⇒ emitAnalysisLifecycle', async () => {
      await dispatcher.handle(
        envelope({ eventType: 'ANALYSIS_STARTED', payload: { analysis_id: 'a1' } }),
      );
      expect(realtime.emitAnalysisLifecycle).toHaveBeenCalledWith(
        'p1',
        'a1',
        'analysis.progress',
        { status: 'running' },
      );
    });

    it('ANALYSIS_STARTED không có analysisId ⇒ emitToProject', async () => {
      await dispatcher.handle(envelope({ eventType: 'ANALYSIS_STARTED' }));
      expect(realtime.emitToProject).toHaveBeenCalledWith('p1', 'analysis.progress', {
        status: 'running',
      });
    });

    it('ANALYSIS_PROGRESS dùng analysisId camelCase', async () => {
      await dispatcher.handle(
        envelope({ eventType: 'ANALYSIS_PROGRESS', payload: { analysisId: 'a2' } }),
      );
      expect(realtime.emitAnalysisLifecycle).toHaveBeenCalledWith(
        'p1',
        'a2',
        'analysis.progress',
        { status: 'running' },
      );
    });

    it('ANALYSIS_COMPLETED ⇒ analysis.completed', async () => {
      await dispatcher.handle(
        envelope({ eventType: 'ANALYSIS_COMPLETED', payload: { analysis_id: 'a1' } }),
      );
      expect(realtime.emitAnalysisLifecycle).toHaveBeenCalledWith(
        'p1',
        'a1',
        'analysis.completed',
        { status: 'completed' },
      );
    });

    it('ANALYSIS_FAILED ⇒ analysis.failed', async () => {
      await dispatcher.handle(
        envelope({ eventType: 'ANALYSIS_FAILED', payload: { analysis_id: 'a1' } }),
      );
      expect(realtime.emitAnalysisLifecycle).toHaveBeenCalledWith(
        'p1',
        'a1',
        'analysis.failed',
        { status: 'failed' },
      );
    });

    it('NOTIFICATION_CREATED ⇒ emitToUser với user_id', async () => {
      await dispatcher.handle(
        envelope({
          eventType: 'NOTIFICATION_CREATED',
          payload: { user_id: 'u9' },
          projectId: undefined,
        }),
      );
      expect(realtime.emitToUser).toHaveBeenCalledWith('u9', 'notification.created', {
        status: 'created',
      });
    });

    it('NOTIFICATION_CREATED với userId camelCase', async () => {
      await dispatcher.handle(
        envelope({
          eventType: 'NOTIFICATION_CREATED',
          payload: { userId: 'u10' },
          projectId: undefined,
        }),
      );
      expect(realtime.emitToUser).toHaveBeenCalledWith('u10', 'notification.created', {
        status: 'created',
      });
    });

    it('FEEDBACK_CREATED ⇒ feedback.created', async () => {
      await dispatcher.handle(envelope({ eventType: 'FEEDBACK_CREATED' }));
      expect(realtime.emitToProject).toHaveBeenCalledWith('p1', 'feedback.created', {
        projectId: 'p1',
        status: 'created',
      });
    });

    it('ISSUE_CREATED ⇒ ai.quality.updated (issue_changed)', async () => {
      await dispatcher.handle(envelope({ eventType: 'ISSUE_CREATED' }));
      expect(realtime.emitToProject).toHaveBeenCalledWith('p1', 'ai.quality.updated', {
        projectId: 'p1',
        status: 'issue_changed',
      });
    });

    it('ISSUE_UPDATED ⇒ ai.quality.updated (issue_changed)', async () => {
      await dispatcher.handle(envelope({ eventType: 'ISSUE_UPDATED' }));
      expect(realtime.emitToProject).toHaveBeenCalledWith('p1', 'ai.quality.updated', {
        projectId: 'p1',
        status: 'issue_changed',
      });
    });

    it('event không lệnh ⇒ ai.quality.updated (updated)', async () => {
      await dispatcher.handle(envelope({ eventType: 'SOMETHING_ELSE' }));
      expect(realtime.emitToProject).toHaveBeenCalledWith('p1', 'ai.quality.updated', {
        projectId: 'p1',
        status: 'updated',
      });
    });

    it('event thu hồi realtime (USER_BLOCKED) ⇒ KHÔNG emit', async () => {
      await dispatcher.handle(envelope({ eventType: 'USER_BLOCKED' }));
      expect(realtime.emitToProject).not.toHaveBeenCalled();
      expect(realtime.emitToUser).not.toHaveBeenCalled();
    });

    it('event thu hồi realtime (USER_REMOVED) ⇒ KHÔNG emit', async () => {
      await dispatcher.handle(envelope({ eventType: 'USER_REMOVED' }));
      expect(realtime.emitToProject).not.toHaveBeenCalled();
    });

    it('PROJECT_DELETED ⇒ KHÔNG emit ai.quality.updated vào project đã xóa', async () => {
      // Rơi xuống `default` sẽ đẩy `ai.quality.updated` vào room của project
      // **đã bị xóa** ⇒ client nhận thông báo về tài nguyên không còn tồn tại.
      await dispatcher.handle(envelope({ eventType: 'PROJECT_DELETED' }));
      expect(realtime.emitToProject).not.toHaveBeenCalled();
    });

    it('WORKSPACE_DELETED ⇒ KHÔNG emit ai.quality.updated', async () => {
      await dispatcher.handle(envelope({ eventType: 'WORKSPACE_DELETED' }));
      expect(realtime.emitToProject).not.toHaveBeenCalled();
    });

    it('không có projectId ⇒ không emit gì cả', async () => {
      await dispatcher.handle(envelope({ projectId: undefined, payload: {} }));
      expect(realtime.emitToProject).not.toHaveBeenCalled();
    });

    it('realtime ném lỗi ⇒ không làm hỏng luồng chính', async () => {
      realtime.emitToProject.mockImplementation(() => {
        throw new Error('socket.io down');
      });
      await expect(dispatcher.handle(envelope())).resolves.toBeUndefined();
    });
  });

  // ─── Domain handler registry ─────────────────────────────────────────────

  describe('domain event handler registry', () => {
    const makeHandler = (
      consumerName: string,
      handle: () => Promise<void> = async () => undefined,
    ): DomainEventHandler => ({
      consumerName,
      eventTypes: ['DATASET_INGESTED'],
      handle,
    });

    it('handler được gọi khi eventType khớp', async () => {
      const handle = jest.fn(async () => undefined);
      registry.handlersFor.mockReturnValue([makeHandler('cascade', handle)]);

      await dispatcher.handle(envelope());

      expect(handle).toHaveBeenCalledTimes(1);
      expect(registry.handlersFor).toHaveBeenCalledWith('DATASET_INGESTED');
    });

    it('handler có consumer name riêng ⇒ claim tách riêng', async () => {
      registry.handlersFor.mockReturnValue([makeHandler('cascade')]);

      await dispatcher.handle(envelope());

      expect(inbox.claim).toHaveBeenCalledWith('cascade', 'evt-1');
      expect(inbox.complete).toHaveBeenCalledWith('cascade', 'evt-1');
    });

    it('handler đã xử lý (already) ⇒ bỏ qua handler đó', async () => {
      const handle = jest.fn(async () => undefined);
      registry.handlersFor.mockReturnValue([makeHandler('cascade', handle)]);
      inbox.claim.mockImplementation(async (consumer: string) =>
        consumer === 'cascade' ? ('already' as never) : ('claimed' as never),
      );

      await dispatcher.handle(envelope());

      expect(handle).not.toHaveBeenCalled();
    });

    it('handler lỗi ⇒ fail(consumer) được gọi, handler khác vẫn chạy', async () => {
      const second = jest.fn(async () => undefined);
      registry.handlersFor.mockReturnValue([
        makeHandler('bad', async () => {
          throw new Error('handler boom');
        }),
        makeHandler('good', second),
      ]);

      await expect(dispatcher.handle(envelope())).resolves.toBeUndefined();

      expect(inbox.fail).toHaveBeenCalledWith('bad', 'evt-1');
      expect(second).toHaveBeenCalled();
    });

    it('không có registry ⇒ bỏ qua, không lỗi', async () => {
      const module = await Test.createTestingModule({
        providers: [
          EventDispatcherService,
          { provide: InProcessEventPublisher, useValue: { onEvent: jest.fn() } },
          { provide: REALTIME_PORT, useValue: realtime },
          { provide: InboxServiceToken, useValue: inbox },
        ],
      }).compile();

      const bare = module.get(EventDispatcherService);
      await expect(bare.handle(envelope())).resolves.toBeUndefined();
      expect(realtime.emitToProject).toHaveBeenCalled();
    });

    it('không có handler nào cho eventType ⇒ bỏ qua', async () => {
      registry.handlersFor.mockReturnValue([]);
      await dispatcher.handle(envelope());
      expect(inbox.complete).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Listener của InProcessEventPublisher ───────────────────────────────

  describe('listener in-process', () => {
    it('event phát qua in-process ⇒ được handle (fire-and-forget)', async () => {
      onEventCallback?.(envelope({ eventType: 'FEEDBACK_CREATED' }));
      await new Promise((r) => setTimeout(r, 10));
      expect(realtime.emitToProject).toHaveBeenCalledWith('p1', 'feedback.created', {
        projectId: 'p1',
        status: 'created',
      });
    });

    it('event phát qua in-process gây lỗi ⇒ không unhandled rejection', async () => {
      realtime.emitToProject.mockImplementation(() => {
        throw new Error('boom');
      });
      expect(() => onEventCallback?.(envelope())).not.toThrow();
      await new Promise((r) => setTimeout(r, 10));
    });
  });
});
