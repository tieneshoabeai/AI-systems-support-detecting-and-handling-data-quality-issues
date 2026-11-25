/**
 * Vấn đề 1 — Cascade xóa Workspace → Project → Dataset.
 *
 * Bối cảnh (sự cố đã tái hiện trên DB thật):
 *   Xóa workspace → project bên trong **không** bị xóa → `GET /projects` vẫn
 *   trả về chúng (4 project mồ côi đang tồn tại trong DB).
 *
 * Hai nguyên nhân độc lập:
 *   1. `DeleteWorkspaceHandler` chỉ soft-delete workspace, không cascade.
 *   2. `findAllPaged` chỉ lọc `deleted_at` của project, **không** xét trạng
 *      thái workspace cha → project mồ côi vẫn lọt.
 *
 * Ba lớp sửa được kiểm thử ở đây:
 *   - Cascade qua domain event (`WORKSPACE_DELETED` → `PROJECT_DELETED`).
 *   - Lớp phòng thủ ở tầng query (loại project của workspace đã xóa).
 *   - Tính idempotent (chạy lại vẫn đúng).
 */
import { CascadeWorkspaceProjectsHandler } from '../../../src/modules/projects/application/commands/cascade-workspace-projects.handler';
import { CascadeProjectDatasetsHandler } from '../../../src/modules/datasets/application/commands/cascade-project-datasets.handler';
import { DeleteWorkspaceHandler } from '../../../src/modules/workspaces/application/commands/delete-workspace.handler';
import { DeleteProjectHandler } from '../../../src/modules/projects/application/commands/delete-project.handler';
import { fakeTransaction, fakeTransactionWithRollback } from '../../helpers/transaction';

const WS_ID = '6afc2c17c37b4d662e5537bb';
const PROJECT_ID = '6af543f5556da4cf87ad6196';

describe('Cascade — Workspace sang Project', () => {
  it('xoa mem toan bo project thuoc workspace da xoa', async () => {
    const softDeleteByWorkspace = jest.fn().mockResolvedValue(3);
    const handler = new CascadeWorkspaceProjectsHandler({
      softDeleteByWorkspace,
    } as never);

    const deleted = await handler.execute(WS_ID);

    expect(deleted).toBe(3);
    expect(softDeleteByWorkspace).toHaveBeenCalledWith(WS_ID);
  });

  it('bo qua workspaceId khong hop le (khong goi repository)', async () => {
    const softDeleteByWorkspace = jest.fn().mockResolvedValue(0);
    const handler = new CascadeWorkspaceProjectsHandler({ softDeleteByWorkspace } as never);

    const deleted = await handler.execute('khong-hop-le');

    expect(deleted).toBe(0);
    expect(softDeleteByWorkspace).not.toHaveBeenCalled();
  });

  it('idempotent — chay lai tra 0 vi project da xoa het', async () => {
    const softDeleteByWorkspace = jest
      .fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);
    const handler = new CascadeWorkspaceProjectsHandler({ softDeleteByWorkspace } as never);

    expect(await handler.execute(WS_ID)).toBe(2);
    expect(await handler.execute(WS_ID)).toBe(0);
  });

  it('chi xu ly event WORKSPACE_DELETED', async () => {
    const softDeleteByWorkspace = jest.fn().mockResolvedValue(1);
    const handler = new CascadeWorkspaceProjectsHandler({ softDeleteByWorkspace } as never);

    expect(await handler.handleEvent('DATASET_INGESTED', { workspace_id: WS_ID })).toBe(0);
    expect(await handler.handleEvent('WORKSPACE_DELETED', { workspace_id: WS_ID })).toBe(1);
    expect(softDeleteByWorkspace).toHaveBeenCalledTimes(1);
  });

  it('doc duoc ca workspace_id lan workspaceId trong payload', async () => {
    const softDeleteByWorkspace = jest.fn().mockResolvedValue(1);
    const handler = new CascadeWorkspaceProjectsHandler({ softDeleteByWorkspace } as never);

    await handler.handleEvent('WORKSPACE_DELETED', { workspaceId: WS_ID });
    expect(softDeleteByWorkspace).toHaveBeenCalledWith(WS_ID);
  });
});

describe('Cascade — Project sang Dataset (file R2 + storage_used)', () => {
  /**
   * Tạo handler với mock repository/storage đầy đủ theo hợp đồng mới.
   *
   * Hợp đồng mới (sau khi sửa lỗi rò rỉ dung lượng):
   *   - `softDeleteByProject()` ⇒ dataset **còn sống** bị xóa mềm.
   *   - `listAllByProjectIncludingDeleted()` ⇒ **mọi** dataset của project
   *     (kể cả đã xóa mềm) để lần retry biết file nào cần dọn.
   *   - `markStorageReleased()` ⇒ cờ idempotent, `true` lần đầu.
   */
  function makeHandler(opts: {
    alive?: Array<{ id: string; fileSizeBytes: number }>;
    all?: Array<{
      id: string;
      fileSizeBytes: number;
      storageKey?: string;
      deleted?: boolean;
      storageReleased?: boolean;
    }>;
    deleteFile?: jest.Mock;
    fileExists?: jest.Mock;
    incrementStorageUsed?: jest.Mock;
    markStorageReleased?: jest.Mock;
  }) {
    const all =
      opts.all ??
      (opts.alive ?? []).map((d) => ({
        id: d.id,
        fileSizeBytes: d.fileSizeBytes,
        storageKey: `raw_files/${d.id}.csv`,
        deleted: false,
        storageReleased: false,
      }));
    const deleteFile = opts.deleteFile ?? jest.fn().mockResolvedValue(true);
    const fileExists = opts.fileExists ?? jest.fn().mockResolvedValue(false);
    const incrementStorageUsed =
      opts.incrementStorageUsed ?? jest.fn().mockResolvedValue(undefined);
    const markStorageReleased =
      opts.markStorageReleased ?? jest.fn().mockResolvedValue(true);

    const handler = new CascadeProjectDatasetsHandler(
      {
        softDeleteByProject: jest.fn().mockResolvedValue(opts.alive ?? []),
        listAllByProjectIncludingDeleted: jest.fn().mockResolvedValue(all),
        markStorageReleased,
      } as never,
      { deleteFile, fileExists } as never,
      { incrementStorageUsed } as never,
    );

    return { handler, deleteFile, fileExists, incrementStorageUsed, markStorageReleased };
  }

  it('soft-delete dataset, xoa file R2 va tru storage_used', async () => {
    const { handler, deleteFile, incrementStorageUsed } = makeHandler({
      alive: [
        { id: 'ds1', fileSizeBytes: 1000 },
        { id: 'ds2', fileSizeBytes: 500 },
      ],
    });

    const freed = await handler.execute(PROJECT_ID, WS_ID);

    expect(freed).toBe(1500);
    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(incrementStorageUsed).toHaveBeenCalledWith(WS_ID, -1500);
  });

  it('khong tru storage khi khong co dataset nao', async () => {
    const { handler, deleteFile, incrementStorageUsed } = makeHandler({ alive: [], all: [] });

    expect(await handler.execute(PROJECT_ID, WS_ID)).toBe(0);
    expect(deleteFile).not.toHaveBeenCalled();
    expect(incrementStorageUsed).not.toHaveBeenCalled();
  });

  it('loi xoa file R2 ⇒ nem loi (de Inbox retry) thay vi nuot loi', async () => {
    const { handler, incrementStorageUsed } = makeHandler({
      alive: [{ id: 'ds1', fileSizeBytes: 100 }],
      deleteFile: jest.fn().mockResolvedValue(false),
      // File vẫn còn trên storage ⇒ lỗi thật ⇒ phải ném ra để retry.
      fileExists: jest.fn().mockResolvedValue(true),
    });

    await expect(handler.execute(PROJECT_ID, WS_ID)).rejects.toThrow(/Khong dung xong/);
    // Không giải phóng được byte nào ⇒ không trừ `storage_used`.
    expect(incrementStorageUsed).not.toHaveBeenCalled();
  });

  it('deleteFile that bai (throw) ⇒ nem loi de Inbox retry', async () => {
    const { handler, incrementStorageUsed } = makeHandler({
      alive: [{ id: 'ds1', fileSizeBytes: 100 }],
      deleteFile: jest.fn().mockRejectedValue(new Error('R2 down')),
    });

    await expect(handler.execute(PROJECT_ID, WS_ID)).rejects.toThrow(/Khong dung xong/);
    expect(incrementStorageUsed).not.toHaveBeenCalled();
  });

  it('file da khong con tren storage ⇒ idempotent, khong nem loi', async () => {
    const { handler, incrementStorageUsed } = makeHandler({
      alive: [{ id: 'ds1', fileSizeBytes: 100 }],
      deleteFile: jest.fn().mockResolvedValue(false),
      // File không còn ⇒ đã dọn xong ở lần trước ⇒ OK.
      fileExists: jest.fn().mockResolvedValue(false),
    });

    await expect(handler.execute(PROJECT_ID, WS_ID)).resolves.toBe(100);
    expect(incrementStorageUsed).toHaveBeenCalledWith(WS_ID, -100);
  });

  it('retry: dataset da giai phong truoc do ⇒ KHONG tru storage_used lai (khong am)', async () => {
    // Lần retry: dataset đã có cờ `storage_released = true` ⇒ không trừ lần nữa.
    const { handler, incrementStorageUsed } = makeHandler({
      alive: [],
      all: [
        {
          id: 'ds1',
          fileSizeBytes: 1000,
          storageKey: 'raw_files/ds1.csv',
          deleted: true,
          storageReleased: true,
        },
      ],
      // Đánh dấu trả `false` ⇒ đã giải phóng trước đó.
      markStorageReleased: jest.fn().mockResolvedValue(false),
    });

    await expect(handler.execute(PROJECT_ID, WS_ID)).resolves.toBe(0);
    expect(incrementStorageUsed).not.toHaveBeenCalled();
  });

  it('bo qua projectId khong hop le', async () => {
    const { handler, deleteFile } = makeHandler({ alive: [] });

    expect(await handler.execute('sai')).toBe(0);
    expect(deleteFile).not.toHaveBeenCalled();
  });
});

describe('Phat event cascade', () => {
  it('DeleteWorkspaceHandler phat event WORKSPACE_DELETED kem workspace_id', async () => {
    const softDelete = jest.fn().mockResolvedValue(true);
    const recordEvent = jest.fn().mockResolvedValue({});
    const getWorkspaceByIdHandler = {
      execute: jest.fn().mockResolvedValue({ id: WS_ID, name: 'WS' }),
    };

    const handler = new DeleteWorkspaceHandler(
      { softDelete } as never,
      { recordEvent } as never,
      fakeTransaction() as never,
      getWorkspaceByIdHandler as never,
    );

    const result = await handler.execute(WS_ID);

    expect(result).toBe(true);
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregate_type: 'WORKSPACE',
        aggregate_id: WS_ID,
        event_type: 'WORKSPACE_DELETED',
        payload: expect.objectContaining({ workspace_id: WS_ID }),
      }),
    );
  });

  it('OPEN-09 — loi ghi outbox ⇒ rollback viec xoa workspace (strict)', async () => {
    const softDelete = jest.fn().mockResolvedValue(true);
    const recordEvent = jest.fn().mockRejectedValue(new Error('outbox down'));
    const getWorkspaceByIdHandler = {
      execute: jest.fn().mockResolvedValue({ id: WS_ID, name: 'WS' }),
    };
    const committed = { value: true };

    const handler = new DeleteWorkspaceHandler(
      { softDelete } as never,
      { recordEvent } as never,
      fakeTransactionWithRollback(committed) as never,
      getWorkspaceByIdHandler as never,
    );

    // Loi phai lan ra — khong duoc nuot.
    await expect(handler.execute(WS_ID)).rejects.toThrow('outbox down');
    // Transaction da rollback ⇒ thao tac chinh khong duoc commit.
    expect(committed.value).toBe(false);
  });

  it('DeleteProjectHandler phat event PROJECT_DELETED kem project_id + workspace_id', async () => {
    const softDelete = jest.fn().mockResolvedValue(true);
    const recordEvent = jest.fn().mockResolvedValue({});
    const getProjectByIdHandler = {
      execute: jest.fn().mockResolvedValue({ id: PROJECT_ID, name: 'P', workspaceId: WS_ID }),
    };

    const handler = new DeleteProjectHandler(
      { softDelete } as never,
      { recordEvent } as never,
      fakeTransaction() as never,
      getProjectByIdHandler as never,
    );

    const result = await handler.execute(PROJECT_ID);

    expect(result).toBe(true);
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregate_type: 'PROJECT',
        aggregate_id: PROJECT_ID,
        event_type: 'PROJECT_DELETED',
        payload: expect.objectContaining({ project_id: PROJECT_ID, workspace_id: WS_ID }),
      }),
    );
  });

  it('workspace da xoa truoc do → khong phat event lan nua', async () => {
    const softDelete = jest.fn().mockResolvedValue(false);
    const recordEvent = jest.fn();
    const getWorkspaceByIdHandler = {
      execute: jest.fn().mockResolvedValue({ id: WS_ID, name: 'WS' }),
    };

    const handler = new DeleteWorkspaceHandler(
      { softDelete } as never,
      { recordEvent } as never,
      fakeTransaction() as never,
      getWorkspaceByIdHandler as never,
    );

    expect(await handler.execute(WS_ID)).toBe(false);
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

describe('Lop phong thu - loc project theo workspace cha da xoa', () => {
  it('ListAllProjectsHandler truyen danh sach workspace da xoa xuong repository', async () => {
    const findAllPaged = jest.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
    const findDeletedIds = jest.fn().mockResolvedValue([WS_ID]);
    const projects = { findAllPaged };
    const workspaces = { findDeletedIds };

    const { ListAllProjectsHandler } = await import(
      '../../../src/modules/projects/application/queries/list-all-projects.handler'
    );
    const handler = new ListAllProjectsHandler(projects as never, workspaces as never);

    await handler.execute('user-1', [WS_ID], {}, false);

    expect(findDeletedIds).toHaveBeenCalled();
    const args = findAllPaged.mock.calls[0] as unknown[];
    // Tham so cuoi = danh sach workspace da xoa
    expect(args[4]).toEqual([WS_ID]);
  });

  it('loi khi goi findDeletedIds khong chan request', async () => {
    const findAllPaged = jest.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
    const findDeletedIds = jest.fn().mockRejectedValue(new Error('DB down'));
    const projects = { findAllPaged };
    const workspaces = { findDeletedIds };

    const { ListAllProjectsHandler } = await import(
      '../../../src/modules/projects/application/queries/list-all-projects.handler'
    );
    const handler = new ListAllProjectsHandler(projects as never, workspaces as never);

    await expect(handler.execute('user-1', [], {}, false)).resolves.toBeDefined();
    expect(findAllPaged).toHaveBeenCalled();
  });
});
