/**
 * OPEN-09 (Conflict #4) — **Strict + Mongo transaction**.
 *
 * Quyết định:
 * 1. **Strict** — ghi event/outbox thất bại ⇒ **nghiệp vụ chính cũng thất bại**,
 *    báo lỗi cho người dùng. Không "xoá xong rồi nuốt lỗi".
 * 2. Ghi event **trong cùng transaction** với thao tác chính ⇒ không mất event.
 *
 * File này kiểm thử:
 * - Handler nào của nghiệp vụ **bọc** thao tác chính + ghi outbox trong
 *   `runInTransaction`.
 * - Lỗi ghi outbox ⇒ lỗi lan ra (không nuốt) ⇒ transaction rollback.
 * - `OutboxService` tự gia nhập session từ `MongoSessionContext`.
 */
import { DeleteWorkspaceHandler } from '../../../src/modules/workspaces/application/commands/delete-workspace.handler';
import { DeleteProjectHandler } from '../../../src/modules/projects/application/commands/delete-project.handler';
import { SoftDeleteUserHandler } from '../../../src/modules/users/application/commands/soft-delete-user.handler';
import { OutboxService } from '../../../src/shared/infrastructure/outbox/outbox.service';
import { MongoSessionContext } from '../../../src/shared/infrastructure/database/mongo-session-context';
import { fakeTransaction, fakeTransactionWithRollback } from '../../helpers/transaction';

const WS_ID = '6afc2c17c37b4d662e5537bb';
const PROJECT_ID = '6af543f5556da4cf87ad6196';

describe('OPEN-09 — Outbox strict (lỗi ghi event ⇒ nghiệp vụ chính thất bại)', () => {
  it('DeleteWorkspaceHandler: lỗi outbox ⇒ ném lỗi + rollback', async () => {
    const softDelete = jest.fn().mockResolvedValue(true);
    const recordEvent = jest.fn().mockRejectedValue(new Error('outbox down'));
    const committed = { value: true };

    const handler = new DeleteWorkspaceHandler(
      { softDelete } as never,
      { recordEvent } as never,
      fakeTransactionWithRollback(committed) as never,
      { execute: jest.fn().mockResolvedValue({ id: WS_ID, name: 'WS' }) } as never,
    );

    await expect(handler.execute(WS_ID)).rejects.toThrow('outbox down');
    expect(committed.value).toBe(false);
    expect(softDelete).toHaveBeenCalledWith(WS_ID);
  });

  it('DeleteWorkspaceHandler: ghi event thành công ⇒ commit', async () => {
    const softDelete = jest.fn().mockResolvedValue(true);
    const recordEvent = jest.fn().mockResolvedValue({});
    const committed = { value: false };

    const handler = new DeleteWorkspaceHandler(
      { softDelete } as never,
      { recordEvent } as never,
      fakeTransactionWithRollback(committed) as never,
      { execute: jest.fn().mockResolvedValue({ id: WS_ID, name: 'WS' }) } as never,
    );

    await expect(handler.execute(WS_ID)).resolves.toBe(true);
    expect(committed.value).toBe(true);
  });

  it('DeleteWorkspaceHandler: đã xoá trước đó ⇒ KHÔNG ghi event, KHÔNG lỗi', async () => {
    const softDelete = jest.fn().mockResolvedValue(false);
    const recordEvent = jest.fn();

    const handler = new DeleteWorkspaceHandler(
      { softDelete } as never,
      { recordEvent } as never,
      fakeTransaction() as never,
      { execute: jest.fn().mockResolvedValue({ id: WS_ID, name: 'WS' }) } as never,
    );

    await expect(handler.execute(WS_ID)).resolves.toBe(false);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it('DeleteProjectHandler: lỗi outbox ⇒ ném lỗi + rollback', async () => {
    const softDelete = jest.fn().mockResolvedValue(true);
    const recordEvent = jest.fn().mockRejectedValue(new Error('outbox down'));
    const committed = { value: true };

    const handler = new DeleteProjectHandler(
      { softDelete } as never,
      { recordEvent } as never,
      fakeTransactionWithRollback(committed) as never,
      { execute: jest.fn().mockResolvedValue({ id: PROJECT_ID, name: 'P', workspaceId: WS_ID }) } as never,
    );

    await expect(handler.execute(PROJECT_ID)).rejects.toThrow('outbox down');
    expect(committed.value).toBe(false);
  });

  it('DeleteProjectHandler: ghi event thành công ⇒ commit', async () => {
    const softDelete = jest.fn().mockResolvedValue(true);
    const recordEvent = jest.fn().mockResolvedValue({});
    const committed = { value: false };

    const handler = new DeleteProjectHandler(
      { softDelete } as never,
      { recordEvent } as never,
      fakeTransactionWithRollback(committed) as never,
      { execute: jest.fn().mockResolvedValue({ id: PROJECT_ID, name: 'P', workspaceId: WS_ID }) } as never,
    );

    await expect(handler.execute(PROJECT_ID)).resolves.toBe(true);
    expect(committed.value).toBe(true);
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ aggregate_type: 'PROJECT', event_type: 'PROJECT_DELETED' }),
    );
  });

  it('SoftDeleteUserHandler: lỗi ghi event thu hồi ⇒ rollback xoá tài khoản', async () => {
    const softDeleteUser = jest.fn().mockResolvedValue(true);
    const committed = { value: true };
    const revocation = {
      revokeStrict: jest.fn().mockRejectedValue(new Error('outbox down')),
      publishImmediateNow: jest.fn(),
    };

    const handler = new SoftDeleteUserHandler(
      {
        findById: jest.fn().mockResolvedValue({ id: 'u1', softDelete: jest.fn() }),
        softDeleteUser,
      } as never,
      fakeTransactionWithRollback(committed) as never,
      revocation as never,
    );

    await expect(handler.execute('u1')).rejects.toThrow('outbox down');
    expect(committed.value).toBe(false);
    // Socket KHÔNG được đóng khi transaction rollback (tài khoản vẫn còn sống).
    expect(revocation.publishImmediateNow).not.toHaveBeenCalled();
  });

  it('SoftDeleteUserHandler: commit ⇒ đóng socket ngay (sau commit)', async () => {
    const revocation = {
      revokeStrict: jest.fn().mockResolvedValue(undefined),
      publishImmediateNow: jest.fn().mockResolvedValue(undefined),
    };

    const handler = new SoftDeleteUserHandler(
      {
        findById: jest.fn().mockResolvedValue({ id: 'u1', softDelete: jest.fn() }),
        softDeleteUser: jest.fn().mockResolvedValue(true),
      } as never,
      fakeTransaction() as never,
      revocation as never,
    );

    await expect(handler.execute('u1')).resolves.toBe(true);
    expect(revocation.revokeStrict).toHaveBeenCalledWith('u1', 'removed');
    expect(revocation.publishImmediateNow).toHaveBeenCalledWith('u1', 'removed');
  });
});

describe('OPEN-09 — OutboxService gia nhập session từ MongoSessionContext', () => {
  function makeModel(): {
    model: unknown;
    saves: Array<{ session: unknown }>;
  } {
    const saves: Array<{ session: unknown }> = [];
    class FakeDoc {
      constructor(public readonly data: Record<string, unknown>) {}
      async save(options?: { session?: unknown }): Promise<FakeDoc> {
        saves.push({ session: options?.session });
        return this;
      }
    }
    return { model: FakeDoc, saves };
  }

  it('ghi event với session của transaction đang chạy', async () => {
    const { model, saves } = makeModel();
    const service = new OutboxService(model as never);
    const fakeSession = { id: 'sess-1' };

    await MongoSessionContext.run(fakeSession as never, async () => {
      await service.recordEvent({
        aggregate_type: 'PROJECT',
        aggregate_id: PROJECT_ID,
        event_type: 'PROJECT_DELETED',
        payload: { project_id: PROJECT_ID },
      });
    });

    expect(saves).toHaveLength(1);
    expect(saves[0]?.session).toBe(fakeSession);
  });

  it('ngoài transaction ⇒ session undefined (ghi độc lập)', async () => {
    const { model, saves } = makeModel();
    const service = new OutboxService(model as never);

    await service.recordEvent({
      aggregate_type: 'PROJECT',
      aggregate_id: PROJECT_ID,
      event_type: 'PROJECT_DELETED',
      payload: {},
    });

    expect(saves).toHaveLength(1);
    expect(saves[0]?.session).toBeUndefined();
  });
});
