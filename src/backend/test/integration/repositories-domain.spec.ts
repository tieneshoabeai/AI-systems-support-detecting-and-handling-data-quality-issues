/**
 * B2.4 — Test tích hợp Mongoose repository (nhóm 2): Projects, Datasets, Feedback.
 *
 * Bổ sung cho `repositories.spec.ts` (nhóm 1: Users / Workspaces / Notifications / Issues).
 *
 * Yêu cầu hạ tầng:
 * ```bash
 * pnpm run test:infra:up   # mongo replica set rs0 @27018
 * ```
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
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
import {
  FindingFeedbackSchema,
  type IFindingFeedback,
} from '../../src/modules/feedback/finding-feedback.schema';
import { ProjectsRepository } from '../../src/modules/projects/infrastructure/persistence/projects.repository';
import { DatasetsRepository } from '../../src/modules/datasets/infrastructure/persistence/datasets.repository';
import { FeedbackRepository } from '../../src/modules/feedback/feedback.repository';
import { parseListCursor } from '../../src/shared/domain/pagination/keyset-cursor';
import { detectInfra, openTestConnection } from '../helpers/test-infra';

describe('B2.4 — Mongoose repository trên MongoDB thật (nhóm 2)', () => {
  let conn: Connection;
  let projectModel: Model<IProject>;
  let datasetModel: Model<IDataset>;
  let recordModel: Model<IDatasetRecord>;
  let feedbackModel: Model<IFindingFeedback>;

  let projects: ProjectsRepository;
  let datasets: DatasetsRepository;
  let feedback: FeedbackRepository;

  const oid = (): string => new Types.ObjectId().toHexString();

  beforeAll(async () => {
    const infra = await detectInfra();
    if (!infra.mongo) {
      throw new Error(
        '[B2.4] Thiếu hạ tầng test: MongoDB chưa sẵn sàng. Chạy `pnpm run test:infra:up` trước.',
      );
    }
    conn = await openTestConnection();

    projectModel = conn.model('Project', ProjectSchema) as unknown as Model<IProject>;
    datasetModel = conn.model('Dataset', DatasetSchema) as unknown as Model<IDataset>;
    recordModel = conn.model(
      'DatasetRecord',
      DatasetRecordSchema,
    ) as unknown as Model<IDatasetRecord>;
    feedbackModel = conn.model(
      'FindingFeedback',
      FindingFeedbackSchema,
    ) as unknown as Model<IFindingFeedback>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: getConnectionToken(), useValue: conn },
        { provide: 'ProjectModel', useValue: projectModel },
        { provide: 'DatasetModel', useValue: datasetModel },
        { provide: 'DatasetRecordModel', useValue: recordModel },
        { provide: 'FindingFeedbackModel', useValue: feedbackModel },
        ProjectsRepository,
        DatasetsRepository,
        FeedbackRepository,
      ],
    }).compile();

    await Promise.all([
      projectModel.syncIndexes(),
      datasetModel.syncIndexes(),
      recordModel.syncIndexes(),
      feedbackModel.syncIndexes(),
    ]);

    projects = module.get(ProjectsRepository);
    datasets = module.get(DatasetsRepository);
    feedback = module.get(FeedbackRepository);
  }, 30000);

  afterAll(async () => {
    if (conn) await conn.close().catch(() => undefined);
  });

  beforeEach(async () => {
    await projectModel.deleteMany({});
    await datasetModel.deleteMany({});
    await recordModel.deleteMany({});
    await feedbackModel.deleteMany({});
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PROJECTS
  // ───────────────────────────────────────────────────────────────────────────

  describe('ProjectsRepository', () => {
    const makeProject = async (
      workspaceId: string,
      name: string,
      createdBy: string,
    ): Promise<{ id: string; version: number }> => {
      const p = await projects.create({
        workspaceId,
        name,
        description: '',
        createdBy,
      });
      return { id: p.id, version: p.version };
    };

    it('create ⇒ owner tự động là member role=owner, status=not_started', async () => {
      const workspaceId = oid();
      const userId = oid();
      const p = await projects.create({
        workspaceId,
        name: '  Dự án A  ',
        description: 'mô tả',
        createdBy: userId,
      });

      expect(p.name).toBe('Dự án A');
      expect(p.status).toBe('not_started');
      expect(p.hasDataset).toBe(false);
      expect(p.members).toHaveLength(1);
      expect(p.members[0]?.role).toBe('owner');
    });

    it('findOneByWorkspaceAndName ⇒ tìm đúng project trong workspace', async () => {
      const workspaceId = oid();
      const userId = oid();
      await makeProject(workspaceId, 'Trùng tên', userId);

      const found = await projects.findOneByWorkspaceAndName(workspaceId, '  Trùng tên  ');
      expect(found?.name).toBe('Trùng tên');
      expect(await projects.findOneByWorkspaceAndName(oid(), 'Trùng tên')).toBeNull();
      expect(await projects.findOneByWorkspaceAndName('khong-hop-le', 'Trùng tên')).toBeNull();
    });

    it('softDelete ⇒ project ẩn, findAliveIdsByWorkspace bỏ qua nó', async () => {
      const workspaceId = oid();
      const userId = oid();
      const p = await makeProject(workspaceId, 'Sẽ xoá', userId);
      const keep = await makeProject(workspaceId, 'Giữ lại', userId);

      expect(await projects.softDelete(p.id)).toBe(true);
      expect(await projects.findById(p.id)).toBeNull();

      const alive = await projects.findAliveIdsByWorkspace(workspaceId);
      expect(alive).toEqual([keep.id]);
      expect(await projects.softDelete('khong-hop-le')).toBe(false);
    });

    it('softDeleteByWorkspace ⇒ xoá hàng loạt, idempotent', async () => {
      const workspaceId = oid();
      const userId = oid();
      await makeProject(workspaceId, 'P1', userId);
      await makeProject(workspaceId, 'P2', userId);

      expect(await projects.softDeleteByWorkspace(workspaceId)).toBe(2);
      expect(await projects.softDeleteByWorkspace(workspaceId)).toBe(0);
      expect(await projects.softDeleteByWorkspace('khong-hop-le')).toBe(0);
    });

    it('updateById với expectedVersion ⇒ optimistic lock', async () => {
      const workspaceId = oid();
      const userId = oid();
      const p = await makeProject(workspaceId, 'Tên cũ', userId);

      const ok = await projects.updateById(p.id, { name: 'Tên mới' }, p.version);
      expect(ok?.name).toBe('Tên mới');

      const stale = await projects.updateById(p.id, { name: 'Tên cũ' }, p.version);
      expect(stale).toBeNull();
      expect(await projects.updateById('khong-hop-le', { name: 'x' })).toBeNull();
    });

    it('setHasDataset / setStatus / touchLastAccessed', async () => {
      const workspaceId = oid();
      const userId = oid();
      const p = await makeProject(workspaceId, 'Trạng thái', userId);

      expect(await projects.setHasDataset(p.id, true)).toBe(true);
      expect((await projects.findById(p.id))?.hasDataset).toBe(true);

      expect(await projects.setStatus(p.id, 'in_progress')).toBe(true);
      expect((await projects.findById(p.id))?.status).toBe('in_progress');

      await projects.touchLastAccessed(p.id);
      expect((await projects.findById(p.id))?.lastAccessedAt).not.toBeNull();

      expect(await projects.setHasDataset('khong-hop-le', true)).toBe(false);
      expect(await projects.setStatus('khong-hop-le', 'completed')).toBe(false);
    });

    it('markCompleted chỉ khi status=in_progress + version khớp', async () => {
      const workspaceId = oid();
      const userId = oid();
      const p = await makeProject(workspaceId, 'Hoàn thành', userId);

      // status đang là not_started ⇒ không mark được (trả null vì project tồn tại).
      expect(await projects.markCompleted(p.id, p.version)).toBeNull();

      await projects.setStatus(p.id, 'in_progress');
      const fresh = await projects.findById(p.id);
      expect(await projects.markCompleted(p.id, fresh?.version ?? 1)).toBe(true);
      expect((await projects.findById(p.id))?.status).toBe('completed');

      // version cũ ⇒ null.
      expect(await projects.markCompleted(p.id, fresh?.version ?? 1)).toBeNull();
    });

    it('thành viên: addMember / removeMember / updateMemberRole', async () => {
      const workspaceId = oid();
      const userId = oid();
      const memberId = oid();
      const p = await makeProject(workspaceId, 'Thành viên', userId);

      expect(await projects.addMember(p.id, { userId: memberId, role: 'viewer' })).toBe(true);
      const withMember = await projects.findById(p.id);
      expect(withMember?.members).toHaveLength(2);

      expect(await projects.updateMemberRole(p.id, memberId, 'member')).toBe(true);
      expect(await projects.removeMember(p.id, memberId)).toBe(true);
      expect((await projects.findById(p.id))?.members).toHaveLength(1);

      expect(await projects.addMember('khong-hop-le', { userId: memberId, role: 'member' })).toBe(
        false,
      );
      expect(await projects.removeMember(p.id, 'khong-hop-le')).toBe(false);
    });

    it('updateMemberRole với expectedVersion lệch ⇒ null', async () => {
      const workspaceId = oid();
      const userId = oid();
      const memberId = oid();
      const p = await makeProject(workspaceId, 'Role lock', userId);
      await projects.addMember(p.id, { userId: memberId, role: 'viewer' });

      expect(await projects.updateMemberRole(p.id, memberId, 'owner', p.version + 99)).toBeNull();
    });

    it('transferOwner ⇒ chuyển quyền owner sang thành viên', async () => {
      const workspaceId = oid();
      const ownerId = oid();
      const newOwnerId = oid();
      const p = await makeProject(workspaceId, 'Chuyển owner', ownerId);
      await projects.addMember(p.id, { userId: newOwnerId, role: 'member' });

      const result = await projects.transferOwner(p.id, newOwnerId);
      expect(result).toBe(true);

      const after = await projects.findById(p.id);
      expect(after?.members.find((m) => m.userId === newOwnerId)?.role).toBe('owner');
      expect(after?.members.find((m) => m.userId === ownerId)?.role).toBe('member');
    });

    it('transferOwner với id không hợp lệ ⇒ false', async () => {
      const workspaceId = oid();
      const ownerId = oid();
      const p = await makeProject(workspaceId, 'Owner', ownerId);

      expect(await projects.transferOwner('khong-hop-le', ownerId)).toBe(false);
      expect(await projects.transferOwner(p.id, 'khong-hop-le')).toBe(false);
    });

    it('đếm & lọc: countByWorkspace / countByUser / findAllByUser', async () => {
      const workspaceId = oid();
      const userA = oid();
      const userB = oid();
      await makeProject(workspaceId, 'A1', userA);
      await makeProject(workspaceId, 'A2', userA);
      await makeProject(workspaceId, 'B1', userB);

      expect(await projects.countByWorkspace(workspaceId)).toBe(3);
      expect(await projects.countByWorkspace(workspaceId, 'not_started')).toBe(3);
      expect(await projects.countByWorkspace(workspaceId, 'completed')).toBe(0);
      expect(await projects.countByWorkspace('khong-hop-le')).toBe(0);

      expect(await projects.countByUser(userA)).toBe(2);
      expect(await projects.countByUser('khong-hop-le')).toBe(0);

      expect(await projects.findAllByUser(userA)).toHaveLength(2);
      expect(await projects.findAllByUser('khong-hop-le')).toEqual([]);
    });

    it('findByWorkspacePaged ⇒ lọc search + phân trang keyset', async () => {
      const workspaceId = oid();
      const userId = oid();
      await makeProject(workspaceId, 'Alpha', userId);
      await makeProject(workspaceId, 'Beta', userId);
      await makeProject(workspaceId, 'Gamma', userId);

      const page1 = await projects.findByWorkspacePaged(workspaceId, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const cursor = parseListCursor(page1.nextCursor ?? undefined, 'last_accessed');
      const page2 = await projects.findByWorkspacePaged(workspaceId, { limit: 2, cursor });
      expect(page2.items).toHaveLength(1);
      expect(page2.hasMore).toBe(false);

      const searched = await projects.findByWorkspacePaged(workspaceId, { search: 'alp' });
      expect(searched.items).toHaveLength(1);

      const empty = await projects.findByWorkspacePaged('khong-hop-le', {});
      expect(empty.items).toEqual([]);
      expect(empty.hasMore).toBe(false);
    });

    it('findAllPaged: admin xem tất cả, user thường chỉ thấy workspace của mình', async () => {
      const wsA = oid();
      const wsB = oid();
      const userId = oid();
      await makeProject(wsA, 'Trong A', userId);
      await makeProject(wsB, 'Trong B', userId);

      // User thường: thấy project do mình tạo (`created_by`) HOẶC thuộc workspace được cấp quyền.
      const asUser = await projects.findAllPaged(userId, [wsA], { limit: 20 });
      expect(asUser.items).toHaveLength(2);

      const asAdmin = await projects.findAllPaged(userId, [wsA], { limit: 20 }, true);
      expect(asAdmin.items).toHaveLength(2);

      // Workspace đã bị xoá ⇒ project bị loại khỏi danh sách.
      const excluded = await projects.findAllPaged(userId, [wsA, wsB], { limit: 20 }, true, [wsB]);
      expect(excluded.items).toHaveLength(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DATASETS
  // ───────────────────────────────────────────────────────────────────────────

  describe('DatasetsRepository', () => {
    const makeDataset = async (
      projectId: string,
      workspaceId: string,
      status: 'INGESTING' | 'READY' | 'FAILED' = 'INGESTING',
    ): Promise<string> => {
      const ds = await datasets.create({
        id: oid(),
        projectId,
        workspaceId,
        name: 'ds.csv',
        originalFileName: 'ds.csv',
        fileFormat: 'csv',
        fileSizeBytes: 1000,
        fileChecksum: 'sha256:abc',
        storageKey: `datasets/${projectId}/ds.csv`,
        rowCount: 0,
        columnCount: 0,
        columns: [],
        columnIssues: [],
        hasHeader: true,
        delimiter: ',',
        currentVersion: 1,
        status,
      });
      return ds.id;
    };

    it('create → findById trả entity đúng', async () => {
      const projectId = oid();
      const workspaceId = oid();
      const id = await makeDataset(projectId, workspaceId);

      const found = await datasets.findById(id);
      expect(found?.name).toBe('ds.csv');
      expect(found?.status).toBe('INGESTING');
      expect(found?.rowCount).toBe(0);
      expect(await datasets.findById('khong-hop-le')).toBeNull();
    });

    it('findByProject trả dataset mới nhất', async () => {
      const projectId = oid();
      const workspaceId = oid();
      await makeDataset(projectId, workspaceId);
      await makeDataset(projectId, workspaceId);

      const found = await datasets.findByProject(projectId);
      expect(found).not.toBeNull();
      expect(await datasets.findByProject('khong-hop-le')).toBeNull();
    });

    it('updateById CHỈ chạy được khi status=INGESTING (bất biến dữ liệu)', async () => {
      const projectId = oid();
      const workspaceId = oid();
      const ingesting = await makeDataset(projectId, workspaceId, 'INGESTING');
      const ready = await makeDataset(projectId, workspaceId, 'READY');

      const updated = await datasets.updateById(ingesting, { rowCount: 10, columnCount: 2 });
      expect(updated?.rowCount).toBe(10);

      // Dataset READY là bản chụp bất biến ⇒ không sửa được.
      expect(await datasets.updateById(ready, { rowCount: 99 })).toBeNull();
      expect(await datasets.updateById('khong-hop-le', { rowCount: 1 })).toBeNull();
    });

    it('bulkInsertRecords + deleteRecordsByDataset', async () => {
      const projectId = oid();
      const workspaceId = oid();
      const id = await makeDataset(projectId, workspaceId);

      const inserted = await datasets.bulkInsertRecords([
        { datasetId: id, rowIndex: 0, props: { c0: 'a' } },
        { datasetId: id, rowIndex: 1, props: { c0: 'b' } },
      ]);
      expect(inserted).toBe(2);
      expect(await recordModel.countDocuments({ dataset_id: new Types.ObjectId(id) })).toBe(2);

      expect(await datasets.bulkInsertRecords([])).toBe(0);

      expect(await datasets.deleteRecordsByDataset(id)).toBe(2);
      expect(await datasets.deleteRecordsByDataset('khong-hop-le')).toBe(0);
    });

    it('softDeleteDatasetWithRecords ⇒ xoá cả dataset lẫn bản ghi', async () => {
      const projectId = oid();
      const workspaceId = oid();
      const id = await makeDataset(projectId, workspaceId);
      await datasets.bulkInsertRecords([{ datasetId: id, rowIndex: 0, props: { c0: 'a' } }]);

      expect(await datasets.softDeleteDatasetWithRecords(id)).toBe(true);
      expect(await datasets.findById(id)).toBeNull();
      expect(await recordModel.countDocuments({ dataset_id: new Types.ObjectId(id) })).toBe(0);

      // Chạy lại ⇒ idempotent.
      expect(await datasets.softDeleteDatasetWithRecords(id)).toBe(false);
      expect(await datasets.softDeleteDatasetWithRecords('khong-hop-le')).toBe(false);
    });

    it('softDeleteByProject ⇒ xoá hàng loạt + trả về dung lượng file', async () => {
      const projectId = oid();
      const workspaceId = oid();
      const d1 = await makeDataset(projectId, workspaceId);
      await makeDataset(projectId, workspaceId);
      await datasets.bulkInsertRecords([{ datasetId: d1, rowIndex: 0, props: { c0: 'a' } }]);

      const deleted = await datasets.softDeleteByProject(projectId);
      expect(deleted).toHaveLength(2);
      expect(deleted.reduce((sum, d) => sum + d.fileSizeBytes, 0)).toBe(2000);

      expect(await datasets.findById(d1)).toBeNull();
      expect(await recordModel.countDocuments({ dataset_id: new Types.ObjectId(d1) })).toBe(0);

      // Chạy lại ⇒ không còn dataset sống ⇒ trả mảng rỗng.
      expect(await datasets.softDeleteByProject(projectId)).toEqual([]);
      expect(await datasets.softDeleteByProject('khong-hop-le')).toEqual([]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // FEEDBACK
  // ───────────────────────────────────────────────────────────────────────────

  describe('FeedbackRepository', () => {
    const makeFeedback = async (
      overrides: Partial<{
        analysisRunId: string;
        projectId: string;
        workspaceId: string;
        findingId: string | null;
        authorId: string;
        label: string;
        reason: string | null;
        suggestedSeverity: string | null;
      }> = {},
    ): Promise<string> => {
      const fb = await feedback.create({
        analysisRunId: overrides.analysisRunId ?? oid(),
        projectId: overrides.projectId ?? oid(),
        workspaceId: overrides.workspaceId ?? oid(),
        findingId: overrides.findingId ?? null,
        authorId: overrides.authorId ?? oid(),
        label: overrides.label ?? 'correct',
        reason: overrides.reason ?? null,
        suggestedSeverity: overrides.suggestedSeverity ?? null,
        authorRoleAtTime: 'analyst',
      });
      return fb.id;
    };

    it('create → findByIdActive trả feedback đúng', async () => {
      const id = await makeFeedback({ label: 'false_positive', reason: 'Sai' });
      const found = await feedback.findByIdActive(id);
      expect(found?.label).toBe('false_positive');
      expect(found?.reason).toBe('Sai');
      expect(await feedback.findByIdActive('khong-hop-le')).toBeNull();
    });

    it('listByScope lọc theo analysisRunId + findingId + label', async () => {
      const runId = oid();
      const findingId = 'col-1';
      await makeFeedback({ analysisRunId: runId, findingId, label: 'correct' });
      await makeFeedback({ analysisRunId: runId, findingId, label: 'missed_issue' });
      await makeFeedback({ analysisRunId: runId, findingId: 'col-2', label: 'correct' });

      const all = await feedback.listByScope({
        analysisRunId: runId,
        findingId,
        limit: 20,
        sortOrder: 'desc',
      });
      expect(all).toHaveLength(2);

      const byLabel = await feedback.listByScope({
        analysisRunId: runId,
        findingId,
        limit: 20,
        label: 'correct',
        sortOrder: 'desc',
      });
      expect(byLabel).toHaveLength(1);

      expect(
        await feedback.listByScope({
          analysisRunId: 'khong-hop-le',
          findingId: null,
          limit: 20,
          sortOrder: 'desc',
        }),
      ).toEqual([]);
    });

    it('listActiveByRun trả feedback của 1 lần chạy phân tích', async () => {
      const runId = oid();
      await makeFeedback({ analysisRunId: runId });
      await makeFeedback({ analysisRunId: runId });
      expect(await feedback.listActiveByRun(runId)).toHaveLength(2);
      expect(await feedback.listActiveByRun('khong-hop-le')).toEqual([]);
    });

    it('updateById cập nhật label / reason / suggestedSeverity', async () => {
      const id = await makeFeedback({ label: 'correct' });

      const updated = await feedback.updateById(id, {
        label: 'false_positive',
        reason: 'Sai thật',
        suggestedSeverity: 'high',
      });
      expect(updated?.label).toBe('false_positive');
      expect(updated?.reason).toBe('Sai thật');
      expect(updated?.suggestedSeverity).toBe('high');

      expect(await feedback.updateById('khong-hop-le', { label: 'other' })).toBeNull();
    });

    it('softDelete ⇒ feedback bị ẩn', async () => {
      const id = await makeFeedback();
      expect(await feedback.softDelete(id)).toBe(true);
      expect(await feedback.findByIdActive(id)).toBeNull();
      expect(await feedback.softDelete('khong-hop-le')).toBe(false);
    });

    it('đếm: countByProject / countDistinctAuthors / countDistinctRuns', async () => {
      const projectId = oid();
      const workspaceId = oid();
      const runA = oid();
      const runB = oid();
      const authorA = oid();
      const authorB = oid();

      const findingId = 'col-1';
      await makeFeedback({
        projectId,
        workspaceId,
        findingId,
        analysisRunId: runA,
        authorId: authorA,
      });
      await makeFeedback({
        projectId,
        workspaceId,
        findingId,
        analysisRunId: runA,
        authorId: authorB,
      });
      await makeFeedback({
        projectId,
        workspaceId,
        findingId,
        analysisRunId: runB,
        authorId: authorA,
      });

      expect(await feedback.countByProject(projectId)).toBe(3);
      expect(await feedback.countByProject('khong-hop-le')).toBe(0);

      expect(
        await feedback.countDistinctAuthors({ workspaceId, findingId, label: 'correct' }),
      ).toBe(2);
      expect(await feedback.countDistinctRuns(projectId)).toBe(2);
    });

    it('aggregateByProject gom nhóm theo label', async () => {
      const projectId = oid();
      const workspaceId = oid();
      await makeFeedback({ projectId, workspaceId, label: 'correct' });
      await makeFeedback({ projectId, workspaceId, label: 'correct' });
      await makeFeedback({ projectId, workspaceId, label: 'missed_issue' });

      const rows = await feedback.aggregateByProject(projectId);
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.label === 'correct')?.count).toBe(2);
      expect(rows.find((r) => r.label === 'missed_issue')?.count).toBe(1);

      expect(await feedback.aggregateByProject('khong-hop-le')).toEqual([]);
    });
  });
});
