/**
 * B2.5 — Test tích hợp repository **ANALYSIS** (runs / results / AI jobs /
 * evidences / saves / report jobs / few-shot) trên MongoDB thật.
 *
 * Đây là repository phức tạp nhất của hệ thống: có **lease & heartbeat** cho
 * AI job, **claim** nguyên tử (findOneAndUpdate), **stale marking** và
 * **few-shot cap** — những thứ chỉ kiểm chứng được trên MongoDB thật.
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
  AnalysisRunSchema,
  type IAnalysisRun,
} from '../../src/modules/analysis/infrastructure/persistence/analysis-run.schema';
import {
  AnalysisResultSchema,
  type IAnalysisResult,
} from '../../src/modules/analysis/infrastructure/persistence/analysis-result.schema';
import {
  AiJobSchema,
  type IAiJob,
} from '../../src/modules/analysis/infrastructure/persistence/ai-job.schema';
import {
  CellEvidenceSchema,
  type ICellEvidence,
} from '../../src/modules/analysis/infrastructure/persistence/cell-evidence.schema';
import {
  ProjectSaveSchema,
  type IProjectSave,
} from '../../src/modules/analysis/infrastructure/persistence/project-save.schema';
import {
  ReportJobSchema,
  type IReportJob,
} from '../../src/modules/analysis/infrastructure/persistence/report-job.schema';
import {
  FewShotExampleSchema,
  type IFewShotExample,
} from '../../src/modules/analysis/infrastructure/persistence/few-shot-example.schema';
import { AnalysisRepository } from '../../src/modules/analysis/infrastructure/persistence/analysis.repository';
import { detectInfra, openTestConnection } from '../helpers/test-infra';

describe('B2.5 — AnalysisRepository trên MongoDB thật', () => {
  let conn: Connection;
  let runModel: Model<IAnalysisRun>;
  let resultModel: Model<IAnalysisResult>;
  let jobModel: Model<IAiJob>;
  let evidenceModel: Model<ICellEvidence>;
  let saveModel: Model<IProjectSave>;
  let reportModel: Model<IReportJob>;
  let fewShotModel: Model<IFewShotExample>;

  let repo: AnalysisRepository;

  const oid = (): string => new Types.ObjectId().toHexString();

  const makeRunInput = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    projectId: oid(),
    workspaceId: oid(),
    datasetId: oid(),
    status: 'running',
    inputFingerprint: 'fp-1',
    config: { rules: [], limits: [], error: null },
    startedBy: oid(),
    startedAt: new Date(),
    ...over,
  });

  const makeJobInput = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    analysisRunId: oid(),
    projectId: oid(),
    datasetId: oid(),
    inputFingerprint: 'fp-1',
    status: 'pending',
    ...over,
  });

  beforeAll(async () => {
    const infra = await detectInfra();
    if (!infra.mongo) {
      throw new Error(
        '[B2.5] Thiếu hạ tầng test: MongoDB chưa sẵn sàng. Chạy `pnpm run test:infra:up` trước.',
      );
    }
    conn = await openTestConnection();

    runModel = conn.model('AnalysisRun', AnalysisRunSchema) as unknown as Model<IAnalysisRun>;
    resultModel = conn.model(
      'AnalysisResult',
      AnalysisResultSchema,
    ) as unknown as Model<IAnalysisResult>;
    jobModel = conn.model('AiJob', AiJobSchema) as unknown as Model<IAiJob>;
    evidenceModel = conn.model(
      'CellEvidence',
      CellEvidenceSchema,
    ) as unknown as Model<ICellEvidence>;
    saveModel = conn.model('ProjectSave', ProjectSaveSchema) as unknown as Model<IProjectSave>;
    reportModel = conn.model('ReportJob', ReportJobSchema) as unknown as Model<IReportJob>;
    fewShotModel = conn.model(
      'FewShotExample',
      FewShotExampleSchema,
    ) as unknown as Model<IFewShotExample>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: getConnectionToken(), useValue: conn },
        { provide: 'AnalysisRunModel', useValue: runModel },
        { provide: 'AnalysisResultModel', useValue: resultModel },
        { provide: 'AiJobModel', useValue: jobModel },
        { provide: 'CellEvidenceModel', useValue: evidenceModel },
        { provide: 'ProjectSaveModel', useValue: saveModel },
        { provide: 'ReportJobModel', useValue: reportModel },
        { provide: 'FewShotExampleModel', useValue: fewShotModel },
        AnalysisRepository,
      ],
    }).compile();

    await Promise.all([
      runModel.syncIndexes(),
      resultModel.syncIndexes(),
      jobModel.syncIndexes(),
      evidenceModel.syncIndexes(),
      saveModel.syncIndexes(),
      reportModel.syncIndexes(),
      fewShotModel.syncIndexes(),
    ]);

    repo = module.get(AnalysisRepository);
  }, 30000);

  afterAll(async () => {
    if (conn) await conn.close().catch(() => undefined);
  });

  beforeEach(async () => {
    await runModel.deleteMany({});
    await resultModel.deleteMany({});
    await jobModel.deleteMany({});
    await evidenceModel.deleteMany({});
    await saveModel.deleteMany({});
    await reportModel.deleteMany({});
    await fewShotModel.deleteMany({});
  });

  // ─── Run ───────────────────────────────────────────────────────────────────

  describe('Analysis run', () => {
    it('create → findById trả run', async () => {
      const run = await repo.create(makeRunInput() as never);
      expect(run.id).toBeTruthy();
      expect((await repo.findById(run.id))?.id).toBe(run.id);
      expect(await repo.findById('khong-hop-le')).toBeNull();
    });

    it('create nhận cả snake_case (project_id …)', async () => {
      const projectId = oid();
      const run = await repo.create({
        project_id: projectId,
        workspace_id: oid(),
        dataset_id: oid(),
        status: 'running',
        input_fingerprint: 'fp-snake',
        config: {},
      } as never);
      expect(run.projectId).toBe(projectId);
    });

    it('updateById cập nhật status', async () => {
      const run = await repo.create(makeRunInput() as never);
      const updated = await repo.updateById(run.id, { status: 'succeeded' });
      expect(updated?.status).toBe('succeeded');
      expect(await repo.updateById('khong-hop-le', { status: 'failed' })).toBeNull();
    });

    it('findRunByFingerprint chỉ trả run status=succeeded', async () => {
      const projectId = oid();
      await repo.create(makeRunInput({ projectId, inputFingerprint: 'fp-x', status: 'running' }) as never);
      expect(await repo.findRunByFingerprint('fp-x')).toBeNull();

      await repo.create(makeRunInput({ projectId, inputFingerprint: 'fp-x', status: 'succeeded' }) as never);
      expect((await repo.findRunByFingerprint('fp-x'))?.inputFingerprint).toBe('fp-x');
    });

    it('findLatestRunByProject trả run mới nhất', async () => {
      const projectId = oid();
      await repo.create(makeRunInput({ projectId, status: 'succeeded' }) as never);
      await repo.create(makeRunInput({ projectId, status: 'running' }) as never);

      const latest = await repo.findLatestRunByProject(projectId);
      expect(latest?.projectId).toBe(projectId);
      expect(await repo.findLatestRunByProject('khong-hop-le')).toBeNull();
    });
  });

  // ─── Result ────────────────────────────────────────────────────────────────

  describe('Analysis result', () => {
    const dq05 = { status: 'assessed', reason: null, rules: [], violations: [] };

    it('saveResult → findResultByRun trả kết quả', async () => {
      const runId = oid();
      const projectId = oid();
      const datasetId = oid();

      await repo.saveResult({
        analysisRunId: runId,
        projectId,
        datasetId,
        input_fingerprint: 'fp-r',
        dq05,
      } as never);

      const found = await repo.findResultByRun(runId);
      expect(found?.analysisRunId).toBe(runId);
      expect(await repo.findResultByRun('khong-hop-le')).toBeNull();
    });

    it('updateResultById cập nhật kết quả', async () => {
      const runId = oid();
      const result = await repo.saveResult({
        analysisRunId: runId,
        projectId: oid(),
        datasetId: oid(),
        input_fingerprint: 'fp-r',
        dq05,
      } as never);

      const updated = await repo.updateResultById(result.id, { is_stale: true });
      expect(updated?.isStale).toBe(true);
      expect(await repo.updateResultById('khong-hop-le', { is_stale: true })).toBeNull();
    });

    it('markResultsStale đánh dấu kết quả cũ (giữ lại run được chỉ định)', async () => {
      const projectId = oid();
      const runKeep = oid();
      const runOld = oid();

      await repo.saveResult({
        analysisRunId: runKeep,
        projectId,
        datasetId: oid(),
        input_fingerprint: 'fp1',
        dq05,
      } as never);
      await repo.saveResult({
        analysisRunId: runOld,
        projectId,
        datasetId: oid(),
        input_fingerprint: 'fp2',
        dq05,
      } as never);

      await repo.markResultsStale(projectId, runKeep, 'dataset thay đổi');

      const kept = await repo.findResultByRun(runKeep);
      const old = await repo.findResultByRun(runOld);
      expect(kept?.isStale).toBe(false);
      expect(old?.isStale).toBe(true);
      expect(old?.staleReason).toBe('dataset thay đổi');
    });

    it('markResultsStale với projectId không hợp lệ ⇒ modifiedCount 0', async () => {
      const res = (await repo.markResultsStale('khong-hop-le', oid(), 'x')) as {
        modifiedCount: number;
      };
      expect(res.modifiedCount).toBe(0);
    });
  });

  // ─── AI job (lease & heartbeat) ───────────────────────────────────────────

  describe('AI job — lease & heartbeat', () => {
    it('createJob → findJobById trả job', async () => {
      const job = await repo.createJob(makeJobInput() as never);
      expect(job.id).toBeTruthy();
      expect((await repo.findJobById(job.id))?.id).toBe(job.id);
      expect(await repo.findJobById('khong-hop-le')).toBeNull();
    });

    it('updateJobById cập nhật trạng thái job', async () => {
      const job = await repo.createJob(makeJobInput() as never);
      const updated = await repo.updateJobById(job.id, { status: 'succeeded' });
      expect(updated?.status).toBe('succeeded');
      expect(await repo.updateJobById('khong-hop-le', { status: 'failed' })).toBeNull();
    });

    it('claimPendingJob ⇒ chiếm job pending, đặt lease + heartbeat', async () => {
      const job = await repo.createJob(makeJobInput({ status: 'pending' }) as never);

      const claimed = await repo.claimPendingJob();
      expect(claimed?.id).toBe(job.id);
      expect(claimed?.status).toBe('running');
      expect(claimed?.leaseExpiresAt).not.toBeNull();
      expect(claimed?.heartbeatAt).not.toBeNull();

      // Không còn job pending ⇒ không claim được lần 2.
      expect(await repo.claimPendingJob()).toBeNull();
    });

    it('claimPendingJob chiếm lại job running có lease đã hết hạn', async () => {
      await repo.createJob(
        makeJobInput({
          status: 'running',
          lease_expires_at: new Date(Date.now() - 1000),
          heartbeat_at: new Date(Date.now() - 1000),
        }) as never,
      );

      const claimed = await repo.claimPendingJob();
      expect(claimed?.status).toBe('running');
    });

    it('heartbeatJob gia hạn lease của job đang chạy', async () => {
      const job = await repo.createJob(makeJobInput({ status: 'pending' }) as never);
      await repo.claimPendingJob();

      const beat = await repo.heartbeatJob(job.id, 300000);
      expect(beat?.leaseExpiresAt).not.toBeNull();
      expect(await repo.heartbeatJob('khong-hop-le')).toBeNull();
    });

    it('skipStaleJobs ⇒ chuyển job quá hạn sang skipped', async () => {
      await repo.createJob(
        makeJobInput({
          status: 'running',
          lease_expires_at: new Date(Date.now() - 1000),
          heartbeat_at: new Date(Date.now() - 1000),
        }) as never,
      );

      const res = (await repo.skipStaleJobs()) as { modifiedCount: number };
      expect(res.modifiedCount).toBe(1);

      const job = await jobModel.findOne({ status: 'skipped' }).lean();
      expect(job?.error?.code).toBe('AI_LEASE_EXPIRED');
    });
  });

  // ─── Cell evidence ────────────────────────────────────────────────────────

  describe('Cell evidence', () => {
    it('insertEvidences ghi hàng loạt + đếm + đọc lại', async () => {
      const runId = oid();
      const inserted = await repo.insertEvidences([
        { analysisRunId: runId, projectId: oid(), datasetId: oid(), column: 'c0', rowIndex: 0, kind: 'missing' },
        { analysisRunId: runId, projectId: oid(), datasetId: oid(), column: 'c1', rowIndex: 1, kind: 'outlier' },
      ] as never);

      expect(inserted).toBe(2);
      expect(await repo.countEvidencesByRun(runId)).toBe(2);

      const evidences = await repo.findEvidencesByRun(runId);
      expect(evidences).toHaveLength(2);
      // Sắp xếp theo (column, row_index).
      expect(evidences[0]?.column).toBe('c0');

      expect(await repo.insertEvidences([])).toBe(0);
      expect(await repo.countEvidencesByRun('khong-hop-le')).toBe(0);
      expect(await repo.findEvidencesByRun('khong-hop-le')).toEqual([]);
    });

    it('findEvidencesByRun giới hạn số lượng', async () => {
      const runId = oid();
      await repo.insertEvidences(
        Array.from({ length: 5 }, (_, i) => ({
          analysisRunId: runId,
          projectId: oid(),
          datasetId: oid(),
          column: 'c0',
          rowIndex: i,
          kind: 'missing',
        })) as never,
      );
      expect(await repo.findEvidencesByRun(runId, 2)).toHaveLength(2);
    });
  });

  // ─── Project save ─────────────────────────────────────────────────────────

  describe('Project save', () => {
    const summary = {
      overview: 'Tổng quan',
      issues: [],
      evidence_refs: 0,
      recommendations: [],
      ai_section: null,
    };

    it('createSave → findLatestSaveByProject / findSaveById', async () => {
      const projectId = oid();
      const save = await repo.createSave({
        projectId,
        workspaceId: oid(),
        analysisRunId: oid(),
        analysisResultId: oid(),
        inputFingerprint: 'fp-s',
        summary,
      } as never);

      expect(save.id).toBeTruthy();
      expect((await repo.findSaveById(save.id))?.id).toBe(save.id);
      expect((await repo.findLatestSaveByProject(projectId))?.id).toBe(save.id);
      expect(await repo.findSaveById('khong-hop-le')).toBeNull();
      expect(await repo.findLatestSaveByProject('khong-hop-le')).toBeNull();
    });

    it('markSavesStale đánh dấu bản lưu cũ (giữ lại bản được chỉ định)', async () => {
      const projectId = oid();
      const keep = await repo.createSave({ projectId, workspaceId: oid(), summary } as never);
      const old = await repo.createSave({ projectId, workspaceId: oid(), summary } as never);

      await repo.markSavesStale(projectId, keep.id);

      expect((await repo.findSaveById(keep.id))?.isStale).toBe(false);
      expect((await repo.findSaveById(old.id))?.isStale).toBe(true);
    });
  });

  // ─── Report job ───────────────────────────────────────────────────────────

  describe('Report job', () => {
    it('createReportJob → findReportById', async () => {
      const report = await repo.createReportJob({
        projectId: oid(),
        workspaceId: oid(),
        projectSaveId: oid(),
        status: 'pending',
      } as never);

      expect(report.id).toBeTruthy();
      expect((await repo.findReportById(report.id))?.id).toBe(report.id);
      expect(await repo.findReportById('khong-hop-le')).toBeNull();
    });

    it('updateReportById ghi storage_key + file_size_bytes', async () => {
      const report = await repo.createReportJob({
        projectId: oid(),
        workspaceId: oid(),
        status: 'pending',
      } as never);

      const updated = await repo.updateReportById(report.id, {
        storageKey: 'reports/r.pdf',
        fileSizeBytes: 1234,
        status: 'succeeded',
      });
      expect(updated?.storageKey).toBe('reports/r.pdf');
      expect(updated?.fileSizeBytes).toBe(1234);
      expect(await repo.updateReportById('khong-hop-le', { status: 'failed' })).toBeNull();
    });

    it('claimPendingReport chiếm report pending', async () => {
      const report = await repo.createReportJob({
        projectId: oid(),
        workspaceId: oid(),
        status: 'pending',
      } as never);

      const claimed = await repo.claimPendingReport();
      expect(claimed?.id).toBe(report.id);
      expect(claimed?.status).toBe('running');
      expect(await repo.claimPendingReport()).toBeNull();
    });
  });

  // ─── Few-shot ─────────────────────────────────────────────────────────────

  describe('Few-shot example', () => {
    const makeFewShot = (over: Record<string, unknown> = {}) => ({
      workspaceId: oid(),
      projectId: oid(),
      errorType: 'missing_value',
      columnTraits: 'numeric',
      description: 'Cột A có nhiều giá trị thiếu',
      label: 'correct',
      embedding: [0.1, 0.2],
      trustScore: 0.8,
      language: 'vi',
      agreementCount: 3,
      ...over,
    });

    it('saveFewShotExample → countFewShotExamples / findDuplicateExample', async () => {
      const workspaceId = oid();
      const example = await repo.saveFewShotExample(makeFewShot({ workspaceId }) as never);

      expect(example.id).toBeTruthy();
      expect(await repo.countFewShotExamples(workspaceId)).toBe(1);

      const dup = await repo.findDuplicateExample({
        workspaceId,
        errorType: 'missing_value',
        description: 'Cột A có nhiều giá trị thiếu',
        label: 'correct',
      });
      expect(dup?.id).toBe(example.id);
      expect(await repo.findDuplicateExample({ workspaceId: 'khong-hop-le', errorType: 'x', description: 'y', label: 'correct' })).toBeNull();
    });

    it('findFewShotCandidates lọc theo trust score + tuổi + error type', async () => {
      const workspaceId = oid();
      await repo.saveFewShotExample(makeFewShot({ workspaceId, trustScore: 0.9 }) as never);
      await repo.saveFewShotExample(
        makeFewShot({ workspaceId, trustScore: 0.2, errorType: 'other_type' }) as never,
      );

      const good = await repo.findFewShotCandidates({
        workspaceId,
        minTrustScore: 0.5,
        maxAgeDays: 30,
        limit: 10,
      });
      expect(good).toHaveLength(1);
      expect(good[0]?.trustScore).toBe(0.9);

      const withType = await repo.findFewShotCandidates({
        workspaceId,
        errorType: 'other_type',
        minTrustScore: 0,
        maxAgeDays: 30,
        limit: 10,
      });
      expect(withType).toHaveLength(1);

      expect(
        await repo.findFewShotCandidates({
          workspaceId: 'khong-hop-le',
          minTrustScore: 0,
          maxAgeDays: 30,
          limit: 10,
        }),
      ).toEqual([]);
    });

    it('updateFewShotTrust cập nhật trust score + agreement count', async () => {
      const workspaceId = oid();
      const example = await repo.saveFewShotExample(makeFewShot({ workspaceId }) as never);

      const updated = await repo.updateFewShotTrust(example.id, {
        agreementCount: 10,
        trustScore: 0.95,
        embedding: [0.9, 0.8],
      });
      expect(updated?.trustScore).toBe(0.95);
      expect(updated?.agreementCount).toBe(10);
      expect(await repo.updateFewShotTrust('khong-hop-le', { agreementCount: 1, trustScore: 0.5, embedding: [] })).toBeNull();
    });

    it('enforceFewShotCap xoá bản cũ khi vượt trần', async () => {
      const workspaceId = oid();
      for (let i = 0; i < 5; i++) {
        await repo.saveFewShotExample(makeFewShot({ workspaceId, description: `mô tả ${i}` }) as never);
      }
      expect(await repo.countFewShotExamples(workspaceId)).toBe(5);

      const removed = await repo.enforceFewShotCap(3);
      expect(removed).toBe(2);
      expect(await repo.countFewShotExamples(workspaceId)).toBe(3);

      // Không vượt trần ⇒ không xoá gì.
      expect(await repo.enforceFewShotCap(10)).toBe(0);
    });
  });
});
