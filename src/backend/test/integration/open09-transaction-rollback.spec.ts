/**
 * B2.2 — Test tích hợp OPEN-09: **rollback thật** trên MongoDB replica set.
 *
 * ── Vì sao cần test tích hợp? ─────────────────────────────────────────────
 * Unit test dùng `fakeTransaction()` (noop) nên **không** chứng minh được
 * rằng MongoDB thật sự rollback khi ghi outbox thất bại. Test này chạy trên
 * MongoDB replica set thật (`rs0`) để chứng minh:
 *
 *   1. Khi ghi outbox **thất bại** ⇒ thao tác ghi chính (soft-delete project,
 *      cập nhật dataset, điều chỉnh storage) bị **rollback hoàn toàn**.
 *   2. Khi ghi outbox **thành công** ⇒ mọi thay đổi được **commit đồng thời**.
 *   3. Không bao giờ tồn tại trạng thái "đã xoá nhưng event không được ghi".
 *
 * Yêu cầu hạ tầng:
 * ```bash
 * pnpm run test:infra:up   # mongo:7 rs0 @27018
 * ```
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { MongooseTransactionService } from '../../src/shared/infrastructure/database/mongoose-transaction.service';
import { OutboxService } from '../../src/shared/infrastructure/outbox/outbox.service';
import type { OutboxEventInput } from '../../src/shared/application/ports/outbox.port';
import { OutboxEventSchema, type IOutboxEvent } from '../../src/shared/infrastructure/outbox/outbox-event.schema';
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
import { DatasetsRepository } from '../../src/modules/datasets/infrastructure/persistence/datasets.repository';
import { WorkspacesRepository } from '../../src/modules/workspaces/infrastructure/persistence/workspaces.repository';
import { ProjectsRepository } from '../../src/modules/projects/infrastructure/persistence/projects.repository';
import {
  TEST_MONGO_URI,
  TEST_DB_NAME,
  detectInfra,
  openTestConnection,
} from '../helpers/test-infra';

/**
 * Outbox "giả" — luôn ném lỗi để mô phỏng sự cố ghi event.
 *
 * Điểm mấu chốt: `OutboxService.recordEvent` gọi `event.save({ session: s })`.
 * Khi hàm này ném lỗi **trước** khi save, transaction sẽ rollback.
 */
class FailingOutboxService {
  constructor(private readonly inner: OutboxService) {}

  async recordEvent(_data?: OutboxEventInput): Promise<never> {
    // Cố tình ném lỗi TRƯỚC khi ghi ⇒ transaction phải rollback.
    void this.inner;
    throw new Error('OUTBOX_DOWN: giả lỗi ghi event để chứng minh rollback');
  }
}

describe('B2.2 — OPEN-09: rollback THẬT trên MongoDB replica set', () => {
  let conn: Connection;
  let tx: MongooseTransactionService;
  let outbox: OutboxService;
  let failingOutbox: FailingOutboxService;
  let workspaceModel: Model<IWorkspace>;
  let projectModel: Model<IProject>;
  let datasetModel: Model<IDataset>;
  let recordModel: Model<IDatasetRecord>;
  let outboxModel: Model<IOutboxEvent>;
  let workspaces: WorkspacesRepository;
  let projects: ProjectsRepository;
  let datasets: DatasetsRepository;

  let infra: Awaited<ReturnType<typeof detectInfra>>;
  const ready = (): boolean => infra.mongo && infra.mongoIsReplicaSet;

  beforeAll(async () => {
    infra = await detectInfra();
    if (!ready()) {
      // Test tích hợp được chạy **tường minh** (`pnpm run test:integration`) ⇒
      // thiếu hạ tầng là lỗi cấu hình, không phải lý do để bỏ qua âm thầm.
      throw new Error(
        '[B2.2] Thiếu hạ tầng test: MongoDB replica set chưa sẵn sàng. ' +
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
    outboxModel = conn.model('OutboxEvent', OutboxEventSchema) as unknown as Model<IOutboxEvent>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: getConnectionToken(), useValue: conn },
        MongooseTransactionService,
        OutboxService,
        {
          provide: 'WorkspaceModel',
          useValue: workspaceModel,
        },
        {
          provide: 'ProjectModel',
          useValue: projectModel,
        },
        {
          provide: 'DatasetModel',
          useValue: datasetModel,
        },
        {
          provide: 'DatasetRecordModel',
          useValue: recordModel,
        },
        {
          provide: 'OutboxEventModel',
          useValue: outboxModel,
        },
        WorkspacesRepository,
        ProjectsRepository,
        DatasetsRepository,
      ],
    }).compile();

    tx = module.get(MongooseTransactionService);
    outbox = module.get(OutboxService);
    failingOutbox = new FailingOutboxService(outbox);

    workspaces = module.get(WorkspacesRepository);
    projects = module.get(ProjectsRepository);
    datasets = module.get(DatasetsRepository);
  }, 30000);

  afterAll(async () => {
    if (conn) await conn.close().catch(() => undefined);
  });

  beforeEach(async () => {
    await workspaceModel.deleteMany({});
    await projectModel.deleteMany({});
    await datasetModel.deleteMany({});
    await recordModel.deleteMany({});
    await outboxModel.deleteMany({});
  });

  // ───────────────────────────────────────────────────────────────────────────

  it('ghi event thất bại ⇒ soft-delete project bị ROLLBACK (không còn "đã xoá mà mất event")', async () => {
    const ownerId = new Types.ObjectId();
    const workspaceId = new Types.ObjectId();
    const projectId = new Types.ObjectId();

    await workspaceModel.create({
      _id: workspaceId,
      name: 'WS rollback',
      owner_id: ownerId,
      members: [],
      storage_used_bytes: 0,
      last_accessed_at: null,
      deleted_at: null,
      version: 1,
    });
    await projectModel.create({
      _id: projectId,
      workspace_id: workspaceId,
      name: 'PRJ rollback',
      has_dataset: false,
      status: 'in_progress',
      members: [],
      last_accessed_at: null,
      created_by: ownerId,
      deleted_at: null,
      version: 1,
    });

    // Transaction: xoá mềm project + ghi event (ghi event SẼ ném lỗi).
    await expect(
      tx.runInTransaction(async () => {
        const ok = await projects.softDelete(projectId.toHexString());
        expect(ok).toBe(true);
        await failingOutbox.recordEvent({
          aggregate_type: 'PROJECT',
          aggregate_id: projectId.toHexString(),
          event_type: 'PROJECT_DELETED',
          payload: { project_id: projectId.toHexString() },
        });
      }),
    ).rejects.toThrow(/OUTBOX_DOWN/);

    // ⇒ Project PHẢI còn nguyên (rollback thành công).
    const after = await projectModel.findById(projectId).lean();
    expect(after).not.toBeNull();
    expect(after?.deleted_at).toBeNull();

    // ⇒ Không có event nào được ghi.
    const events = await outboxModel.countDocuments({ aggregate_id: projectId.toHexString() });
    expect(events).toBe(0);
  });

  it('ghi event thành công ⇒ mọi thay đổi được COMMIT đồng thời', async () => {
    const ownerId = new Types.ObjectId();
    const workspaceId = new Types.ObjectId();
    const projectId = new Types.ObjectId();

    await workspaceModel.create({
      _id: workspaceId,
      name: 'WS commit',
      owner_id: ownerId,
      members: [],
      storage_used_bytes: 0,
      last_accessed_at: null,
      deleted_at: null,
      version: 1,
    });
    await projectModel.create({
      _id: projectId,
      workspace_id: workspaceId,
      name: 'PRJ commit',
      has_dataset: false,
      status: 'in_progress',
      members: [],
      last_accessed_at: null,
      created_by: ownerId,
      deleted_at: null,
      version: 1,
    });

    await tx.runInTransaction(async () => {
      await projects.softDelete(projectId.toHexString());
      await outbox.recordEvent({
        aggregate_type: 'PROJECT',
        aggregate_id: projectId.toHexString(),
        event_type: 'PROJECT_DELETED',
        payload: { project_id: projectId.toHexString() },
      });
    });

    const after = await projectModel.findById(projectId).lean();
    expect(after?.deleted_at).not.toBeNull();

    const events = await outboxModel.countDocuments({ aggregate_id: projectId.toHexString() });
    expect(events).toBe(1);
  });

  it('lỗi ở bước GIỮA ⇒ mọi thay đổi trước đó cũng rollback (tính nguyên tử)', async () => {
    const ownerId = new Types.ObjectId();
    const workspaceId = new Types.ObjectId();
    const projectId = new Types.ObjectId();

    await workspaceModel.create({
      _id: workspaceId,
      name: 'WS midway',
      owner_id: ownerId,
      members: [],
      storage_used_bytes: 100,
      last_accessed_at: null,
      deleted_at: null,
      version: 1,
    });
    await projectModel.create({
      _id: projectId,
      workspace_id: workspaceId,
      name: 'PRJ midway',
      has_dataset: false,
      status: 'in_progress',
      members: [],
      last_accessed_at: null,
      created_by: ownerId,
      deleted_at: null,
      version: 1,
    });

    await expect(
      tx.runInTransaction(async () => {
        // Bước 1: ghi workspace (sẽ bị rollback).
        await workspaces.addStorageUsed(workspaceId.toHexString(), 500);
        // Bước 2: ghi project (sẽ bị rollback).
        await projects.softDelete(projectId.toHexString());
        // Bước 3: lỗi → rollback toàn bộ.
        throw new Error('BOOM');
      }),
    ).rejects.toThrow(/BOOM/);

    const ws = await workspaceModel.findById(workspaceId).lean();
    expect(ws?.storage_used_bytes).toBe(100); // không phải 600

    const prj = await projectModel.findById(projectId).lean();
    expect(prj?.deleted_at).toBeNull();
  });

  it('ghi bản ghi dataset (ngoài transaction) + rollback metadata ⇒ bản ghi vẫn còn, dataset vẫn INGESTING', async () => {
    const ownerId = new Types.ObjectId();
    const workspaceId = new Types.ObjectId();
    const projectId = new Types.ObjectId();
    const datasetId = new Types.ObjectId();

    await workspaceModel.create({
      _id: workspaceId,
      name: 'WS dataset',
      owner_id: ownerId,
      members: [],
      storage_used_bytes: 0,
      last_accessed_at: null,
      deleted_at: null,
      version: 1,
    });
    await projectModel.create({
      _id: projectId,
      workspace_id: workspaceId,
      name: 'PRJ dataset',
      has_dataset: false,
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
      name: 'ds',
      original_file_name: 'ds.csv',
      file_format: 'csv',
      file_size_bytes: 0,
      file_checksum: 'sha256:x',
      storage_key: 'k',
      row_count: 0,
      column_count: 0,
      columns: [],
      column_issues: [],
      findings: [],
      has_header: true,
      delimiter: ',',
      current_version: 1,
      status: 'INGESTING',
      deleted_at: null,
    });

    // Đoạn A: ghi bản ghi NGOÀI transaction.
    await datasets.bulkInsertRecords([
      { datasetId: datasetId.toHexString(), rowIndex: 0, props: { c0: 'a' } },
      { datasetId: datasetId.toHexString(), rowIndex: 1, props: { c0: 'b' } },
    ]);

    // Đoạn B: transaction thất bại ⇒ metadata rollback.
    await expect(
      tx.runInTransaction(async () => {
        await datasets.updateById(datasetId.toHexString(), { status: 'READY', rowCount: 2 });
        await projects.setHasDataset(projectId.toHexString(), true);
        await failingOutbox.recordEvent({
          aggregate_type: 'DATASET',
          aggregate_id: datasetId.toHexString(),
          event_type: 'DATASET_INGESTED',
          payload: {},
        });
      }),
    ).rejects.toThrow(/OUTBOX_DOWN/);

    // Dataset PHẢI quay về INGESTING.
    const ds = await datasetModel.findById(datasetId).lean();
    expect(ds?.status).toBe('INGESTING');

    // Project PHẢI giữ has_dataset = false.
    const prj = await projectModel.findById(projectId).lean();
    expect(prj?.has_dataset).toBe(false);

    // Bản ghi vẫn còn (ghi ngoài transaction) ⇒ phải được cleanup tay.
    const records = await recordModel.countDocuments({ dataset_id: datasetId });
    expect(records).toBe(2);

    // Cleanup tay (đúng như `cleanupOnFailure` trong handler).
    await datasets.deleteRecordsByDataset(datasetId.toHexString());
    const afterCleanup = await recordModel.countDocuments({ dataset_id: datasetId });
    expect(afterCleanup).toBe(0);
  });
});

describe('B2.2 — cấu hình hạ tầng', () => {
  it('TEST_MONGO_URI trỏ tới replica set rs0', () => {
    expect(TEST_MONGO_URI).toContain('27018');
    expect(TEST_DB_NAME).toContain('test');
  });
});
