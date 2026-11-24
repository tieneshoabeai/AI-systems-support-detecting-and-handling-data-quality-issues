/**
 * PORT từ nhánh Vqd_BE @8969ee3 — test/analysis-wave6.spec.ts (Phần 13 v14 mục 3.26).
 * Chỉ đổi import/khởi tạo sang `./legacy-analysis-facade` (handler mới); assert giữ nguyên (TC-01).
 * Chỉ giữ các test còn đúng với code hiện hành; test không port ghi lý do tại chỗ ([Nhóm A — không port]).
 */
/**
 * Phan 13 v8 muc 3.21 — test AN-11 → AN-20 cho dot D/E hoan thien module analysis.
 * Fake repository/service (khong can Mongo).
 */
import { PayloadTooLargeException } from '@nestjs/common';
import { RemovedServicePlaceholder as ProjectAccessService } from './legacy-analysis-facade';
import { RemovedServicePlaceholder as StalenessService } from './legacy-analysis-facade';
import { LegacyAnalysisService as AnalysisService } from './legacy-analysis-facade';
// OPEN-06: không còn AnalysisConfigSchema; top_n / chart_top_n nay nằm trong RunAnalysisSchema.
import { RunAnalysisSchema as AnalysisConfigSchema } from '../../../../src/modules/analysis/presentation/dtos/run-analysis.dto';
import { boxPlot, categoryTopN, clampChartTopN, histogram } from '../../../../src/shared/domain/utils/chart-data.util';
import { outlierSeverity, rateSeverity } from '../../../../src/modules/analysis/domain/impact.util';
import type { AnalysisResultRecord, AnalysisRunRecord } from '../../../../src/modules/analysis/domain/ports/analysis.repository.port';

const P = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const WS = 'cccccccccccccccccccccccc';
const RUN = 'dddddddddddddddddddddddd';
const DS = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const JOB = 'eeeeeeeeeeeeeeeeeeeeeeee';
const RES = 'ffffffffffffffffffffffff';

type Fn = jest.Mock;
type FakeRepo = Record<string, Fn>;
type Col = { key: string; index: number; name: string; dataType: 'string' | 'number' | 'boolean' | 'date'; originalName: string; missingCount: number; isPii: boolean };

const col = (i: number, name: string, dataType: Col['dataType']): Col => ({ key: `c${i}`, index: i, name, dataType, originalName: name, missingCount: 0, isPii: false });
const dataset = (columns: Col[], over: Record<string, unknown> = {}) => ({ id: DS, fileChecksum: 'sum', rowCount: 6, columns, ...over });
const projects = (role: 'owner' | 'member' | 'viewer' | null) => ({
  getProjectById: jest.fn(async (id: string) => ({ id, workspaceId: WS })),
  resolveUserProjectRole: jest.fn(async () => role),
});
const workspaces = () => ({ resolveUserWorkspaceRole: jest.fn(async () => 'member') });
const cfg = (vals: Record<string, unknown> = {}) => ({ get: jest.fn((k: string) => vals[k]) });
function result(over: Partial<AnalysisResultRecord> = {}): AnalysisResultRecord {
  return { id: RES, analysisRunId: RUN, projectId: P, inputFingerprint: 'fp', isStale: false, staleReason: null, createdAt: new Date(), ...over };
}
function run(over: Partial<AnalysisRunRecord> = {}): AnalysisRunRecord {
  return {
    id: RUN, projectId: P, workspaceId: WS, datasetId: DS, status: 'succeeded', inputFingerprint: 'fp', config: { top_n: 50 },
    startedBy: 'u1', startedAt: null, finishedAt: null, durationMs: null, error: null, createdAt: new Date(), updatedAt: new Date(), ...over,
  };
}

// [Nhóm A — không port] AN-11 / AN-12 / AN-13: kiểm quyền route project chuyển sang guard CASL + `analysis-run-policy.loader.ts` (refactor P5); route config đã gỡ (OPEN-06).

// [Nhóm A — không port] AN-14 / AN-15: OPEN-06 gỡ cấu hình phân tích (saveConfig/getConfig) và OPEN-03 bỏ D2 'kết quả lỗi thời'.

describe('AN-16: du lieu bieu do', () => {
  it('histogram: tong count = n, toi da 50 bin, mot gia tri -> 1 bin', () => {
    const xs = Array.from({ length: 1000 }, (_, i) => i % 97);
    const h = histogram('x', xs);
    expect(h?.bins.reduce((s, b) => s + b.count, 0)).toBe(1000);
    expect(h!.bins.length).toBeLessThanOrEqual(50);
    expect(h?.method).toBe('freedman_diaconis');
    expect(histogram('x', [5, 5, 5])).toMatchObject({ method: 'single_value', bins: [{ from: 5, to: 5, count: 3 }] });
    expect(histogram('x', [])).toBeNull();
  });
  it('box plot: tu phan vi, rau 1.5xIQR, dem diem ngoai rau', () => {
    const b = boxPlot('x', [1, 2, 3, 4, 5, 6, 7, 8, 100]);
    expect(b).toMatchObject({ q1: 3, median: 5, q3: 7, whiskerLow: 1, whiskerHigh: 8, outsideCount: 1, n: 9 });
  });
  it('Top N + "Khac", N kep trong 1–20', () => {
    const vs = ['a', 'a', 'a', 'b', 'b', 'c', 'd'];
    const c = categoryTopN('x', vs, 2);
    expect(c?.items.map((i) => i.value)).toEqual(['a', 'b']);
    expect(c?.other).toEqual({ count: 2, rate: 0.2857 });
    expect(clampChartTopN(0)).toBe(1);
    expect(clampChartTopN(99)).toBe(20);
    expect(clampChartTopN(undefined)).toBe(5);
  });
  it('DTO: chart_top_n ngoai 1–20 bi tu choi, mac dinh 5', () => {
    expect(AnalysisConfigSchema.safeParse({ chart_top_n: 21 }).success).toBe(false);
    expect(AnalysisConfigSchema.safeParse({ chart_top_n: 0 }).success).toBe(false);
    expect(AnalysisConfigSchema.parse({}).chart_top_n).toBe(5);
  });
});

describe('AN-17: muc anh huong tai bien', () => {
  it('DQ-01/03: <1% thap, 1%–10% trung binh (gom bien), >10% cao', () => {
    expect(rateSeverity('DQ-01', 0.0099)).toBe('low');
    expect(rateSeverity('DQ-01', 0.01)).toBe('medium');
    expect(rateSeverity('DQ-01', 0.1)).toBe('medium');
    expect(rateSeverity('DQ-03', 0.1001)).toBe('high');
  });
  it('DQ-02: <0,5% thap, 0,5%–5% trung binh, >5% cao; null -> no_data', () => {
    expect(rateSeverity('DQ-02', 0.0049)).toBe('low');
    expect(rateSeverity('DQ-02', 0.005)).toBe('medium');
    expect(rateSeverity('DQ-02', 0.05)).toBe('medium');
    expect(rateSeverity('DQ-02', 0.0501)).toBe('high');
    expect(rateSeverity('DQ-01', null)).toBe('no_data');
  });
  it('DQ-04: chi IQR thap; IQR 3x hoac Z trung binh; ca hai cao', () => {
    expect(outlierSeverity({ iqr: 3, iqrExtreme: 0, zscore: 0, both: 0 })).toBe('low');
    expect(outlierSeverity({ iqr: 3, iqrExtreme: 1, zscore: 0, both: 0 })).toBe('medium');
    expect(outlierSeverity({ iqr: 0, iqrExtreme: 0, zscore: 2, both: 0 })).toBe('medium');
    expect(outlierSeverity({ iqr: 3, iqrExtreme: 0, zscore: 2, both: 1 })).toBe('high');
    expect(outlierSeverity({ iqr: 0, iqrExtreme: 0, zscore: 0, both: 0 })).toBeNull();
  });
});

describe('AN-18: Tong ket co muc anh huong + thu tu uu tien', () => {
  // [Nhóm A — không port] sap cao -> trung binh -> thap: lỗi thật K3 — sửa ở đợt K; test mới viết theo hành vi hiện hành ở `test/analysis-dot-k.spec.ts` (assert cũ gắn cơ chế đã đổi). Chi tiết: Tổng kết không còn dùng `outlierBreakdown` (mất DQ-04 mức cao), thiếu `recommendation_items` / `unassessable` (đợt D/E).
});

describe('AN-19 / AN-20: outbox + thong bao, gioi han so dong', () => {
  const cols = [col(0, 'x', 'number'), col(1, 'loai', 'string')];
  const rows = Array.from({ length: 6 }, (_, i) => ({ rowIndex: i, props: { c0: i === 5 ? 100 : i, c1: i % 2 ? 'A' : 'B' } }));

  function setup(opts: { rowCount?: number; failRecords?: boolean } = {}) {
    const repo: FakeRepo = {
      findConfigByProject: jest.fn(async () => null),
      create: jest.fn(async () => run({ status: 'running' })),
      updateById: jest.fn(),
      insertEvidences: jest.fn(async () => 0),
      saveResult: jest.fn(async (d: Record<string, unknown>) => ({ ...result(), ...d, id: RES })),
      findResultByRun: jest.fn(async () => result()),
      createJob: jest.fn(async () => ({ id: JOB })),
      markResultsStale: jest.fn(),
      findById: jest.fn(async () => run()),
      findJobById: jest.fn(async () => ({ id: JOB, analysisRunId: RUN, projectId: P, status: 'running', attempt: 0, modelId: null })),
      updateJobById: jest.fn(),
      updateResultById: jest.fn(async () => null),
    };
    const ds = { findByProject: jest.fn(async () => dataset(cols, { rowCount: opts.rowCount ?? 6 })) };
    const records = { listAllRecords: jest.fn(async () => { if (opts.failRecords) throw new Error('boom'); return rows; }) };
    const outbox = { recordEvent: jest.fn(async () => undefined) };
    const notifications = { dispatch: jest.fn(async () => null) };
    const access = new ProjectAccessService(projects('member') as never, workspaces() as never);
    const svc = new AnalysisService(
      repo as never, projects('member') as never, ds as never, records as never, cfg({ ANALYSIS_MAX_ROWS: 10 }) as never,
      access, new StalenessService(repo as never, ds as never), undefined, undefined, outbox as never, notifications as never,
    );
    return { svc, repo, records, outbox, notifications };
  }
  const dto = { correlation_method: 'pearson' as const, outlier_method: 'both' as const, top_n: 50 };

  // [Nhóm A — không port] AN-19a: lỗi thật K6 — sửa ở đợt K; test mới viết theo hành vi hiện hành ở `test/analysis-dot-k.spec.ts` (assert cũ gắn cơ chế đã đổi). Chi tiết: không còn ghi outbox `ANALYSIS_COMPLETED` + thông báo `analysis_completed` khi phân tích xong (đợt D/E).
  // [Nhóm A — không port] AN-19b: lỗi thật K6 — sửa ở đợt K; test mới viết theo hành vi hiện hành ở `test/analysis-dot-k.spec.ts` (assert cũ gắn cơ chế đã đổi). Chi tiết: không còn ghi outbox `ANALYSIS_FAILED` + thông báo `analysis_failed` (đợt D/E).
  // [Nhóm A — không port] AN-19c: lỗi thật K6 — sửa ở đợt K; test mới viết theo hành vi hiện hành ở `test/analysis-dot-k.spec.ts` (assert cũ gắn cơ chế đã đổi). Chi tiết: không còn ghi outbox `AI_JOB_SUCCEEDED/FAILED` + thông báo `ai_analysis_ready` (đợt D/E).
  // [Nhóm A — không port] AN-19e: `markAiFailed` đã gỡ; worker mới tự ghi job failed (`AI_FAILED`) — xem AN-05.
  it('AN-19d: loi outbox/thong bao khong lam hong luong chinh', async () => {
    const { svc, outbox, notifications } = setup();
    outbox.recordEvent.mockRejectedValue(new Error('outbox down'));
    notifications.dispatch.mockRejectedValue(new Error('notif down'));
    await expect(svc.runAnalysis(P, dto, 'u1')).resolves.toBeDefined();
  });
  it('AN-20: rowCount > ANALYSIS_MAX_ROWS -> 413 ANALYSIS_TOO_LARGE, khong nap du lieu, khong tao run', async () => {
    const { svc, repo, records } = setup({ rowCount: 11 });
    const err = await svc.runAnalysis(P, dto, 'u1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PayloadTooLargeException);
    expect((err as PayloadTooLargeException).getResponse()).toMatchObject({ error: 'ANALYSIS_TOO_LARGE', details: { rowCount: 11, maxRows: 10 } });
    expect(records.listAllRecords).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('Hop dong API: top_n toi da 100 (giu nhu cu)', () => {
  // [Nhóm A — không port] top_n > 100 bi tu choi: thay đổi thiết kế của nhánh `backend`, chấp nhận (analysis_plan mục 7i). Khác biệt: `top_n` mặc định 10 thay vì 50 (đợt A, analysis_plan mục 6).
});
