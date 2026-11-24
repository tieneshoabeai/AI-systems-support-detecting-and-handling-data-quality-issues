/**
 * B2.3 — Test tích hợp cascade xóa: Workspace → Project → Dataset → Records.
 *
 * ── Mục tiêu ───────────────────────────────────────────────────────────────
 * Chứng minh trên MongoDB thật (replica set) rằng:
 *   1. Xóa workspace ⇒ project bên trong **không còn sống** (`deleted_at` khác null).
 *   2. Xóa project ⇒ dataset của project **không còn sống**.
 *   3. Xóa dataset ⇒ bản ghi (`dataset_records`) **bị xóa cứng**.
 *   4. Dung lượng workspace được **trừ** đúng bằng tổng dung lượng dataset.
 *   5. **Idempotent**: chạy lại cascade nhiều lần vẫn cho kết quả đúng
 *      (không xóa nhầm, không trừ trùng dung lượng).
 *
 * Yêu cầu hạ tầng:
 * ```bash
 * pnpm run test:infra:up
 * ```
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { WorkspacesRepository } from '../../src/modules/workspaces/infrastructure/persistence/workspaces.repository';
import { ProjectsRepository } from '../../src/modules/projects/infrastructure/persistence/projects.repository';
import { DatasetsRepository } from '../../src/modules/datasets/infrastructure/persistence/datasets.repository';
import { CascadeWorkspaceProjectsHandler } from '../../src/modules/projects/application/commands/cascade-workspace-projects.handler';
import { CascadeProjectDatasetsHandler } from '../../src/modules/datasets/application/commands/cascade-project-datasets.handler';
import {
  WorkspaceSchema,
  type IWorkspace,
} from '../../src/modules/workspaces/infrastructure/persistence/workspace.schema';
import {
  ProjectSchema,
  type IProject,
} from '../../src/modules/projects/infrastructure/persistence/project.schema';
import {
  DatasetSchema,
  type IDataset,
} from '../../src/modules/datasets/infrastructure/persistence/dataset.schema';
import {
  DatasetRecordSchema,
  type IDatasetRecord,
} from '../../src/modules/datasets/infrastructure/persistence/dataset-record.schema';
import { STORAGE_PORT, type StoragePort } from '../../src/shared/application/ports/storage.port';
import { WORKSPACE_ACCESS_PORT, type WorkspaceAccessPort } from '../../src/modules/workspaces';
import { PROJECT_REPOSITORY_PORT } from '../../src/modules/projects/domain/ports/project.repository.port';
import { DATASET_REPOSITORY_PORT } from '../../src/modules/datasets/domain/ports/dataset.repository.port';
import { detectInfra, openTestConnection } from '../helpers/test-infra';

describe('B2.3 — cascade xóa Workspace → Project → Dataset → Records', () => {
  let conn: Connection;
  let workspaceModel: Model<IWorkspace>;
  let projectModel: Model<IProject>;
  let datasetModel: Model<IDataset>;
  let recordModel: Model<IDatasetRecord>;
  let workspaces: WorkspacesRepository;
  let datasets: DatasetsRepository;
  let cascadeProjects: CascadeWorkspaceProjectsHandler;
  let cascadeDatasets: CascadeProjectDatasetsHandler;
  let storage: StoragePort;
  let workspaceAccess: WorkspaceAccessPort;

  const ownerId = new Types.ObjectId();

  beforeAll(async () => {
    const infra = await detectInfra();
    if (!infra.mongo || !infra.mongoIsReplicaSet) {
      throw new Error(
        '[B2.3] Thiếu hạ tầng test: MongoDB replica set chưa sẵn sàng. ' +
          'Chạy `pnpm run test:infra:up` trước khi chạy test tích hợp.',
      );
    }

    conn = await openTestConnection();
    workspaceModel = conn.model('Workspace', WorkspaceSchema) as unknown as Model<IWorkspace>;
    projectModel = conn.model('Project', ProjectSchema) as unknown as Model<IProject>;
    datasetModel = conn.model('Dataset', DatasetSchema) as unknown as Model<IDataset>;
    recordModel = conn.model(
      'DatasetRecord',
      DatasetRecordSchema,
    ) as unknown as Model<IDatasetRecord>;

    const deletedKeys: string[] = [];
    storage = {
      deleteFile: jest.fn(async (key: string) => {
        deletedKeys.push(key);
        return true;
      }),
    } as unknown as StoragePort;

    workspaceAccess = {
      incrementStorageUsed: jest.fn(async () => undefined),
    } as unknown as WorkspaceAccessPort;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: getConnectionToken(), useValue: conn },
        { provide: 'WorkspaceModel', useValue: workspaceModel },
        { provide: 'ProjectModel', useValue: projectModel },
        { provide: 'DatasetModel', useValue: datasetModel },
        { provide: 'DatasetRecordModel', useValue: recordModel },
        { provide: STORAGE_PORT, useValue: storage },
        { provide: WORKSPACE_ACCESS_PORT, useValue: workspaceAccess },
        WorkspacesRepository,
        ProjectsRepository,
        DatasetsRepository,
        { provide: PROJECT_REPOSITORY_PORT, useExisting: ProjectsRepository },
        { provide: DATASET_REPOSITORY_PORT, useExisting: DatasetsRepository },
        CascadeWorkspaceProjectsHandler,
        CascadeProjectDatasetsHandler,
      ],
    }).compile();

    workspaces = module.get(WorkspacesRepository);
    datasets = module.get(DatasetsRepository);
    cascadeProjects = module.get(CascadeWorkspaceProjectsHandler);
    cascadeDatasets = module.get(CascadeProjectDatasetsHandler);
  }, 30000);

  afterAll(async () => {
    if (conn) await conn.close().catch(() => undefined);
  });

  beforeEach(async () => {
    await workspaceModel.deleteMany({});
    await projectModel.deleteMany({});
    await datasetModel.deleteMany({});
    await recordModel.deleteMany({});
  });

  /** Tạo workspace + 2 project + 1 dataset (có 3 bản ghi) cho mỗi test. */
  async function seed(): Promise<{
    workspaceId: Types.ObjectId;
    projectId: Types.ObjectId;
    datasetId: Types.ObjectId;
  }> {
    const workspaceId = new Types.ObjectId();
    const projectId = new Types.ObjectId();
    const datasetId = new Types.ObjectId();

    await workspaceModel.create({
      _id: workspaceId,
      name: 'WS cascade',
      owner_id: ownerId,
      members: [],
      storage_used_bytes: 1500,
      last_accessed_at: null,
      deleted_at: null,
      version: 1,
    });
    await projectModel.create({
      _id: projectId,
      workspace_id: workspaceId,
      name: 'PRJ cascade',
      has_dataset: true,
      status: 'in_progress',
      members: [],
      last_accessed_at: null,
      created_by: ownerId,
      deleted_at: null,
      version: 1,
    });
    await datasetModel.create({
      _id: datasetId,
      project_id: projectId,
      workspace_id: workspaceId,
      name: 'ds cascade',
      original_file_name: 'ds.csv',
      file_format: 'csv',
      file_size_bytes: 1000,
      file_checksum: 'sha256:y',
      storage_key: `raw_files/${datasetId.toHexString()}.csv`,
      row_count: 3,
      column_count: 1,
      columns: [],
      column_issues: [],
      findings: [],
      has_header: true,
      delimiter: ',',
      current_version: 1,
      status: 'READY',
      deleted_at: null,
    });
    await recordModel.create([
      { dataset_id: datasetId, row_index: 0, props: { c0: 'a' } },
      { dataset_id: datasetId, row_index: 1, props: { c0: 'b' } },
      { dataset_id: datasetId, row_index: 2, props: { c0: 'c' } },
    ]);

    return { workspaceId, projectId, datasetId };
  }

  it('xóa workspace ⇒ project bên trong cũng bị đánh dấu xóa', async () => {
    const { workspaceId } = await seed();

    const deletedProjects = await cascadeProjects.execute(workspaceId.toHexString());
    expect(deletedProjects).toBe(1);

    const prj = await projectModel.findById(workspaceId).lean();
    expect(prj).toBeNull();
    const projectsAlive = await projectModel.countDocuments({
      workspace_id: workspaceId,
      deleted_at: null,
    });
    expect(projectsAlive).toBe(0);
  });

  it('xóa project ⇒ dataset của project bị đánh dấu xóa + bản ghi bị xóa cứng', async () => {
    const { projectId, datasetId } = await seed();

    const freed = await cascadeDatasets.execute(projectId.toHexString());
    expect(freed).toBe(1000);

    const ds = await datasetModel.findById(datasetId).lean();
    expect(ds?.deleted_at).not.toBeNull();

    const records = await recordModel.countDocuments({ dataset_id: datasetId });
    expect(records).toBe(0);
  });

  it('cascade xóa dataset gọi xóa file trên storage', async () => {
    const { projectId, datasetId } = await seed();
    await cascadeDatasets.execute(projectId.toHexString());
    expect(storage.deleteFile).toHaveBeenCalledWith(
      `raw_files/${datasetId.toHexString()}.csv`,
    );
  });

  it('IDEMPOTENT: chạy cascade lần 2 không xóa gì thêm và không trừ trùng dung lượng', async () => {
    const { workspaceId, projectId } = await seed();

    const firstProjects = await cascadeProjects.execute(workspaceId.toHexString());
    expect(firstProjects).toBe(1);

    const secondProjects = await cascadeProjects.execute(workspaceId.toHexString());
    expect(secondProjects).toBe(0); // không còn project sống

    const firstDatasets = await cascadeDatasets.execute(
      projectId.toHexString(),
      workspaceId.toHexString(),
    );
    expect(firstDatasets).toBe(1000);

    const secondDatasets = await cascadeDatasets.execute(
      projectId.toHexString(),
      workspaceId.toHexString(),
    );
    expect(secondDatasets).toBe(0); // không còn dataset sống ⇒ không trừ trùng

    // `incrementStorageUsed` chỉ được gọi đúng 1 lần (cho lần xóa thật).
    const incMock = workspaceAccess.incrementStorageUsed as unknown as jest.Mock;
    expect(incMock).toHaveBeenCalledTimes(1);
    expect(incMock).toHaveBeenCalledWith(workspaceId.toHexString(), -1000);
  });

  it('handleEvent(PROJECT_DELETED) truyền workspace_id ⇒ trừ storage_used', async () => {
    const { projectId, workspaceId } = await seed();

    // Đường production: event `PROJECT_DELETED` mang `workspace_id` trong payload.
    const freed = await cascadeDatasets.handleEvent('PROJECT_DELETED', {
      project_id: projectId.toHexString(),
      workspace_id: workspaceId.toHexString(),
    });
    expect(freed).toBe(1000);

    const incMock = workspaceAccess.incrementStorageUsed as unknown as jest.Mock;
    expect(incMock).toHaveBeenCalledWith(workspaceId.toHexString(), -1000);
  });

  it('soft-delete dataset trực tiếp cũng xóa bản ghi', async () => {
    const { datasetId } = await seed();
    const ok = await datasets.softDeleteDatasetWithRecords(datasetId.toHexString());
    expect(ok).toBe(true);
    const records = await recordModel.countDocuments({ dataset_id: datasetId });
    expect(records).toBe(0);
  });

  it('workspace soft-delete ⇒ storage_used không tự động đổi (cần cascade)', async () => {
    const { workspaceId } = await seed();
    await workspaces.softDelete(workspaceId.toHexString());
    const ws = await workspaceModel.findById(workspaceId).lean();
    expect(ws?.deleted_at).not.toBeNull();
    // Dung lượng chỉ được giải phóng khi cascade dataset chạy (module datasets).
    expect(ws?.storage_used_bytes).toBe(1500);
  });
});
