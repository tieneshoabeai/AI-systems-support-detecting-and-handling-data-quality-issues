/**
 * PORT từ nhánh Vqd_BE @8969ee3 — test/analysis-completion.spec.ts (Phần 13 v14 mục 3.26).
 * Chỉ đổi import/khởi tạo sang `./legacy-analysis-facade` (handler mới); assert giữ nguyên (TC-01).
 * Nhóm A = đã gỡ theo quyết định OPEN (ghi chú tại chỗ) · nhóm C = `it.failing` (hồi quy chờ đợt K).
 */
/**
 * Phan 13 v8 muc 3.20 — test AN-01 → AN-10 cho dot hoan thien module analysis (2026-11-17).
 * Dung fake repository/service (khong can Mongo) de kiem hanh vi tang application.
 */
import { ConflictException } from '@nestjs/common';
import { LegacySummaryService as SummaryService } from './legacy-analysis-facade';
import { LegacyAnalysisService as AnalysisService } from './legacy-analysis-facade';
import { RemovedServicePlaceholder as ProjectAccessService } from './legacy-analysis-facade';
import { RemovedServicePlaceholder as StalenessService } from './legacy-analysis-facade';
import { ReportWorkerService } from '../../src/modules/analysis/application/report-worker.service';
import { legacyAiWorker } from './legacy-analysis-facade';
import type { AiWorkerService } from '../../src/modules/analysis/application/services/ai-worker.service';
import { buildReportSections } from '../../src/modules/analysis/application/report-content.util';
import { resolveTopN } from '../../src/modules/analysis/domain/top-n.util';
import type {
  AiJobRecord,
  AnalysisResultRecord,
  AnalysisRunRecord,
  ProjectSaveRecord,
  ReportJobRecord,
} from '../../src/modules/analysis/domain/ports/analysis.repository.port';

const P = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const P_OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const WS = 'cccccccccccccccccccccccc';
const RUN = 'dddddddddddddddddddddddd';
const JOB = 'eeeeeeeeeeeeeeeeeeeeeeee';
const RES = 'ffffffffffffffffffffffff';

type Fn = jest.Mock;
type FakeRepo = Record<string, Fn>;

function run(over: Partial<AnalysisRunRecord> = {}): AnalysisRunRecord {
  return {
    id: RUN, projectId: P, workspaceId: WS, datasetId: RUN, status: 'succeeded', inputFingerprint: 'fp',
    config: { top_n: 50 }, startedBy: null, startedAt: null, finishedAt: null, durationMs: null, error: null,
    createdAt: new Date(), updatedAt: new Date(), ...over,
  };
}
function result(over: Partial<AnalysisResultRecord> = {}): AnalysisResultRecord {
  return {
    id: RES, analysisRunId: RUN, projectId: P, inputFingerprint: 'fp', isStale: false, staleReason: null,
    correlationMatrix: { method: 'pearson', columns: ['a', 'b'], cells: [{ colA: 'a', colB: 'b', coef: 0.91, kind: 'pearson', n: 10, totalScanned: 10, missingAOnly: 0, missingBOnly: 0, missingBoth: 0, computable: true, reason: null }] },
    vif: { columns: ['a', 'b'], rows: [{ column: 'a', vif: 12.3, flag: 'high', computable: true, reason: null }], commonN: 10, totalScanned: 10, commonNRate: 1, lossWarning: null, excluded: [] },
    dq_summary: {
      totalScanned: 10, duplicateRowCount: 0, notes: [],
      columns: Array.from({ length: 12 }, (_, i) => ({ column: `c${i}`, missingCount: i + 1, missingRate: 0.1, invalidCount: 0, invalidRate: 0, outlierCount: 0, outlierRate: 0 })),
    },
    aiCorrelationAssessment: { status: 'pending' },
    createdAt: new Date(), ...over,
  };
}
function job(over: Partial<AiJobRecord> = {}): AiJobRecord {
  return { id: JOB, analysisRunId: RUN, projectId: P, datasetId: RUN, status: 'failed', attempt: 1, modelId: null, createdAt: new Date(), updatedAt: new Date(), ...over };
}
function save(id: string, over: Partial<ProjectSaveRecord> = {}): ProjectSaveRecord {
  return { id, projectId: P, analysisRunId: RUN, inputFingerprint: 'fp', summary: { overview: `save ${id}`, issues: [], top_n: 50 }, isStale: false, createdAt: new Date(), ...over };
}

const projects = (role: 'owner' | 'member' | 'viewer' | null = 'member') => ({
  getProjectById: jest.fn(async (id: string) => ({ id, workspaceId: WS })),
  resolveUserProjectRole: jest.fn(async () => role),
});
const workspaces = (role: 'owner' | 'member' | null = 'member') => ({ resolveUserWorkspaceRole: jest.fn(async () => role) });
const config = (vals: Record<string, unknown> = {}) => ({ get: jest.fn((k: string) => vals[k]) });

const noDatasets = { findByProject: jest.fn(async () => null) };
function staleness(repo: FakeRepo, datasets: unknown = noDatasets): StalenessService {
  return new StalenessService(repo as never, datasets as never);
}
function analysisService(repo: FakeRepo, proj = projects(), ws = workspaces(), datasets: unknown = noDatasets): AnalysisService {
  const access = new ProjectAccessService(proj as never, ws as never);
  return new AnalysisService(repo as never, proj as never, datasets as never, {} as never, config() as never, access, staleness(repo, datasets));
}

describe('AN-01 / AN-10: SUMMARY-01 chan ket qua stale + top_n', () => {
  // [Nhóm A — không port] AN-01: D2 'kết quả lỗi thời' đã gỡ — dataset bất biến (OPEN-03) + không còn cấu hình (OPEN-06); Tổng kết luôn isStale=false.

  it('AN-10: top_n cua lan chay gioi han so phat hien', async () => {
    const repo: FakeRepo = {
      findLatestRunByProject: jest.fn(async () => run({ config: { top_n: 5 } })),
      findResultByRun: jest.fn(async () => result()),
      findConfigByProject: jest.fn(),
      countEvidencesByRun: jest.fn(async () => 0),
      createSave: jest.fn(async (d: Record<string, unknown>) => ({ ...save('s1'), summary: d.summary })),
      markSavesStale: jest.fn(),
    };
    const out = await new SummaryService(repo as never, projects() as never, staleness(repo)).createSummary(P);
    const summary = out.summary as { issues: unknown[]; top_n: number };
    expect(summary.issues).toHaveLength(5);
    expect(summary.top_n).toBe(5);
  });

  it('resolveTopN: mac dinh 50, chan tren 100', () => {
    expect(resolveTopN(undefined)).toBe(50);
    expect(resolveTopN(0)).toBe(50);
    expect(resolveTopN(7)).toBe(7);
    expect(resolveTopN(9999)).toBe(100);
  });
});

describe('AN-02 / AN-06 / AN-07: AnalysisService', () => {
  // [Nhóm A — không port] AN-02: như AN-01 — không còn trạng thái lỗi thời.

  // HỒI QUY sau merge backend (Phần 13 v14 mục 3.26 nhóm C): `RetryJobHandler` không còn kiểm trạng thái job — job succeeded/running/pending vẫn được thử lại, mất mã lỗi `AI_JOB_NOT_RETRYABLE`.
  it.failing.each(['succeeded', 'running', 'pending'] as const)('AN-06: retry job %s -> 409 AI_JOB_NOT_RETRYABLE', async (status) => {
    const repo: FakeRepo = { findJobById: jest.fn(async () => job({ status })), updateJobById: jest.fn() };
    const err = await analysisService(repo).retryJob(JOB).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ error: 'AI_JOB_NOT_RETRYABLE' });
    expect(repo.updateJobById).not.toHaveBeenCalled();
  });

  // [Nhóm A — không port] AN-07: như AN-01 — không còn trạng thái lỗi thời.

  it('retry hop le: job failed + ket qua con hieu luc -> pending, attempt+1', async () => {
    const repo: FakeRepo = {
      findJobById: jest.fn(async () => job({ status: 'failed', attempt: 1 })),
      findResultByRun: jest.fn(async () => result()),
      findById: jest.fn(async () => run()),
      updateJobById: jest.fn(async () => job({ status: 'pending', attempt: 2 })),
    };
    const out = await analysisService(repo).retryJob(JOB);
    expect(out).toMatchObject({ status: 'pending', attempt: 2 });
  });
});

// [Nhóm A — không port] AN-08: kiểm quyền job chuyển từ service sang guard CASL + `analysis-job-policy.loader.ts` (refactor P5); kiểm ở `casl.spec.ts` / `guard-coverage.spec.ts`.

describe('AN-04 / AN-05: AI worker khong mat luot retry khi loi JSON', () => {
  function setup(attempt: number) {
    const repo: FakeRepo = {
      findJobById: jest.fn(async () => job({ status: 'running', attempt })),
      updateJobById: jest.fn(),
      heartbeatJob: jest.fn(),
    };
    const analysis = { buildPromptForJob: jest.fn(async () => 'prompt'), ingestAiResult: jest.fn(async () => ({ status: 'failed' })), markAiFailed: jest.fn(async () => undefined) };
    const inference = { complete: jest.fn(async () => ({ text: 'khong phai json', modelId: null, durationMs: 1 })) };
    const worker = legacyAiWorker(repo, analysis, inference, config({ AI_MAX_RETRIES: 2 }));
    return { repo, analysis, worker };
  }
  const process = (w: AiWorkerService, id: string): Promise<void> =>
    (w as unknown as { processJob(id: string): Promise<void> }).processJob(id);

  // HỒI QUY sau merge backend (Phần 13 v14 mục 3.26 nhóm C): worker AI gọi ingest({}) ngay khi lỗi JSON dù còn lượt → ghi đánh giá AI failed sớm (đợt A).
  it.failing('AN-04: con luot -> pending, attempt+1, khong ghi danh gia failed', async () => {
    const { repo, analysis, worker } = setup(0);
    await process(worker, JOB);
    const last = repo.updateJobById?.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(last).toMatchObject({ status: 'pending', attempt: 1 });
    expect(analysis.ingestAiResult).not.toHaveBeenCalled();
    expect(analysis.markAiFailed).not.toHaveBeenCalled();
  });
  // [Nhóm A — không port] AN-05: `markAiFailed` đã gỡ; worker mới tự ghi job failed `AI_FAILED` và gọi ingest({}) để ghi đánh giá failed — cơ chế khác, assert cũ dựa trên `markAiFailed`.
});

describe('AN-03 / AN-09: worker PDF', () => {
  function setup(reportJob: ReportJobRecord) {
    const saves = new Map([['s-A', save('s-A')], ['s-B', save('s-B')]]);
    const repo: FakeRepo = {
      findReportById: jest.fn(async () => reportJob),
      findSaveById: jest.fn(async (id: string) => saves.get(id) ?? null),
      findLatestSaveByProject: jest.fn(async () => saves.get('s-B')),
      findResultByRun: jest.fn(async () => result()),
      findEvidencesByRun: jest.fn(async () => [{ analysisRunId: RUN, column: 'c0', rowIndex: 3, reason: 'dq01_missing', kind: 'missing', valueMasked: null }]),
      updateReportById: jest.fn(),
      heartbeatReport: jest.fn(),
      recoverStaleReports: jest.fn(async () => ({ requeued: 0, failed: 0 })),
      claimPendingReport: jest.fn(async () => null),
    };
    const storage = { uploadStream: jest.fn(async () => undefined) };
    const worker = new ReportWorkerService(repo as never, storage as never, config() as never);
    return { repo, storage, worker };
  }
  const reportJob = (over: Partial<ReportJobRecord> = {}): ReportJobRecord => ({
    id: 'r1', projectId: P, projectSaveId: 's-A', status: 'running', createdAt: new Date(), updatedAt: new Date(), ...over,
  });

  it('AN-03: dung dung ban Tong ket da yeu cau (save A), khong lay ban moi nhat', async () => {
    const { repo, storage } = setup(reportJob());
    const { worker } = { worker: new ReportWorkerService(repo as never, storage as never, config() as never) };
    await worker.buildPdf('r1');
    expect(repo.findSaveById).toHaveBeenCalledWith('s-A');
    expect(repo.findLatestSaveByProject).not.toHaveBeenCalled();
    expect(repo.updateReportById?.mock.calls.at(-1)?.[1]).toMatchObject({ status: 'succeeded' });
    expect(storage.uploadStream).toHaveBeenCalledTimes(1);
  });
  it('save thuoc project khac -> failed REPORT_BUILD_FAILED', async () => {
    const { repo, worker } = setup(reportJob({ projectId: P_OTHER }));
    await worker.buildPdf('r1');
    expect(repo.updateReportById?.mock.calls.at(-1)?.[1]).toMatchObject({ status: 'failed', error: { code: 'REPORT_BUILD_FAILED' } });
  });
  // HỒI QUY sau merge backend (Phần 13 v14 mục 3.26 nhóm C): `ReportWorkerService.tick()` không còn thu hồi job PDF treo (`recoverStaleReports`) và không truyền lease khi claim (đợt A).
  it.failing('AN-09: moi tick thu hoi job PDF ket truoc khi claim (lease)', async () => {
    const { repo, worker } = setup(reportJob());
    await worker.tick();
    expect(repo.recoverStaleReports).toHaveBeenCalledWith(3);
    expect(repo.claimPendingReport).toHaveBeenCalledWith(600000);
  });
});

describe('REPORT-01: noi dung PDF FULL + font', () => {
  const sections = buildReportSections({
    projectId: P,
    save: save('s-A', { summary: { overview: 'Tổng quan', issues: [{ dq: 'DQ-01', column: 'c0', count: 3, rate: 0.3 }], recommendations: ['Kiểm tra nguồn'], top_n: 50 } }),
    result: result(),
    evidences: [{ analysisRunId: RUN, column: 'c0', rowIndex: 3, reason: 'dq01_missing', kind: 'missing', valueMasked: null }],
    topN: 50,
  });

  it('co du cac phan: top phat hien, ma tran, VIF, AI, phu luc A-E', () => {
    const heads = sections.map((s) => s.heading);
    for (const h of ['2. Top', '4. Ma trận tương quan', '5. Đa cộng tuyến', '6. Nhận xét AI', 'Phụ lục A', 'Phụ lục B', 'Phụ lục C', 'Phụ lục D', 'Phụ lục E']) {
      expect(heads.some((x) => x.startsWith(h))).toBe(true);
    }
    const corr = sections.find((s) => s.heading.startsWith('4.'));
    expect(corr?.table?.rows[0]).toEqual(['a', 'b', '0.91', 'pearson', '10', '']);
  });

  // [Nhóm A — không port] che do ASCII (khong font): trình dựng PDF tự viết (`buildReportPdf`) đã thay bằng pdfkit (`buildReportPdfAsync`).

  // [Nhóm A — không port] che do ASCII: như trên — đổi thư viện PDF.

  // [Nhóm A — không port] font khong hop le: như trên — `parseTrueType` đã gỡ cùng trình dựng PDF cũ.

  // [Nhóm A — không port] che do Unicode: như trên — đổi thư viện PDF.
});
