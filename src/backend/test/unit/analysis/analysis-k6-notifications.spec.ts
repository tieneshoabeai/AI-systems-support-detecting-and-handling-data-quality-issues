/**
 * K6 — thông báo cho người chạy phân tích (Phần 13 v18 mục 3.31, NTT-02 → NTT-06).
 * Quy tắc: Phần 9 v7 mục 3.14 · Phần 7 v16 mục 3.26 NT-1…NT-7.
 *
 * Dùng `AnalysisNotifierService` thật + port giả (notifications / users / realtime),
 * để kiểm cả đường gọi `dispatchNotificationViaPorts`.
 */
import { RunAnalysisHandler } from '../../../src/modules/analysis/application/commands/run-analysis.handler';
import { IngestAiResultHandler } from '../../../src/modules/analysis/application/commands/ingest-ai-result.handler';
import { AiWorkerService } from '../../../src/modules/analysis/application/services/ai-worker.service';
import { AnalysisNotifierService } from '../../../src/modules/analysis/application/services/analysis-notifier.service';

const P = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const WS = 'cccccccccccccccccccccccc';
const DS = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const RUN = 'dddddddddddddddddddddddd';
const JOB = 'eeeeeeeeeeeeeeeeeeeeeeee';
const RES = 'ffffffffffffffffffffffff';
const USER = '111111111111111111111111';

const config = (vals: Record<string, unknown> = {}) => ({ get: jest.fn((k: string) => vals[k]) });

function notifierWith(opts: { startedBy?: string | null; enabled?: boolean; createFails?: boolean } = {}) {
  const created: Record<string, unknown>[] = [];
  const notifications = {
    createIfEventNotExists: jest.fn(async (doc: Record<string, unknown>) => {
      if (opts.createFails) throw new Error('mongo down');
      created.push(doc);
      return { id: `ntf${created.length}`, type: doc.type };
    }),
  };
  const users = { findById: jest.fn(async () => ({ id: USER, notificationsEnabled: opts.enabled ?? true })) };
  const runRepo = {
    findById: jest.fn(async () => ({ id: RUN, startedBy: opts.startedBy === undefined ? USER : opts.startedBy })),
  };
  const realtime = { emitToUser: jest.fn() };
  const notifier = new AnalysisNotifierService(
    notifications as never,
    users as never,
    runRepo as never,
    realtime as never,
  );
  return { notifier, notifications, users, realtime, created };
}

/** RunAnalysisHandler trên dữ liệu nhỏ trong bộ nhớ (khuôn `analysis-dot-k.spec.ts`). */
function runHandler(notifier: AnalysisNotifierService, opts: { startedBy?: string | null; failSave?: boolean } = {}) {
  let stored: Record<string, unknown> | null = null;
  const repo = {
    findRunByFingerprint: jest.fn(async () => null),
    create: jest.fn(async (d: Record<string, unknown>) => ({
      id: RUN, projectId: P, workspaceId: WS, datasetId: DS, status: 'running', ...d,
      ...(opts.startedBy !== undefined ? { startedBy: opts.startedBy } : {}),
    })),
    updateById: jest.fn(async () => null),
    insertEvidences: jest.fn(async () => 0),
    saveResult: jest.fn(async (d: Record<string, unknown>) => {
      if (opts.failSave) throw new Error('E11000 noi bo: connection reset at 10.0.0.5:27017');
      return (stored = { id: RES, analysisRunId: RUN, projectId: P, ...d });
    }),
    findResultByRun: jest.fn(async () => stored),
    createJob: jest.fn(async () => ({ id: JOB })),
    markResultsStale: jest.fn(async () => undefined),
    findById: jest.fn(async () => null),
    countEvidencesByRun: jest.fn(async () => 0),
  };
  const cols = [
    { key: 'c0', index: 0, name: 'age', dataType: 'number', originalName: 'age', missingCount: 0, isPii: false },
    { key: 'c1', index: 1, name: 'city', dataType: 'string', originalName: 'city', missingCount: 0, isPii: false },
  ];
  const records = Array.from({ length: 12 }, (_, i) => ({ rowIndex: i, props: { c0: 20 + i, c1: i % 2 ? 'HN' : 'HCM' } }));
  const ds = {
    findByProject: jest.fn(async () => ({ id: DS, name: 'titanic.csv', fileChecksum: 'sum', rowCount: records.length, columns: cols, columnIssues: [] })),
    findById: jest.fn(async () => ({ id: DS, columns: cols })),
  };
  const recs = {
    listAllRecords: jest.fn(async () => records),
  };
  const projects = {
    getProjectById: jest.fn(async (id: string) => ({ id, workspaceId: WS })),
    resolveUserProjectRole: jest.fn(async () => 'owner'),
    setHasDataset: jest.fn(async () => true),
  };
  const h = new RunAnalysisHandler(
    projects as never, ds as never, repo as never, recs as never,
    undefined as never, config() as never, undefined as never, notifier,
  );
  return () => h.execute(P, { correlation_method: 'pearson', outlier_method: 'iqr', top_n: 50 }, USER);
}

describe('NTT-02 / NTT-03 / NTT-04 — RunAnalysisHandler', () => {
  it('NTT-02: lần phân tích thành công → analysis_completed cho started_by, payload + sourceEventId đúng, có realtime', async () => {
    const n = notifierWith();
    await runHandler(n.notifier)();
    expect(n.notifications.createIfEventNotExists).toHaveBeenCalledTimes(1);
    expect(n.created[0]).toMatchObject({
      userId: USER,
      type: 'analysis_completed',
      isMandatory: false,
      sourceEventId: `analysis_completed:${RUN}`,
      payload: { targetType: 'analysis_run', targetId: RUN, actionUrl: null },
    });
    expect(n.created[0]?.summary).toContain('titanic.csv');
    expect(n.realtime.emitToUser).toHaveBeenCalledWith(USER, 'notification.created', {
      notificationId: 'ntf1',
      notificationType: 'analysis_completed',
    });
  });

  it('NTT-03: lần phân tích lỗi → analysis_failed, summary không chứa thông điệp lỗi gốc; vẫn ném lỗi gốc', async () => {
    const n = notifierWith();
    await expect(runHandler(n.notifier, { failSave: true })()).rejects.toThrow(/connection reset/);
    expect(n.created).toHaveLength(1);
    expect(n.created[0]).toMatchObject({ type: 'analysis_failed', sourceEventId: `analysis_failed:${RUN}` });
    expect(String(n.created[0]?.summary)).toContain('ANALYSIS_FAILED');
    expect(String(n.created[0]?.summary)).not.toMatch(/connection reset|10\.0\.0\.5|E11000/);
  });

  it('NTT-04: started_by = null → không tạo thông báo', async () => {
    const n = notifierWith();
    await runHandler(n.notifier, { startedBy: null })();
    expect(n.notifications.createIfEventNotExists).not.toHaveBeenCalled();
  });

  it('NTT-04: tạo thông báo lỗi → lần phân tích vẫn trả kết quả', async () => {
    const n = notifierWith({ createFails: true });
    const res = await runHandler(n.notifier)();
    expect(res).toMatchObject({ analysisRunId: RUN });
    expect(n.realtime.emitToUser).not.toHaveBeenCalled();
  });

  it('NTT-04: người dùng tắt thông báo → không tạo (3 loại không bắt buộc)', async () => {
    const n = notifierWith({ enabled: false });
    await runHandler(n.notifier)();
    expect(n.notifications.createIfEventNotExists).not.toHaveBeenCalled();
  });

  it('không có notifier (module/test cũ) → chạy như trước', async () => {
    const h = runHandler(undefined as never);
    await expect(h()).resolves.toMatchObject({ analysisRunId: RUN });
  });
});

describe('NTT-05 — IngestAiResultHandler', () => {
  const job = { id: JOB, analysisRunId: RUN, projectId: P, status: 'running', attempt: 1, modelId: 'm' };
  const repo = () => ({
    findJobById: jest.fn(async () => job),
    findResultByRun: jest.fn(async () => ({ id: RES, correlationMatrix: { cells: [] }, vif: { rows: [] } })),
    updateJobById: jest.fn(async () => job),
    updateResultById: jest.fn(async () => ({ aiCorrelationAssessment: { status: 'succeeded' } })),
  });

  it('grounding đạt → ai_analysis_ready "đã sẵn sàng", sourceEventId theo jobId + attempt', async () => {
    const n = notifierWith();
    const h = new IngestAiResultHandler(repo() as never, undefined as never, undefined, n.notifier);
    const r = await h.execute(JOB, {}, 'm');
    expect(r.status).toBe('succeeded');
    expect(n.created[0]).toMatchObject({
      userId: USER,
      type: 'ai_analysis_ready',
      title: 'Nhận xét AI đã sẵn sàng',
      sourceEventId: `ai_analysis_ready:${JOB}:1`,
      payload: { targetType: 'analysis_run', targetId: RUN },
    });
  });

  it('grounding không đạt → ai_analysis_ready báo thất bại kèm AI_GROUNDING_FAILED', async () => {
    const n = notifierWith();
    const h = new IngestAiResultHandler(repo() as never, undefined as never, undefined, n.notifier);
    const r = await h.execute(JOB, 'khong-phai-object', 'm');
    expect(r.status).toBe('failed');
    expect(n.created[0]).toMatchObject({ type: 'ai_analysis_ready', title: 'Phần nhận xét AI thất bại' });
    expect(String(n.created[0]?.summary)).toContain('AI_GROUNDING_FAILED');
  });

  it('job đã bị thay thế (skipped) → không thông báo', async () => {
    const n = notifierWith();
    const r = repo();
    r.findJobById.mockResolvedValueOnce({ ...job, status: 'skipped' });
    const h = new IngestAiResultHandler(r as never, undefined as never, undefined, n.notifier);
    await h.execute(JOB, {}, 'm');
    expect(n.notifications.createIfEventNotExists).not.toHaveBeenCalled();
  });
});

describe('NTT-06 — AiWorkerService', () => {
  function worker(attempt: number, n: ReturnType<typeof notifierWith>) {
    const job = { id: JOB, analysisRunId: RUN, projectId: P, datasetId: DS, status: 'running', attempt, modelId: null };
    const repo = {
      findJobById: jest.fn(async () => job),
      updateJobById: jest.fn(async () => null),
      heartbeatJob: jest.fn(async () => null),
      findResultByRun: jest.fn(async () => ({ id: RES, aiCorrelationAssessment: { status: 'pending' } })),
      updateResultById: jest.fn(async () => null),
    };
    const w = new AiWorkerService(
      repo as never,
      { execute: jest.fn(async () => 'prompt') } as never,
      { execute: jest.fn(async () => ({ status: 'failed' })) } as never,
      { complete: jest.fn(async () => ({ text: 'khong phai json', modelId: null, durationMs: 1 })) } as never,
      config({ AI_MAX_RETRIES: 2 }) as never,
      { check: jest.fn(), canAcceptAiJob: jest.fn(() => true), blockReason: jest.fn(() => null) } as never,
      n.notifier,
    );
    return () => (w as unknown as { processJob(id: string): Promise<void> }).processJob(JOB);
  }

  it('hết lượt → ai_analysis_ready báo AI_FAILED, sourceEventId theo lượt mới', async () => {
    const n = notifierWith();
    await worker(2, n)();
    expect(n.created).toHaveLength(1);
    expect(n.created[0]).toMatchObject({ type: 'ai_analysis_ready', sourceEventId: `ai_analysis_ready:${JOB}:3` });
    expect(String(n.created[0]?.summary)).toContain('AI_FAILED');
  });

  it('còn lượt (job về pending) → không thông báo', async () => {
    const n = notifierWith();
    await worker(0, n)();
    expect(n.notifications.createIfEventNotExists).not.toHaveBeenCalled();
  });
});
