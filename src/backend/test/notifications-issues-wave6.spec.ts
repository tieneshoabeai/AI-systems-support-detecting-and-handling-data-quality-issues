import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { NotificationsService } from '../src/modules/notifications/application/notifications.service';
import { NOTIFICATION_REPOSITORY_PORT } from '../src/modules/notifications/domain/ports/notification.repository.port';
import { ISSUE_REPORT_REPOSITORY_PORT } from '../src/modules/issues/domain/ports/issue-report.repository.port';
import { USER_REPOSITORY_PORT } from '../src/modules/users/domain/ports/user.repository.port';
import { REALTIME_PORT } from '../src/modules/realtime/domain/ports/realtime.port';
import { IssuesService } from '../src/modules/issues/application/issues.service';
import { MandatoryNotificationTypes } from '../src/modules/notifications/infrastructure/persistence/notification.schema';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';

const oid = () => new Types.ObjectId().toHexString();

function notifRecord(i: number, userId: string) {
  return {
    id: oid(),
    userId,
    type: 'project_created',
    title: `tb ${i}`,
    summary: null,
    payload: null,
    sourceEventId: null,
    isMandatory: false,
    readAt: null,
    createdAt: new Date(Date.now() - i * 1000),
    updatedAt: new Date(),
  };
}

function issueRecord(overrides: Record<string, unknown> = {}) {
  const id = oid();
  const userId = oid();
  return {
    id,
    userId,
    workspaceId: null,
    issueType: 'function_error',
    title: 'loi',
    description: 'mo ta',
    status: 'new',
    attachments: [],
    context: {},
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('Wave6 NOTIF-01: cursor + unreadCount + sort createdAt', () => {
  let service: NotificationsService;
  let repo: Record<string, jest.Mock>;

  const userId = oid();

  beforeEach(async () => {
    repo = {
      listForUser: jest.fn().mockImplementation(async (_u: string, o: { limit: number }) => {
        const all = [notifRecord(0, userId), notifRecord(1, userId), notifRecord(2, userId)];
        return o.limit >= 2 ? all.slice(0, 3) : all.slice(0, o.limit + 1);
      }),
      countUnread: jest.fn().mockResolvedValue(2),
      findByIdForUser: jest.fn().mockResolvedValue(null),
      markAsRead: jest.fn(),
      create: jest.fn(),
      createIfEventNotExists: jest.fn(),
      existsByEvent: jest.fn(),
    };
    const usersPort = { findById: jest.fn(), updateNotificationPreferences: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NOTIFICATION_REPOSITORY_PORT, useValue: repo },
        { provide: USER_REPOSITORY_PORT, useValue: usersPort },
        { provide: REALTIME_PORT, useValue: { emitToUser: jest.fn() } },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('tra items + meta.nextCursor/hasMore + unreadCount', async () => {
    const r = await service.listForUser(userId, { limit: 2, sortOrder: 'desc', read: 'all' });
    expect(r.items).toHaveLength(2);
    expect(r.meta.hasMore).toBe(true);
    expect(typeof r.meta.nextCursor).toBe('string');
    expect(r.unreadCount).toBe(2);
  });

  it('cursor sai -> VALIDATION (BadRequest)', async () => {
    await expect(
      service.listForUser(userId, { limit: 10, sortOrder: 'desc', read: 'all', cursor: 'khong-phai-cursor' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('loc read khong hop le bi Zod chan (contract)', async () => {
    const { ListNotificationsQuerySchema } = await import(
      '../src/modules/notifications/infrastructure/http/dtos/list-notifications-query.dto'
    );
    expect(ListNotificationsQuerySchema.safeParse({ read: 'xyz' }).success).toBe(false);
    expect(ListNotificationsQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(ListNotificationsQuerySchema.safeParse({ sortBy: 'updatedAt' }).success).toBe(false);
  });
});

describe('Wave6 NOTIF-02/03: chi doc cua minh + cong tac', () => {
  it('mo chi tiet cua nguoi khac -> NOT_FOUND', async () => {
    const repo2 = {
      findByIdForUser: jest.fn().mockResolvedValue(null),
      markAsRead: jest.fn(),
      listForUser: jest.fn(),
      countUnread: jest.fn(),
      create: jest.fn(),
      createIfEventNotExists: jest.fn(),
      existsByEvent: jest.fn(),
    };
    const us2 = { findById: jest.fn(), updateNotificationPreferences: jest.fn() };
    const m: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NOTIFICATION_REPOSITORY_PORT, useValue: repo2 },
        { provide: USER_REPOSITORY_PORT, useValue: us2 },
        { provide: REALTIME_PORT, useValue: { emitToUser: jest.fn() } },
      ],
    }).compile();
    const s = m.get<NotificationsService>(NotificationsService);
    await expect(s.getDetail(oid(), oid())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('2 loai bat buoc dung nhu dac ta', () => {
    expect([...MandatoryNotificationTypes].sort()).toEqual(['issue_needs_info', 'security_alert'].sort());
  });

  it('tat cong tac van giu mandatory, bo thuong', async () => {
    const created: Array<Record<string, unknown>> = [];
    const repo3 = {
      createIfEventNotExists: jest.fn().mockImplementation(async (d: Record<string, unknown>) => {
        created.push(d);
        return { id: oid(), ...d, readAt: null, createdAt: new Date(), updatedAt: new Date() };
      }),
      listForUser: jest.fn(),
      countUnread: jest.fn(),
      findByIdForUser: jest.fn(),
      markAsRead: jest.fn(),
      create: jest.fn(),
      existsByEvent: jest.fn(),
    };
    const us3 = {
      findById: jest.fn().mockResolvedValue({ id: oid(), notificationsEnabled: false }),
      updateNotificationPreferences: jest.fn(),
    };
    const m: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NOTIFICATION_REPOSITORY_PORT, useValue: repo3 },
        { provide: USER_REPOSITORY_PORT, useValue: us3 },
        { provide: REALTIME_PORT, useValue: { emitToUser: jest.fn() } },
      ],
    }).compile();
    const s = m.get<NotificationsService>(NotificationsService);
    const r1 = await s.dispatch({ userId: oid(), type: 'project_created', title: 'x' });
    expect(r1).toBeNull();
    const r2 = await s.dispatch({
      userId: oid(),
      type: 'issue_needs_info',
      title: 'can bo sung',
      isMandatory: true,
    });
    expect(r2).not.toBeNull();
  });
});

describe('Wave6 ISSUE-01..04: tao/xem/doi trang thai', () => {
  const userId = oid();
  const mkService = async (repoVal: Record<string, jest.Mock>, notifCreate: jest.Mock) => {
    const notifPort = {
      create: jest.fn(),
      createIfEventNotExists: notifCreate,
      listForUser: jest.fn().mockResolvedValue([]),
      countUnread: jest.fn().mockResolvedValue(0),
      findByIdForUser: jest.fn().mockResolvedValue(null),
      markAsRead: jest.fn(),
      existsByEvent: jest.fn(),
    };
    const m: TestingModule = await Test.createTestingModule({
      providers: [
        IssuesService,
        { provide: ISSUE_REPORT_REPOSITORY_PORT, useValue: repoVal },
        { provide: NOTIFICATION_REPOSITORY_PORT, useValue: notifPort },
        { provide: USER_REPOSITORY_PORT, useValue: { findById: jest.fn().mockResolvedValue({ id: userId, notificationsEnabled: true }) } },
        { provide: REALTIME_PORT, useValue: { emitToUser: jest.fn() } },
      ],
    }).compile();
    return { service: m.get<IssuesService>(IssuesService), notifPort };
  };

  it('tao moi status=new version=1, khong lo storage_key', async () => {
    const created = issueRecord({ userId });
    const repoVal = {
      create: jest.fn().mockResolvedValue(created),
      list: jest.fn(),
      findById: jest.fn(),
      findByIdForUser: jest.fn(),
      updateStatus: jest.fn(),
      findStatusById: jest.fn(),
    };
    const { service: s } = await mkService(repoVal, jest.fn());
    const r = (await s.createReport(userId, {
      issueType: 'function_error',
      title: 'loi',
      description: 'mo ta',
    })) as Record<string, unknown>;
    expect(r.status).toBe('new');
    expect(r.version).toBe(1);
    expect(JSON.stringify(r)).not.toContain('storage_key');
  });

  it('chuyen trang thai sai -> 400; version lech -> 409; nguoi dung doi -> 403', async () => {
    const existing = issueRecord({ userId, status: 'new' });
    const repoVal = {
      create: jest.fn(),
      list: jest.fn(),
      findById: jest.fn().mockResolvedValue(existing),
      findByIdForUser: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(null),
      findStatusById: jest.fn(),
    };
    const { service: s } = await mkService(repoVal, jest.fn());
    await expect(s.updateStatus(oid(), 'analyst', 'resolved', 1)).rejects.toThrow('Chỉ quản trị viên');
    await expect(s.updateStatus(oid(), 'admin', 'resolved', 1)).rejects.toBeInstanceOf(BadRequestException);
    const repoVal2 = {
      create: jest.fn(),
      list: jest.fn(),
      findById: jest.fn().mockResolvedValue({ ...existing, status: 'in_progress' }),
      findByIdForUser: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(null),
      findStatusById: jest.fn(),
    };
    const { service: s2 } = await mkService(repoVal2, jest.fn());
    await expect(s2.updateStatus(oid(), 'admin', 'resolved', 1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('in_progress -> new gui mandatory issue_needs_info', async () => {
    const id = oid();
    const before = issueRecord({ id, userId, status: 'in_progress', title: 'bc' });
    const updated = issueRecord({ id, userId, status: 'new', title: 'bc' });
    const repoVal = {
      create: jest.fn(),
      list: jest.fn(),
      findById: jest.fn().mockResolvedValue(before),
      findByIdForUser: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(updated),
      findStatusById: jest.fn(),
    };
    const notifCreate = jest.fn().mockImplementation(async (d: Record<string, unknown>) => ({
      id: oid(),
      ...d,
      readAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const { service: s } = await mkService(repoVal, notifCreate);
    await s.updateStatus(id, 'admin', 'new', 1);
    expect(notifCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'issue_needs_info', isMandatory: true }),
    );
  });
});
