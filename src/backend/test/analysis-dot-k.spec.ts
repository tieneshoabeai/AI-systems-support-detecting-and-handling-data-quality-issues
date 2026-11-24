/**
 * Đợt K — sửa lỗi đúng đắn sau merge `origin/backend` (Phần 13 v14 mục 3.27, AK-01 → AK-07).
 * Viết theo hành vi **hiện hành** của handler (không dựa trên test logic cũ).
 * Quy tắc: Phần 9 v6 mục 3.13 (K1, K5) · Phần 12 v14 mục 3.23 (K2–K4) · Phần 8 v13 mục 3.20.
 */
import { RunAnalysisHandler } from '../src/modules/analysis/application/commands/run-analysis.handler';
import { CreateSummaryHandler } from '../src/modules/analysis/application/commands/create-summary.handler';
import { AiWorkerService } from '../src/modules/analysis/application/services/ai-worker.service';
import { ReportWorkerService } from '../src/modules/analysis/application/report-worker.service';
import { evaluateImbalance } from '../src/modules/analysis/domain/stats.util';

const P = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const WS = 'cccccccccccccccccccccccc';
const DS = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const RUN = 'dddddddddddddddddddddddd';
const JOB = 'eeeeeeeeeeeeeeeeeeeeeeee';
const RES = 'ffffffffffffffffffffffff';

type Dt = 'string' | 'number' | 'boolean' | 'date';
const col = (i: number, name: string, dataType: Dt) => ({
  key: `c${i}`, index: i, name, dataType, originalName: name, missingCount: 0, isPii: false,
});
const config = (vals: Record<string, unknown> = {}) => ({ get: jest.fn((k: string) => vals[k]) });
const projects = () => ({
  getProjectById: jest.fn(async (id: string) => ({ id, workspaceId: WS })),
  resolveUserProjectRole: jest.fn(async () => 'owner'),
  setHasDataset: jest.fn(async () => true),
});

/** Chạy RunAnalysisHandler trên dữ liệu trong bộ nhớ; trả bản ghi đã lưu vào `saveResult`. */
async function runOn(cols: ReturnType<typeof col>[], props: Record<string, unknown>[]) {
  let stored: Record<string, unknown> | null = null;
  const repo = {
    findRunByFingerprint: jest.fn(async () => null),
    create: jest.fn(async (d: Record<string, unknown>) => ({ id: RUN, projectId: P, workspaceId: WS, datasetId: DS, status: 'running', ...d })),
    updateById: jest.fn(async () => null),
    insertEvidences: jest.fn(async () => 0),
    saveResult: jest.fn(async (d: Record<string, unknown>) => (stored = { id: RES, analysisRunId: RUN, projectId: P, ...d })),
    findResultByRun: jest.fn(async () => stored),
    createJob: jest.fn(async () => ({ id: JOB })),
    markResultsStale: jest.fn(async () => undefined),
    findById: jest.fn(async () => null),
    countEvidencesByRun: jest.fn(async () => 0),
  };
  const records = props.map((p, i) => ({ rowIndex: i, props: p }));
  const ds = {
    findByProject: jest.fn(async () => ({ id: DS, fileChecksum: 'sum', rowCount: records.length, columns: cols, columnIssues: [] })),
    findById: jest.fn(async () => ({ id: DS, columns: cols })),
  };
  const recs = { listAllRecords: jest.fn(async () => records) };
  const h = new RunAnalysisHandler(projects() as never, ds as never, repo as never, recs as never, undefined as never, config() as never, undefined as never);
  await h.execute(P, { correlation_method: 'pearson', outlier_method: 'iqr', top_n: 50 }, 'u1');
  return repo.saveResult.mock.calls[0]?.[0] as {
    dq_summary: { duplicateRowCount: number; columns: { column: string; missingCount: number; invalidCount: number }[] };
    correlationMatrix: { columns: string[]; excludedColumns: { column: string; reason: string }[] };
    imbalance: { status: string; labelColumn: string | null; classCount: number; imbalanceRatio: number | null };
    suspicions: { kind: string; column: string }[];
  };
}

describe('AK-01 / AK-02 (K1): worker AI thử lại khi AI trả không phải JSON', () => {
  function setup(attempt: number) {
    const job = { id: JOB, analysisRunId: RUN, projectId: P, datasetId: DS, status: 'running', attempt, modelId: null };
    const prevAssessment = { status: 'pending', notablePairs: [], highVif: [], limits: [], nextSteps: [] };
    const repo = {
      findJobById: jest.fn(async () => job),
      updateJobById: jest.fn(async (_id: string, _update: Record<string, unknown>) => null),
      heartbeatJob: jest.fn(async () => null),
      findResultByRun: jest.fn(async () => ({ id: RES, aiCorrelationAssessment: prevAssessment })),
      updateResultById: jest.fn(async () => null),
    };
    const promptHandler = { execute: jest.fn(async () => 'prompt') };
    const ingestHandler = { execute: jest.fn(async () => ({ status: 'failed' })) };
    const inference = { complete: jest.fn(async () => ({ text: 'khong phai json', modelId: null, durationMs: 1 })) };
    const guard = { check: jest.fn(), canAcceptAiJob: jest.fn(() => true), blockReason: jest.fn(() => null) };
    const worker = new AiWorkerService(repo as never, promptHandler as never, ingestHandler as never, inference as never, config({ AI_MAX_RETRIES: 2 }) as never, guard as never);
    const processJob = (id: string) => (worker as unknown as { processJob(id: string): Promise<void> }).processJob(id);
    return { repo, ingestHandler, processJob };
  }

  it('AK-01: còn lượt → job pending, attempt+1, không gọi ingest, không ghi đánh giá AI', async () => {
    const { repo, ingestHandler, processJob } = setup(0);
    await processJob(JOB);
    expect(repo.updateJobById.mock.calls.at(-1)?.[1]).toMatchObject({ status: 'pending', attempt: 1, error: { code: 'AI_RETRY' } });
    expect(ingestHandler.execute).not.toHaveBeenCalled();
    expect(repo.updateResultById).not.toHaveBeenCalled();
  });

  it('AK-02: hết lượt → job failed AI_FAILED; đánh giá AI failed ghi thẳng vào kết quả, không qua grounding', async () => {
    const { repo, ingestHandler, processJob } = setup(2);
    await processJob(JOB);
    expect(repo.updateJobById.mock.calls.at(-1)?.[1]).toMatchObject({ status: 'failed', attempt: 3, error: { code: 'AI_FAILED' } });
    expect(ingestHandler.execute).not.toHaveBeenCalled();
    expect(repo.updateResultById).toHaveBeenCalledWith(RES, {
      aiCorrelationAssessment: expect.objectContaining({ status: 'failed', error: expect.stringContaining('AI_FAILED') }),
    });
  });
});

describe('AK-03 / AK-04 (K2): cột ngày trong DQ-01..04', () => {
  // dòng 0 và 1 chỉ khác cột ngày; dòng 2 trống ngày; dòng 3 ngày không tồn tại
  const cols = [col(0, 'pickup', 'date'), col(1, 'fare', 'number'), col(2, 'color', 'string')];
  const props = Array.from({ length: 12 }, (_, i) => ({
    c0: i === 2 ? null : i === 3 ? '2019-02-30 10:00:00' : `2019-03-${String(10 + i).padStart(2, '0')} 08:00:00`,
    c1: i <= 1 ? 10 : 10 + i,
    c2: i <= 1 ? 'yellow' : ['yellow', 'green'][i % 2],
  }));

  it('AK-03: cột ngày có trong dq_summary (trống → DQ-01, ngày không tồn tại → DQ-03); vẫn loại khỏi tương quan', async () => {
    const saved = await runOn(cols, props);
    expect(saved.dq_summary.columns.map((c) => c.column)).toEqual(['pickup', 'fare', 'color']);
    expect(saved.dq_summary.columns.find((c) => c.column === 'pickup')).toMatchObject({ missingCount: 1, invalidCount: 1 });
    expect(saved.correlationMatrix.columns).not.toContain('pickup');
    expect(saved.correlationMatrix.excludedColumns).toEqual(
      expect.arrayContaining([{ column: 'pickup', reason: 'date_column_excluded_from_correlation_vif' }]),
    );
  });

  it('AK-04: hai dòng chỉ khác cột ngày → không báo trùng', async () => {
    const saved = await runOn(cols, props);
    expect(saved.dq_summary.duplicateRowCount).toBe(0);
  });
});

describe('AK-05 (K3): mức DQ-04 trong Tổng kết theo outlierBreakdown', () => {
  const summaryFor = async (breakdown: Record<string, number> | undefined) => {
    const result = {
      id: RES, analysisRunId: RUN, projectId: P, inputFingerprint: 'fp', isStale: false, staleReason: null, createdAt: new Date(),
      dq_summary: {
        totalScanned: 100, duplicateRowCount: 0, notes: [],
        columns: [{ column: 'fare', missingCount: 0, missingRate: 0, invalidCount: 0, invalidRate: 0, outlierCount: 5, outlierRate: 0.05, ...(breakdown ? { outlierBreakdown: breakdown } : {}) }],
      },
    };
    const repo = {
      findLatestRunByProject: jest.fn(async () => ({ id: RUN, projectId: P, status: 'succeeded', config: { top_n: 50 } })),
      findResultByRun: jest.fn(async () => result),
      countEvidencesByRun: jest.fn(async () => 0),
      createSave: jest.fn(async (d: Record<string, unknown>) => ({ id: 's1', ...d })),
      markSavesStale: jest.fn(async () => undefined),
    };
    const out = await new CreateSummaryHandler(projects() as never, repo as never).execute(P);
    const issues = (out.summary as { issues: { dq: string; severity: string }[] }).issues;
    return issues.find((i) => i.dq === 'DQ-04')?.severity;
  };

  it('cả IQR và Modified-Z → Cao; IQR 3× → Trung bình; chỉ IQR 1,5× → Thấp; không có phân rã → Thấp', async () => {
    expect(await summaryFor({ iqr: 5, iqrExtreme: 2, zscore: 3, both: 3 })).toBe('high');
    expect(await summaryFor({ iqr: 5, iqrExtreme: 2, zscore: 0, both: 0 })).toBe('medium');
    expect(await summaryFor({ iqr: 5, iqrExtreme: 0, zscore: 0, both: 0 })).toBe('low');
    expect(await summaryFor(undefined)).toBe('low');
  });
});

describe('AK-06 (K4): nhãn số vai trò phân loại', () => {
  it('evaluateImbalance: cột số vai trò category → evaluated; vai trò khác / không truyền → not_applicable_continuous', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ target: i < 87 ? 0 : 1 }));
    const im = evaluateImbalance('target', 'number', rows, 'category');
    expect(im).toMatchObject({ status: 'evaluated', classCount: 2, largest: ['0'], smallest: ['1'] });
    expect(im.imbalanceRatio).toBeCloseTo(87 / 13, 3);
    expect(evaluateImbalance('target', 'number', rows, 'measure').status).toBe('not_applicable_continuous');
    expect(evaluateImbalance('target', 'number', rows).status).toBe('not_applicable_continuous');
    expect(evaluateImbalance('d', 'date', [{ d: '2024-01-01' }], 'category').status).toBe('not_applicable_continuous');
  });

  it('chạy phân tích: nhãn tự suy là cột số 0/1 → đánh giá mất cân bằng', async () => {
    const cols = [col(0, 'patient_id', 'number'), col(1, 'age', 'number'), col(2, 'target', 'number')];
    const props = Array.from({ length: 400 }, (_, i) => ({ c0: i + 1, c1: 30 + ((i * 7) % 47), c2: i < 346 ? 0 : 1 }));
    const saved = await runOn(cols, props);
    expect(saved.imbalance).toMatchObject({ status: 'evaluated', labelColumn: 'target', classCount: 2 });
    expect(saved.imbalance.imbalanceRatio).toBeCloseTo(346 / 54, 3);
  });
});

describe('AK-07 (K5): worker PDF nhận job kèm lease', () => {
  it('tick() gọi claimPendingReport với lease 600000 ms', async () => {
    const repo = { claimPendingReport: jest.fn(async () => null) };
    const worker = new ReportWorkerService(repo as never, {} as never, config() as never);
    await worker.tick();
    expect(repo.claimPendingReport).toHaveBeenCalledWith(600000);
  });
});
