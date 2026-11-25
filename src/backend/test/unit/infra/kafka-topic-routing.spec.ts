/**
 * Test phân topic Kafka (`topicFor`).
 *
 * ── Vì sao cần test này? ─────────────────────────────────────────────────
 * `topicFor()` quyết định event đi vào topic Kafka nào. Hàm này trước đây là
 * `private` ⇒ **không test được** ⇒ quy tắc phân topic chỉ được kiểm chứng
 * bằng mắt.
 *
 * Rủi ro cụ thể: event thu hồi realtime (`USER_BLOCKED`, `USER_REMOVED`) không
 * có prefix `realtime.` ⇒ trước đây rơi vào topic `domain.events` (phân loại
 * sai). Hiện chưa gây hỏng vì consumer subscribe **cả 4** topic rồi đưa tất cả
 * vào cùng một dispatcher — nhưng là tiền đề cho bug khi tách worker theo topic.
 */
import { topicFor } from '../../../src/shared/infrastructure/events/kafka-event.publisher';
import {
  DATASET_OUTBOX_EVENTS,
  PROJECT_OUTBOX_EVENTS,
  WORKSPACE_OUTBOX_EVENTS,
} from '../../../src/shared/domain/utils/outbox-events';
import { RealtimeRevocationEvents } from '../../../src/shared/domain/utils/realtime-events';

describe('Kafka — phân topic theo event type', () => {
  it('event AI (ai.*) ⇒ topic ai.jobs', () => {
    expect(topicFor('ai.job.status')).toBe('ai.jobs');
    expect(topicFor('ai.quality.updated')).toBe('ai.jobs');
  });

  it('event thông báo/email ⇒ topic notification.dispatch', () => {
    expect(topicFor('notification.created')).toBe('notification.dispatch');
    expect(topicFor('email.sent')).toBe('notification.dispatch');
  });

  it('event realtime (realtime.*) ⇒ topic realtime.push', () => {
    expect(topicFor('realtime.push')).toBe('realtime.push');
  });

  it('event thu hồi realtime ⇒ topic realtime.push (không rơi vào domain.events)', () => {
    expect(topicFor(RealtimeRevocationEvents.USER_BLOCKED)).toBe('realtime.push');
    expect(topicFor(RealtimeRevocationEvents.USER_REMOVED)).toBe('realtime.push');
  });

  it('event nghiệp vụ + cascade ⇒ topic domain.events', () => {
    expect(topicFor(DATASET_OUTBOX_EVENTS.INGESTED)).toBe('domain.events');
    expect(topicFor(PROJECT_OUTBOX_EVENTS.DELETED)).toBe('domain.events');
    expect(topicFor(WORKSPACE_OUTBOX_EVENTS.DELETED)).toBe('domain.events');
  });

  it('event lạ ⇒ topic domain.events', () => {
    expect(topicFor('SOMETHING_ELSE')).toBe('domain.events');
  });

  it('mọi topic trả về đều được consumer subscribe', () => {
    // Consumer subscribe đúng 4 topic này — nếu `topicFor` trả về topic khác
    // ⇒ event bị rơi mà không ai xử lý.
    const SUBSCRIBED = ['ai.jobs', 'notification.dispatch', 'realtime.push', 'domain.events'];
    const all = [
      'ai.job.status',
      'notification.created',
      'email.sent',
      'realtime.push',
      RealtimeRevocationEvents.USER_BLOCKED,
      RealtimeRevocationEvents.USER_REMOVED,
      DATASET_OUTBOX_EVENTS.INGESTED,
      PROJECT_OUTBOX_EVENTS.DELETED,
      WORKSPACE_OUTBOX_EVENTS.DELETED,
      'SOMETHING_ELSE',
    ];
    for (const eventType of all) {
      expect(SUBSCRIBED).toContain(topicFor(eventType));
    }
  });
});
