/**
 * Unit test thuần cho aggregate `Notification` (Bước 3 — Rich Domain Model).
 */
import { Notification } from '../../../src/modules/notifications/notifications.types';
import {
  ConflictError,
  ValidationError,
} from '../../../src/shared/domain/errors';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function buildNotification(
  overrides: Partial<Parameters<typeof Notification.reconstitute>[0]> = {},
): Notification {
  return Notification.reconstitute({
    id: 'n-1',
    userId: 'u-1',
    type: 'project_created',
    title: 'Dự án mới',
    summary: null,
    payload: null,
    sourceEventId: null,
    isMandatory: false,
    readAt: null,
    expiresAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    version: 1,
    ...overrides,
  });
}

describe('Notification entity — factory', () => {
  it('create() tạo thông báo chưa đọc, chưa bắt buộc', () => {
    const n = Notification.create({
      id: 'n-1',
      userId: 'u-1',
      type: 'project_created',
      title: '  Dự án mới  ',
      now: NOW,
    });

    expect(n.title).toBe('Dự án mới');
    expect(n.readAt).toBeNull();
    expect(n.isUnread()).toBe(true);
    expect(n.isMandatory).toBe(false);
  });

  it('create() loại bắt buộc → isMandatory=true', () => {
    const n = Notification.create({
      id: 'n-1',
      userId: 'u-1',
      type: 'security_alert',
      title: 'Cảnh báo',
      now: NOW,
    });

    expect(n.isMandatory).toBe(true);
  });

  it('create() type không hợp lệ → ValidationError', () => {
    expect(() =>
      Notification.create({
        id: 'n-1',
        userId: 'u-1',
        type: 'khong_hop_le',
        title: 'X',
        now: NOW,
      }),
    ).toThrow(ValidationError);
  });

  it('create() title rỗng → ValidationError', () => {
    expect(() =>
      Notification.create({
        id: 'n-1',
        userId: 'u-1',
        type: 'project_created',
        title: '   ',
        now: NOW,
      }),
    ).toThrow(ValidationError);
  });

  it('create() title > 200 ký tự → ValidationError', () => {
    expect(() =>
      Notification.create({
        id: 'n-1',
        userId: 'u-1',
        type: 'project_created',
        title: 'x'.repeat(201),
        now: NOW,
      }),
    ).toThrow(ValidationError);
  });

  it('create() summary > 500 ký tự → ValidationError', () => {
    expect(() =>
      Notification.create({
        id: 'n-1',
        userId: 'u-1',
        type: 'project_created',
        title: 'X',
        summary: 'y'.repeat(501),
        now: NOW,
      }),
    ).toThrow(ValidationError);
  });

  it('create() phát domain event notification.created', () => {
    const n = Notification.create({
      id: 'n-1',
      userId: 'u-1',
      type: 'project_created',
      title: 'X',
      now: NOW,
    });

    const events = n.dispatchDomainEvents();
    expect(events[0]?.eventType).toBe('notification.created');
    expect(n.dispatchDomainEvents()).toHaveLength(0);
  });

  it('reconstitute() không phát domain event', () => {
    expect(buildNotification().domainEvents).toHaveLength(0);
  });
});

describe('Notification entity — truy vấn', () => {
  it('isUnread()/isRead() phản ánh readAt', () => {
    expect(buildNotification().isUnread()).toBe(true);
    expect(buildNotification().isRead()).toBe(false);

    const read = buildNotification({ readAt: NOW });
    expect(read.isUnread()).toBe(false);
    expect(read.isRead()).toBe(true);
  });

  it('canDispatch(): tắt + không bắt buộc → false', () => {
    expect(Notification.canDispatch(false, false)).toBe(false);
  });

  it('canDispatch(): tắt + bắt buộc → true', () => {
    expect(Notification.canDispatch(false, true)).toBe(true);
  });

  it('canDispatch(): bật → true', () => {
    expect(Notification.canDispatch(true, false)).toBe(true);
    expect(Notification.canDispatch(undefined, false)).toBe(true);
  });

  it('resolveMandatory(): suy ra từ loại', () => {
    expect(Notification.resolveMandatory('issue_needs_info', false)).toBe(true);
    expect(Notification.resolveMandatory('security_alert', false)).toBe(true);
    expect(Notification.resolveMandatory('project_created', false)).toBe(false);
    expect(Notification.resolveMandatory('project_created', true)).toBe(true);
  });
});

describe('Notification entity — markAsRead()', () => {
  it('đánh dấu đã đọc', () => {
    const n = buildNotification();
    const at = new Date('2026-01-02T10:00:00.000Z');
    n.markAsRead(at);

    expect(n.readAt).toBe(at);
    expect(n.isRead()).toBe(true);
  });

  it('phát domain event notification.read', () => {
    const n = buildNotification();
    n.markAsRead(NOW);

    const events = n.dispatchDomainEvents();
    expect(events[0]?.eventType).toBe('notification.read');
  });

  it('đánh dấu đã đọc 2 lần → ConflictError', () => {
    const n = buildNotification({ readAt: NOW });
    expect(() => n.markAsRead()).toThrow(ConflictError);
  });
});

describe('Notification entity — toProps()', () => {
  it('toProps() trả bản chụp props đầy đủ', () => {
    const props = buildNotification().toProps();
    expect(props.id).toBe('n-1');
    expect(props.userId).toBe('u-1');
    expect(props.type).toBe('project_created');
    expect(props.version).toBe(1);
  });
});
