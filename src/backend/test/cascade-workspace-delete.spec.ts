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
import { CascadeWorkspaceProjectsHandler } from '../src/modules/projects/application/commands/cascade-workspace-projects.handler';
import { CascadeProjectDatasetsHandler } from '../src/modules/datasets/application/commands/cascade-project-datasets.handler';
import { DeleteWorkspaceHandler } from '../src/modules/workspaces/application/commands/delete-workspace.handler';
import { DeleteProjectHandler } from '../src/modules/projects/application/commands/delete-project.handler';
import { fakeTransaction, fakeTransactionWithRollback } from './helpers/transaction';

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
  it('soft-delete dataset, xoa file R2 va tru storage_used', async () => {
    const softDeleteByProject = jest.fn().mockResolvedValue([
      { id: 'ds1', fileSizeBytes: 1000 },
      { id: 'ds2', fileSizeBytes: 500 },
    ]);
    const deleteFile = jest.fn().mockResolvedValue(true);
    const incrementStorageUsed = jest.fn().mockResolvedValue(undefined);

    const handler = new CascadeProjectDatasetsHandler(
      { softDeleteByProject } as never,
      { deleteFile } as never,
      { incrementStorageUsed } as never,
    );

    const freed = await handler.execute(PROJECT_ID, WS_ID);

    expect(freed).toBe(1500);
    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(incrementStorageUsed).toHaveBeenCalledWith(WS_ID, -1500);
  });

  it('khong tru storage khi khong co dataset nao', async () => {
    const softDeleteByProject = jest.fn().mockResolvedValue([]);
    const deleteFile = jest.fn();
    const incrementStorageUsed = jest.fn();

    const handler = new CascadeProjectDatasetsHandler(
      { softDeleteByProject } as never,
      { deleteFile } as never,
      { incrementStorageUsed } as never,
    );

    expect(await handler.execute(PROJECT_ID, WS_ID)).toBe(0);
    expect(deleteFile).not.toHaveBeenCalled();
    expect(incrementStorageUsed).not.toHaveBeenCalled();
  });

  it('loi xoa file R2 khong lam hong cascade', async () => {
    const softDeleteByProject = jest
      .fn()
      .mockResolvedValue([{ id: 'ds1', fileSizeBytes: 100 }]);
    const deleteFile = jest.fn().mockRejectedValue(new Error('R2 down'));
    const incrementStorageUsed = jest.fn().mockResolvedValue(undefined);

    const handler = new CascadeProjectDatasetsHandler(
      { softDeleteByProject } as never,
      { deleteFile } as never,
      { incrementStorageUsed } as never,
    );

    await expect(handler.execute(PROJECT_ID, WS_ID)).resolves.toBe(100);
    expect(incrementStorageUsed).toHaveBeenCalledWith(WS_ID, -100);
  });

  it('bo qua projectId khong hop le', async () => {
    const softDeleteByProject = jest.fn();
    const handler = new CascadeProjectDatasetsHandler(
      { softDeleteByProject } as never,
      { deleteFile: jest.fn() } as never,
      { incrementStorageUsed: jest.fn() } as never,
    );

    expect(await handler.execute('sai')).toBe(0);
    expect(softDeleteByProject).not.toHaveBeenCalled();
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
      '../src/modules/projects/application/queries/list-all-projects.handler'
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
      '../src/modules/projects/application/queries/list-all-projects.handler'
    );
    const handler = new ListAllProjectsHandler(projects as never, workspaces as never);

    await expect(handler.execute('user-1', [], {}, false)).resolves.toBeDefined();
    expect(findAllPaged).toHaveBeenCalled();
  });
});
