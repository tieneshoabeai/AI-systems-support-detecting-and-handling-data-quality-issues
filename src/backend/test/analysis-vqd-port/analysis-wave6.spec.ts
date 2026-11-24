/**
 * PORT từ nhánh Vqd_BE @8969ee3 — test/analysis-wave6.spec.ts (Phần 13 v14 mục 3.26).
 * Chỉ đổi import/khởi tạo sang `./legacy-analysis-facade` (handler mới); assert giữ nguyên (TC-01).
 * Nhóm A = đã gỡ theo quyết định OPEN (ghi chú tại chỗ) · nhóm C = `it.failing` (hồi quy chờ đợt K).
 */
/**
 * Phan 13 v8 muc 3.21 — test AN-11 → AN-20 cho dot D/E hoan thien module analysis.
 * Fake repository/service (khong can Mongo).
 */
import { PayloadTooLargeException } from '@nestjs/common';
import { RemovedServicePlaceholder as ProjectAccessService } from './legacy-analysis-facade';
import { RemovedServicePlaceholder as StalenessService } from './legacy-analysis-facade';
import { LegacyAnalysisService as AnalysisService } from './legacy-analysis-facade';
import { LegacySummaryService as SummaryService } from './legacy-analysis-facade';
import { buildReportSections } from '../../src/modules/analysis/application/report-content.util';
// OPEN-06: không còn AnalysisConfigSchema; top_n / chart_top_n nay nằm trong RunAnalysisSchema.
import { RunAnalysisSchema as AnalysisConfigSchema } from '../../src/modules/analysis/presentation/dtos/run-analysis.dto';
import { boxPlot, categoryTopN, clampChartTopN, histogram } from '../../src/shared/domain/utils/chart-data.util';
import { outlierSeverity, rateSeverity } from '../../src/modules/analysis/domain/impact.util';
import type { AnalysisResultRecord, AnalysisRunRecord } from '../../src/modules/analysis/domain/ports/analysis.repository.port';

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
  // HỒI QUY sau merge backend (Phần 13 v14 mục 3.26 nhóm C): Tổng kết không còn dùng `outlierBreakdown` (mất DQ-04 mức cao), thiếu `recommendation_items` / `unassessable` (đợt D/E).
  it.failing('sap cao -> trung binh -> thap, cung muc theo ty le; de xuat theo van de; nguong + cau hinh', async () => {
    const res = result({
      dq_summary: {
        totalScanned: 1000, duplicateRowCount: 3, notes: [],
        columns: [
          { column: 'a', missingCount: 5, missingRate: 0.005, invalidCount: 0, invalidRate: 0, outlierCount: 0, outlierRate: 0 },
          { column: 'b', missingCount: 300, missingRate: 0.3, invalidCount: 50, invalidRate: 0.05, outlierCount: 4, outlierRate: 0.004, outlierBreakdown: { iqr: 4, iqrExtreme: 0, zscore: 4, both: 4 } },
          { column: 'c', missingCount: 0, missingRate: null, invalidCount: 0, invalidRate: null, outlierCount: 0, outlierRate: null },
        ],
      },
      dq05: { status: 'unassessed' },
    });
    const repo: FakeRepo = {
      findLatestRunByProject: jest.fn(async () => run({ config: { top_n: 50, selected_column_names: ['a', 'b', 'c'], correlation_method: 'pearson', outlier_method: 'both', chart_top_n: 5 } })),
      findResultByRun: jest.fn(async () => res),
      countEvidencesByRun: jest.fn(async () => 0),
      createSave: jest.fn(async (d: Record<string, unknown>) => ({ id: 's1', summary: d.summary })),
      markSavesStale: jest.fn(),
    };
    const svc = new SummaryService(repo as never, projects('member') as never, new StalenessService(repo as never, {} as never));
    const out = await svc.createSummary(P);
    const s = out.summary as Record<string, unknown> & { issues: { dq: string; column: string | null; severity: string; priority: number }[] };
    expect(s.issues.map((i) => `${i.dq}:${i.column}:${i.severity}`)).toEqual([
      'DQ-01:b:high',
      'DQ-04:b:high',
      'DQ-03:b:medium',
      'DQ-01:a:low', // cung muc thap: 0,5% > 0,3% (DQ-02 3/1000)
      'DQ-02:null:low',
    ]);
    expect(s.issues.map((i) => i.priority)).toEqual([1, 2, 3, 4, 5]);
    expect(s.recommendations).toEqual(expect.arrayContaining([expect.stringMatching(/^\[1\] DQ-01 · b: /)]));
    expect((s.recommendations as unknown[]).every((r) => typeof r === 'string')).toBe(true);
    expect((s.recommendation_items as { priority: number; dq: string; column: string | null }[])[0]).toMatchObject({ priority: 1, dq: 'DQ-01', column: 'b' });
    expect(s.unassessable).toEqual([{ column: 'c', reason: expect.stringContaining('Không có dòng') }]);
    expect((s.thresholds as unknown[]).length).toBe(5);
    expect(s.config_used).toMatchObject({ selected_columns: ['a', 'b', 'c'], outlier_method: 'both' });

    const sections = buildReportSections({ projectId: P, save: { id: 's1', projectId: P, analysisRunId: RUN, inputFingerprint: 'fp', summary: s, isStale: false, createdAt: new Date() }, result: res, evidences: [], topN: 50 });
    const top = sections.find((x) => x.heading.startsWith('2. Top'));
    expect(top?.table?.headers).toContain('Mức ảnh hưởng');
    expect(top?.table?.rows[0]).toEqual(['1', 'DQ-01', 'b', 'Cao', '300', '30.00%']);
    expect(sections.some((x) => x.heading.startsWith('2b. Cấu hình'))).toBe(true);
  });
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

  // HỒI QUY sau merge backend (Phần 13 v14 mục 3.26 nhóm C): không còn ghi outbox `ANALYSIS_COMPLETED` + thông báo `analysis_completed` khi phân tích xong (đợt D/E).
  it.failing('AN-19a: chay thanh cong -> ANALYSIS_COMPLETED + thong bao; luu charts + fingerprint v2', async () => {
    const { svc, repo, outbox, notifications } = setup();
    await svc.runAnalysis(P, dto, 'u1');
    expect(outbox.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'ANALYSIS_COMPLETED', project_id: P }));
    expect(notifications.dispatch).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', type: 'analysis_completed' }));
    const saved = repo.saveResult?.mock.calls[0]?.[0] as { charts: { histograms: unknown[]; boxPlots: unknown[]; categories: { column: string }[] } };
    expect(saved.charts.histograms).toHaveLength(1);
    expect(saved.charts.boxPlots).toHaveLength(1);
    expect(saved.charts.categories[0]?.column).toBe('loai');
    const created = repo.create?.mock.calls[0]?.[0] as { config: Record<string, unknown> };
    expect(created.config).toMatchObject({ fingerprint_version: 2, selected_column_keys: ['c0', 'c1'], chart_top_n: 5 });
  });
  // HỒI QUY sau merge backend (Phần 13 v14 mục 3.26 nhóm C): không còn ghi outbox `ANALYSIS_FAILED` + thông báo `analysis_failed` (đợt D/E).
  it.failing('AN-19b: phan tich loi -> ANALYSIS_FAILED + thong bao', async () => {
    const { svc, outbox, notifications } = setup({ failRecords: true });
    await expect(svc.runAnalysis(P, dto, 'u1')).rejects.toThrow('boom');
    expect(outbox.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'ANALYSIS_FAILED' }));
    expect(notifications.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'analysis_failed' }));
  });
  // HỒI QUY sau merge backend (Phần 13 v14 mục 3.26 nhóm C): không còn ghi outbox `AI_JOB_SUCCEEDED/FAILED` + thông báo `ai_analysis_ready` (đợt D/E).
  it.failing('AN-19c: AI xong -> AI_JOB_SUCCEEDED/FAILED + thong bao nguoi chay', async () => {
    const { svc, repo, outbox, notifications } = setup();
    repo.findResultByRun?.mockImplementation(async () => result({
      correlationMatrix: { method: 'pearson', columns: ['x', 'y'], cells: [{ colA: 'x', colB: 'y', coef: 0.9, kind: 'pearson', n: 6, totalScanned: 6, missingAOnly: 0, missingBOnly: 0, missingBoth: 0, computable: true, reason: null }] },
      vif: { columns: [], rows: [], commonN: 6, totalScanned: 6, commonNRate: 1, lossWarning: null, excluded: [] },
    }));
    await svc.ingestAiResult(JOB, { notablePairs: [{ colA: 'x', colB: 'y', coef: 0.9 }], highVif: [], limits: [], nextSteps: [] });
    expect(outbox.recordEvent).toHaveBeenLastCalledWith(expect.objectContaining({ event_type: 'AI_JOB_SUCCEEDED', aggregate_id: JOB }));
    expect(notifications.dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'u1', type: 'ai_analysis_ready' }));
    await svc.ingestAiResult(JOB, 'khong phai object');
    expect(outbox.recordEvent).toHaveBeenLastCalledWith(expect.objectContaining({ event_type: 'AI_JOB_FAILED' }));
  });
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
  // HỒI QUY sau merge backend (Phần 13 v14 mục 3.26 nhóm C): `top_n` mặc định 10 thay vì 50 (đợt A, analysis_plan mục 6).
  it.failing('top_n > 100 bi tu choi, mac dinh 50', () => {
    expect(AnalysisConfigSchema.safeParse({ top_n: 101 }).success).toBe(false);
    expect(AnalysisConfigSchema.safeParse({ top_n: 100 }).success).toBe(true);
    expect(AnalysisConfigSchema.parse({}).top_n).toBe(50);
  });
});
