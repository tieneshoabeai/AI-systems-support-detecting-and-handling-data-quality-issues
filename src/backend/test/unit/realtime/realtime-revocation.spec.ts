/**
 * OPEN-08 — **Thu hồi realtime tức thì** khi tài khoản bị khoá / bị xoá.
 *
 * Quyết định (docs/restructures/24_open_decisions_resolved.md §OPEN-08):
 * - Phát event `USER_BLOCKED` / `USER_REMOVED` (qua outbox, theo OPEN-09 → cùng transaction).
 * - Realtime adapter nhận event → tìm socket của user → **đóng hẳn socket**.
 * - Kiểm tra lúc kết nối (`realtime-auth.service.ts`) giữ nguyên là lớp phòng thủ thứ hai.
 *
 * Test khoá 3 hành vi:
 * 1. `UserAccessRevocationService` phát event (tức thì + outbox) với đúng tên.
 * 2. `RealtimeRevocationSubscriber` nghe event → gọi `disconnectUser` đúng user/status.
 * 3. `RealtimeService.disconnectUser` → emit `user.force_disconnect` **rồi** đóng socket.
 */
import { RealtimeRevocationSubscriber } from '../../../src/modules/realtime/realtime-revocation.subscriber';
import { RealtimeService } from '../../../src/modules/realtime/realtime.service';
import { UserAccessRevocationService } from '../../../src/modules/users/application/services/user-access-revocation.service';
import { BlockUserHandler } from '../../../src/modules/users/application/commands/block-user.handler';
import { SoftDeleteUserHandler } from '../../../src/modules/users/application/commands/soft-delete-user.handler';
import { fakeTransaction } from '../../helpers/transaction';
import { USER_OUTBOX_EVENTS } from '../../../src/modules/users/domain/events/user-events';
import { RealtimeRevocationEvents } from '../../../src/shared/domain/utils/realtime-events';
import type { DomainEventEnvelope } from '../../../src/shared/application/ports/event-publisher.port';
import type { OutboxEventInput } from '../../../src/shared/application/ports/outbox.port';
import type { UserRepositoryPort } from '../../../src/modules/users/domain/ports/user.repository.port';
import { User } from '../../../src/modules/users/domain/entities/user.entity';
import { NotFoundError } from '../../../src/shared/domain/errors';

// ── Fake ──────────────────────────────────────────────────────────────────

class FakeRegistry {
  readonly handlers: Array<{ consumerName: string; eventTypes: readonly string[]; handle: (e: DomainEventEnvelope) => Promise<void> }> = [];
  register(handler: { consumerName: string; eventTypes: readonly string[]; handle: (e: DomainEventEnvelope) => Promise<void> }): void {
    this.handlers.push(handler);
  }
}

function makeEnvelope(eventType: string, payload: Record<string, unknown>): DomainEventEnvelope {
  return {
    eventId: 'e1',
    eventType,
    aggregateType: 'USER',
    aggregateId: 'u1',
    payload,
    workspaceId: null,
    projectId: null,
    actorId: null,
    occurredAt: new Date().toISOString(),
  };
}

function makeUser(status: 'active' | 'blocked' = 'active'): User {
  return User.reconstitute({
    id: 'u1',
    email: 'user@example.com',
    passwordHash: 'h',
    googleId: null,
    authProvider: 'local',
    firstName: 'Nguyễn',
    lastName: 'An',
    avatarUrl: null,
    phone: null,
    bio: null,
    role: 'analyst',
    notificationsEnabled: true,
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    version: 1,
  });
}

// ── Test ──────────────────────────────────────────────────────────────────

describe('OPEN-08 — UserAccessRevocationService phát event thu hồi', () => {
  it('blocked → phát USER_BLOCKED (tức thì) + ghi outbox', async () => {
    const published: DomainEventEnvelope[] = [];
    const outbox: OutboxEventInput[] = [];
    const svc = new UserAccessRevocationService(
      {
        mode: 'in-process',
        publish: async (e) => {
          published.push(e);
        },
      },
      {
        recordEvent: async (d) => {
          outbox.push(d);
          return {};
        },
      },
    );

    await svc.revoke('u1', 'blocked');

    expect(published).toHaveLength(1);
    expect(published[0]!.eventType).toBe(USER_OUTBOX_EVENTS.BLOCKED);
    expect(published[0]!.eventType).toBe(RealtimeRevocationEvents.USER_BLOCKED);
    expect(published[0]!.aggregateType).toBe('USER');
    expect(published[0]!.aggregateId).toBe('u1');
    expect(published[0]!.payload.user_id).toBe('u1');

    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.event_type).toBe(USER_OUTBOX_EVENTS.BLOCKED);
    expect(outbox[0]!.aggregate_type).toBe('USER');
  });

  it('removed → phát USER_REMOVED', async () => {
    const published: DomainEventEnvelope[] = [];
    const svc = new UserAccessRevocationService(
      {
        mode: 'in-process',
        publish: async (e) => {
          published.push(e);
        },
      },
      undefined,
    );

    await svc.revoke('u1', 'removed');
    expect(published[0]!.eventType).toBe(RealtimeRevocationEvents.USER_REMOVED);
  });

  it('lỗi publish/outbox KHÔNG làm hỏng nghiệp vụ chính (best-effort)', async () => {
    const svc = new UserAccessRevocationService(
      {
        mode: 'in-process',
        publish: async () => {
          throw new Error('busy');
        },
      },
      {
        recordEvent: async () => {
          throw new Error('db down');
        },
      },
    );
    await expect(svc.revoke('u1', 'blocked')).resolves.toBeUndefined();
  });
});

describe('OPEN-08 — RealtimeRevocationSubscriber đóng socket khi nhận event', () => {
  it('đăng ký handler cho cả USER_BLOCKED và USER_REMOVED', () => {
    const registry = new FakeRegistry();
    const sub = new RealtimeRevocationSubscriber(registry as never, {
      disconnectUser: () => undefined,
    } as never);
    sub.onModuleInit();

    expect(registry.handlers).toHaveLength(1);
    expect(registry.handlers[0]!.eventTypes).toEqual([
      RealtimeRevocationEvents.USER_BLOCKED,
      RealtimeRevocationEvents.USER_REMOVED,
    ]);
  });

  it('USER_BLOCKED → disconnectUser(userId, "blocked")', async () => {
    const registry = new FakeRegistry();
    const calls: Array<[string, string]> = [];
    const sub = new RealtimeRevocationSubscriber(registry as never, {
      disconnectUser: (userId: string, status: string) => {
        calls.push([userId, status]);
      },
    } as never);
    sub.onModuleInit();

    await registry.handlers[0]!.handle(makeEnvelope(RealtimeRevocationEvents.USER_BLOCKED, { user_id: 'u42' }));
    expect(calls).toEqual([['u42', 'blocked']]);
  });

  it('USER_REMOVED → disconnectUser(userId, "removed")', async () => {
    const registry = new FakeRegistry();
    const calls: Array<[string, string]> = [];
    const sub = new RealtimeRevocationSubscriber(registry as never, {
      disconnectUser: (userId: string, status: string) => {
        calls.push([userId, status]);
      },
    } as never);
    sub.onModuleInit();

    await registry.handlers[0]!.handle(makeEnvelope(RealtimeRevocationEvents.USER_REMOVED, { user_id: 'u7' }));
    expect(calls).toEqual([['u7', 'removed']]);
  });

  it('payload thiếu user id → bỏ qua, KHÔNG đóng socket sai', async () => {
    const registry = new FakeRegistry();
    const calls: string[] = [];
    const sub = new RealtimeRevocationSubscriber(registry as never, {
      disconnectUser: (userId: string) => {
        calls.push(userId);
      },
    } as never);
    sub.onModuleInit();

    await registry.handlers[0]!.handle(makeEnvelope(RealtimeRevocationEvents.USER_BLOCKED, {}));
    await registry.handlers[0]!.handle(makeEnvelope(RealtimeRevocationEvents.USER_BLOCKED, { user_id: '  ' }));
    expect(calls).toEqual([]);
  });
});

describe('OPEN-08 — RealtimeService.disconnectUser', () => {
  function makeService(enabled = true) {
    const emitted: Array<{ room: string; envelope: { event: string; status?: string } }> = [];
    const disconnected: string[] = [];
    const svc = new RealtimeService(
      { get: () => enabled } as never,
      {
        emitToRoom: (room: string, envelope: { event: string; status?: string }) => {
          emitted.push({ room, envelope });
          return true;
        },
        disconnectUser: (userId: string) => {
          disconnected.push(userId);
          return true;
        },
      },
    );
    return { svc, emitted, disconnected };
  }

  it('gửi user.force_disconnect cho room user rồi ĐÓNG socket', () => {
    const { svc, emitted, disconnected } = makeService();
    svc.disconnectUser('u1', 'blocked');

    expect(emitted).toHaveLength(1);
    expect(emitted[0]!.room).toBe('user:u1');
    expect(emitted[0]!.envelope.event).toBe('user.force_disconnect');
    expect(emitted[0]!.envelope.status).toBe('blocked');
    expect(disconnected).toEqual(['u1']);
  });

  it('SOCKET_ENABLED=false → không emit, không đóng socket', () => {
    const { svc, emitted, disconnected } = makeService(false);
    svc.disconnectUser('u1', 'removed');
    expect(emitted).toHaveLength(0);
    expect(disconnected).toHaveLength(0);
  });

  it('transport ném lỗi → không làm hỏng luồng chính', () => {
    const svc = new RealtimeService(
      { get: () => true } as never,
      {
        emitToRoom: () => true,
        disconnectUser: () => {
          throw new Error('socket.io down');
        },
      },
    );
    expect(() => svc.disconnectUser('u1', 'blocked')).not.toThrow();
  });
});

describe('OPEN-08 — handler khoá / xoá tài khoản gọi thu hồi realtime', () => {
  function makeRepo(user: User | null) {
    const calls = {
      setStatus: [] as Array<[string, string]>,
      softDelete: [] as string[],
      revokeAllSessions: [] as string[],
    };
    const repo = {
      findById: async () => user,
      setStatus: async (userId: string, status: string) => {
        calls.setStatus.push([userId, status]);
        return true;
      },
      softDeleteUser: async (userId: string) => {
        calls.softDelete.push(userId);
        return true;
      },
      revokeAllUserSessions: async (userId: string) => {
        calls.revokeAllSessions.push(userId);
        return 1;
      },
    } as unknown as UserRepositoryPort;
    return { repo, calls };
  }

  it('BlockUserHandler: khoá → setStatus + thu hồi realtime + thu hồi phiên', async () => {
    const { repo, calls } = makeRepo(makeUser('active'));
    const revoked: Array<[string, string]> = [];
    const svc = {
      revoke: async (userId: string, status: string) => {
        revoked.push([userId, status]);
      },
    } as unknown as UserAccessRevocationService;

    const handler = new BlockUserHandler(repo, svc);
    expect(await handler.execute('u1')).toBe(true);
    expect(calls.setStatus).toEqual([['u1', 'blocked']]);
    expect(revoked).toEqual([['u1', 'blocked']]);
    expect(calls.revokeAllSessions).toEqual(['u1']);
  });

  it('BlockUserHandler: user không tồn tại → NotFoundError', async () => {
    const { repo } = makeRepo(null);
    const svc = { revoke: async () => undefined } as unknown as UserAccessRevocationService;
    const handler = new BlockUserHandler(repo, svc);
    await expect(handler.execute('u404')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('BlockUserHandler: đã bị khoá → không phát lại event', async () => {
    const { repo, calls } = makeRepo(makeUser('blocked'));
    const revoked: string[] = [];
    const svc = {
      revoke: async (userId: string) => {
        revoked.push(userId);
      },
    } as unknown as UserAccessRevocationService;

    const handler = new BlockUserHandler(repo, svc);
    expect(await handler.execute('u1')).toBe(false);
    expect(revoked).toHaveLength(0);
    expect(calls.setStatus).toHaveLength(0);
  });

  it('SoftDeleteUserHandler: xoá → thu hồi realtime với lý do "removed"', async () => {
    const { repo, calls } = makeRepo(makeUser('active'));
    const revoked: Array<[string, string]> = [];
    const svc = {
      revoke: async (userId: string, status: string) => {
        revoked.push([userId, status]);
      },
      revokeStrict: async (userId: string, status: string) => {
        revoked.push([userId, status]);
      },
      publishImmediateNow: async (userId: string, status: string) => {
        revoked.push([userId, status]);
      },
    } as unknown as UserAccessRevocationService;

    // OPEN-09 — xoá mềm + ghi event thu hồi nằm trong cùng transaction.
    const handler = new SoftDeleteUserHandler(repo, fakeTransaction() as never, svc);
    expect(await handler.execute('u1')).toBe(true);
    expect(calls.softDelete).toEqual(['u1']);
    expect(revoked).toEqual([
      ['u1', 'removed'],
      ['u1', 'removed'],
    ]);
  });
});
