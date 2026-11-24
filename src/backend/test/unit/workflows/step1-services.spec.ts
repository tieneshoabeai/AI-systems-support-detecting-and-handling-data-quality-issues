import { Test, TestingModule } from '@nestjs/testing';
import {
  AUTH_SESSION_POLICY_PORT,
  AUTH_SESSION_PORT,
  AUTH_TOKEN_ISSUER_PORT,
  AUTH_USER_LOOKUP_PORT,
  PASSWORD_HASHER_PORT,
  type AuthSessionRecord,
} from '../../../src/modules/auth/domain/ports/auth-session.port';
import {
  ISSUE_REPORT_REPOSITORY_PORT,
  type IssueReport,
} from '../../../src/modules/issues/domain/ports/issue-report.repository.port';
import { IssueReport as IssueReportEntity } from '../../../src/modules/issues/domain/entities/issue-report.entity';
import { NOTIFICATION_REPOSITORY_PORT } from '../../../src/modules/notifications/notifications.types';
import { USER_REPOSITORY_PORT } from '../../../src/modules/users/domain/ports/user.repository.port';
import { REALTIME_PORT } from '../../../src/shared/application/ports/realtime.port';
import { createHandlerProxy, type ProxyOf } from '../../helpers/handler-proxy';
import { authHandlers } from '../../helpers/module-handlers';
import { issuesHandlers } from '../../helpers/module-handlers';
import { ConflictError, ForbiddenError, NotFoundError, UnauthenticatedError } from '../../../src/shared/domain/errors';



const DAY = 24 * 60 * 60 * 1000;

function sessionRecord(overrides: Partial<AuthSessionRecord> = {}): AuthSessionRecord {
  return {
    id: 'sess-1',
    userId: 'user-1',
    refreshTokenHash: 'hash',
    deviceName: 'Chrome on Linux',
    ipAddress: '127.0.0.1',
    userAgent: 'UA',
    isRevoked: false,
    rememberMe: false,
    lastUsedAt: null,
    expiresAt: new Date(Date.now() + 7 * DAY),
    createdAt: new Date(),
    ...overrides,
  };
}

describe('Buoc 1 / Nhom C — AuthService remember-me', () => {
  let service: ProxyOf<typeof authHandlers>;
  let sessions: {
    createSession: jest.Mock;
    findSessionByTokenHash: jest.Mock;
    findSessionByTokenHashIncludingRevoked: jest.Mock;
    findActiveSessions: jest.Mock;
    findSessionById: jest.Mock;
    touchSession: jest.Mock;
    revokeSession: jest.Mock;
    revokeSessionById: jest.Mock;
    revokeAllUserSessions: jest.Mock;
  };
  let createSessionArgs: Record<string, unknown>[];

  const user = {
    id: 'user-1',
    email: 'a@b.com',
    role: 'analyst' as const,
    status: 'active' as const,
    passwordHash: 'hashed',
    deletedAt: null,
  };

  beforeEach(async () => {
    createSessionArgs = [];
    sessions = {
      createSession: jest.fn(async (d: Record<string, unknown>) => {
        createSessionArgs.push(d);
        return sessionRecord({
          id: 'sess-1',
          userId: d.userId as string,
          rememberMe: d.rememberMe === true,
          expiresAt: d.expiresAt as Date,
        });
      }),
      findSessionByTokenHash: jest.fn(),
      findSessionByTokenHashIncludingRevoked: jest.fn(),
      findActiveSessions: jest.fn(),
      findSessionById: jest.fn(),
      touchSession: jest.fn().mockResolvedValue(true),
      revokeSession: jest.fn().mockResolvedValue(true),
      revokeSessionById: jest.fn().mockResolvedValue(true),
      revokeAllUserSessions: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...Object.values(authHandlers),
        {
          provide: AUTH_USER_LOOKUP_PORT,
          useValue: { findByEmail: jest.fn().mockResolvedValue(user), findById: jest.fn().mockResolvedValue(user) },
        },
        { provide: AUTH_SESSION_PORT, useValue: sessions },
        { provide: PASSWORD_HASHER_PORT, useValue: { hash: jest.fn(), compare: jest.fn().mockResolvedValue(true) } },
        {
          provide: AUTH_TOKEN_ISSUER_PORT,
          useValue: { sign: jest.fn().mockReturnValue('access-token'), verify: jest.fn() },
        },
        {
          provide: AUTH_SESSION_POLICY_PORT,
          useValue: { refreshTtlMs: (rememberMe: boolean) => (rememberMe ? 30 * DAY : 7 * DAY) },
        },
      ],
    }).compile();

    service = createHandlerProxy(module, authHandlers);
  });

  it('login khong remember_me -> phien 7 ngay', async () => {
    const res = await service.login({ email: 'a@b.com', password: 'pw' });
    expect(res.remember_me).toBe(false);
    const arg = createSessionArgs[0] as { expiresAt: Date; rememberMe: boolean };
    expect(arg.rememberMe).toBe(false);
    const ttl = arg.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(6.9 * DAY);
    expect(ttl).toBeLessThanOrEqual(7 * DAY);
  });

  it('login remember_me=true -> phien 30 ngay', async () => {
    const res = await service.login({ email: 'a@b.com', password: 'pw', remember_me: true });
    expect(res.remember_me).toBe(true);
    const arg = createSessionArgs[0] as { expiresAt: Date; rememberMe: boolean };
    expect(arg.rememberMe).toBe(true);
    const ttl = arg.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(29.9 * DAY);
    expect(ttl).toBeLessThanOrEqual(30 * DAY);
    expect(res.expires_at).toBe(arg.expiresAt.toISOString());
  });

  it('refresh giu nguyen co remember_me va tao session moi cung han', async () => {
    sessions.findSessionByTokenHash.mockResolvedValue(
      sessionRecord({ rememberMe: true, expiresAt: new Date(Date.now() + 20 * DAY) }),
    );
    const res = await service.refreshAccessToken('raw-token');
    expect(res.remember_me).toBe(true);
    const arg = createSessionArgs[0] as { rememberMe: boolean; expiresAt: Date };
    expect(arg.rememberMe).toBe(true);
    const ttl = arg.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(29.9 * DAY);
    expect(sessions.revokeSessionById).toHaveBeenCalledWith('sess-1');
  });

  it('refresh session het han -> Unauthorized TOKEN_EXPIRED', async () => {
    sessions.findSessionByTokenHash.mockResolvedValue(
      sessionRecord({ expiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(service.refreshAccessToken('raw-token')).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('getSessions tra remember_me + last_used_at', async () => {
    sessions.findActiveSessions.mockResolvedValue([
      sessionRecord({ rememberMe: true, lastUsedAt: new Date('2026-01-01T00:00:00.000Z') }),
    ]);
    const list = await service.getSessions('user-1');
    expect(list).toHaveLength(1);
    expect(list[0]?.remember_me).toBe(true);
    expect(list[0]?.last_used_at).toBe('2026-01-01T00:00:00.000Z');
  });

  it('getSessionById cua nguoi khac -> NotFound (chong IDOR)', async () => {
    sessions.findSessionById.mockResolvedValue(sessionRecord({ userId: 'user-khac' }));
    await expect(service.getSessionById('user-1', 'sess-1')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('getSessionById cua chinh minh -> OK', async () => {
    sessions.findSessionById.mockResolvedValue(sessionRecord({ userId: 'user-1' }));
    const r = await service.getSessionById('user-1', 'sess-1');
    expect(r.id).toBe('sess-1');
    expect(r.remember_me).toBe(false);
  });
});

describe('Buoc 1 / Nhom D — IssuesService needs_info', () => {
  let service: ProxyOf<typeof issuesHandlers>;
  let repo: {
    create: jest.Mock;
    list: jest.Mock;
    findById: jest.Mock;
    findByIdForUser: jest.Mock;
    addAttachment: jest.Mock;
    updateStatus: jest.Mock;
    updateByUser: jest.Mock;
    findStatusById: jest.Mock;
  };
  let notifCreate: jest.Mock;

  const userId = 'user-1';

  /**
   * Bước 3 — Rich Domain Model: repository trả **entity** `IssueReport`,
   * nên mock phải dựng entity thật để hành vi của entity dùng được.
   */
  function issue(overrides: Partial<Parameters<typeof IssueReportEntity.reconstitute>[0]> = {}): IssueReport {
    return IssueReportEntity.reconstitute({
      id: 'issue-1',
      userId,
      workspaceId: null,
      issueType: 'function_error',
      title: 'loi',
      description: 'mo ta',
      status: 'new',
      attachments: [],
      context: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    });
  }

  beforeEach(async () => {
    notifCreate = jest.fn().mockImplementation(async (d: Record<string, unknown>) => ({
      id: 'notif-1',
      ...d,
      readAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    repo = {
      create: jest.fn(),
      list: jest.fn(),
      findById: jest.fn(),
      findByIdForUser: jest.fn(),
      addAttachment: jest.fn(),
      updateStatus: jest.fn(),
      updateByUser: jest.fn(),
      findStatusById: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...Object.values(issuesHandlers),
        { provide: ISSUE_REPORT_REPOSITORY_PORT, useValue: repo },
        {
          provide: NOTIFICATION_REPOSITORY_PORT,
          useValue: {
            create: jest.fn(),
            createIfEventNotExists: notifCreate,
            listForUser: jest.fn(),
            countUnread: jest.fn(),
            findByIdForUser: jest.fn(),
            markAsRead: jest.fn(),
            existsByEvent: jest.fn(),
          },
        },
        {
          provide: USER_REPOSITORY_PORT,
          useValue: { findById: jest.fn().mockResolvedValue({ id: userId, notificationsEnabled: true }) },
        },
        { provide: REALTIME_PORT, useValue: { emitToUser: jest.fn() } },
      ],
    }).compile();
    service = createHandlerProxy(module, issuesHandlers);
  });

  it('admin chuyen sang needs_info -> gui thong bao mandatory issue_needs_info', async () => {
    repo.findById.mockResolvedValue(issue({ status: 'new' }));
    repo.updateStatus.mockResolvedValue(issue({ status: 'needs_info', version: 2 }));
    await service.updateStatus('issue-1', 'admin', 'needs_info', 1);
    expect(notifCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'issue_needs_info', isMandatory: true }),
    );
  });

  it('admin chuyen new -> needs_info la transition hop le', async () => {
    repo.findById.mockResolvedValue(issue({ status: 'new' }));
    repo.updateStatus.mockResolvedValue(issue({ status: 'needs_info', version: 2 }));
    await expect(
      service.updateStatus('issue-1', 'admin', 'needs_info', 1),
    ).resolves.toBeDefined();
  });

  it('nguoi dung sua bao cao khi needs_info -> quay ve in_progress', async () => {
    repo.findByIdForUser.mockResolvedValue(issue({ status: 'needs_info', version: 3 }));
    repo.updateByUser.mockResolvedValue(issue({ status: 'in_progress', version: 4, title: 'sua' }));
    const r = await service.updateMyReport(userId, 'issue-1', {
      title: 'sua',
      expectedVersion: 3,
    });
    expect(r.status).toBe('in_progress');
    expect(r.version).toBe(4);
    expect(repo.updateByUser).toHaveBeenCalledWith(
      'issue-1',
      expect.objectContaining({ userId, title: 'sua', expectedVersion: 3 }),
    );
  });

  it('nguoi dung sua bao cao khi trang thai khac -> Forbidden', async () => {
    repo.findByIdForUser.mockResolvedValue(issue({ status: 'in_progress', version: 1 }));
    await expect(
      service.updateMyReport(userId, 'issue-1', { title: 'sua', expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(repo.updateByUser).not.toHaveBeenCalled();
  });

  it('version lech -> Conflict', async () => {
    repo.findByIdForUser.mockResolvedValue(issue({ status: 'needs_info', version: 5 }));
    await expect(
      service.updateMyReport(userId, 'issue-1', { title: 'sua', expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('khong tim thay bao cao -> NotFound', async () => {
    repo.findByIdForUser.mockResolvedValue(null);
    await expect(
      service.updateMyReport(userId, 'issue-1', { title: 'sua', expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('khong duoc sua khi khong co truong nao thay doi -> BadRequest (contract)', async () => {
    const { UpdateMyIssueSchema } = await import(
      '../../../src/modules/issues/presentation/dtos/create-issue.dto'
    );
    expect(UpdateMyIssueSchema.safeParse({ expectedVersion: 1 }).success).toBe(false);
  });

  it('chi giu tep dinh kem thuoc ve bao cao', async () => {
    repo.findByIdForUser.mockResolvedValue(
      issue({
        status: 'needs_info',
        version: 1,
        attachments: [
          { id: 'att-1', filename: 'a.png', storageKey: 'k1', sizeBytes: 10, contentType: 'image/png' },
        ],
      }),
    );
    repo.updateByUser.mockResolvedValue(issue({ status: 'in_progress', version: 2 }));
    await service.updateMyReport(userId, 'issue-1', {
      expectedVersion: 1,
      removeAttachmentIds: ['att-1', 'att-khong-ton-tai'],
    });
    const call = repo.updateByUser.mock.calls[0]?.[1] as { removeAttachmentIds: string[] };
    expect(call.removeAttachmentIds).toEqual(['att-1']);
  });
});
