/**
 * Đợt K / K5 — lease job PDF trên MongoDB thật (Phần 13 v14 mục 3.27, AK-07).
 * Quy tắc: Phần 9 v6 mục 3.13 · schema Phần 8 v13 mục 3.20.
 *
 *   pnpm run test:infra:up   # mongo replica set rs0 @27018
 *   pnpm run test:integration
 */
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { ReportJobSchema, type IReportJob } from '../../src/modules/analysis/infrastructure/persistence/report-job.schema';
import { AnalysisRepository } from '../../src/modules/analysis/infrastructure/persistence/analysis.repository';
import { detectInfra, openTestConnection } from '../helpers/test-infra';

describe('AK-07 (K5) — claimPendingReport có lease trên MongoDB thật', () => {
  let conn: Connection;
  let reportModel: Model<IReportJob>;
  let repo: AnalysisRepository;
  const oid = () => new Types.ObjectId();

  beforeAll(async () => {
    const infra = await detectInfra();
    if (!infra.mongo) {
      throw new Error('[AK-07] Thiếu hạ tầng test: MongoDB chưa sẵn sàng. Chạy `pnpm run test:infra:up` trước.');
    }
    conn = await openTestConnection();
    reportModel = conn.model('ReportJob', ReportJobSchema) as unknown as Model<IReportJob>;
    const empty = {} as unknown;
    const module = await Test.createTestingModule({
      providers: [
        { provide: getConnectionToken(), useValue: conn },
        { provide: 'AnalysisRunModel', useValue: empty },
        { provide: 'AnalysisResultModel', useValue: empty },
        { provide: 'AiJobModel', useValue: empty },
        { provide: 'CellEvidenceModel', useValue: empty },
        { provide: 'ProjectSaveModel', useValue: empty },
        { provide: 'ReportJobModel', useValue: reportModel },
        { provide: 'FewShotExampleModel', useValue: empty },
        AnalysisRepository,
      ],
    }).compile();
    repo = module.get(AnalysisRepository);
  }, 30000);

  // Collection ReportJob của DB test dùng chung với test khác → dọn trước mỗi ca để
  // thứ tự nhận job (created_at tăng dần) không bị bản ghi cũ chen vào.
  beforeEach(async () => {
    await reportModel.deleteMany({});
  });

  afterAll(async () => {
    if (conn) await conn.close().catch(() => undefined);
  });

  const insert = (over: Partial<Pick<IReportJob, 'status' | 'attempt' | 'lease_expires_at'>> = {}) =>
    reportModel.create({ project_id: oid(), workspace_id: oid(), status: 'pending', ...over });

  it('nhận job pending: running, đặt lease, attempt = 1; còn hạn lease thì không nhận lại', async () => {
    const r = await insert();
    const before = Date.now();
    const claimed = await repo.claimPendingReport(60_000);
    expect(claimed?.id).toBe(r.id.toString());
    const doc = await reportModel.findById(r.id).lean();
    expect(doc?.status).toBe('running');
    expect(doc?.attempt).toBe(1);
    expect(doc?.lease_expires_at?.getTime()).toBeGreaterThanOrEqual(before + 60_000);
    expect(await repo.claimPendingReport(60_000)).toBeNull();
  });

  it('job running hết lease còn lượt → được nhận lại, attempt + 1', async () => {
    const r = await insert({ status: 'running', attempt: 1, lease_expires_at: new Date(Date.now() - 1000) });
    const claimed = await repo.claimPendingReport(60_000);
    expect(claimed?.id).toBe(r.id.toString());
    const doc = await reportModel.findById(r.id).lean();
    expect(doc?.attempt).toBe(2);
    expect(doc?.lease_expires_at?.getTime()).toBeGreaterThan(Date.now());
  });

  it('job running hết lease đã đủ 3 lượt → failed REPORT_LEASE_EXPIRED, không nhận lại', async () => {
    const r = await insert({ status: 'running', attempt: 3, lease_expires_at: new Date(Date.now() - 1000) });
    expect(await repo.claimPendingReport(60_000)).toBeNull();
    const doc = await reportModel.findById(r.id).lean();
    expect(doc?.status).toBe('failed');
    expect((doc?.error as { code?: string } | null)?.code).toBe('REPORT_LEASE_EXPIRED');
  });

  it('bản ghi cũ không có trường lease (pending) vẫn được nhận bình thường', async () => {
    const r = await reportModel.collection.insertOne({
      project_id: oid(), workspace_id: oid(), status: 'pending', deleted_at: null, created_at: new Date(), updated_at: new Date(),
    });
    const claimed = await repo.claimPendingReport();
    expect(claimed?.id).toBe(r.insertedId.toString());
    expect((await reportModel.findById(r.insertedId).lean())?.attempt).toBe(1);
  });
});
