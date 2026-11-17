/**
 * Phan 13 v8 muc 3.20 — test AN-01 → AN-10 cho dot hoan thien module analysis (2026-11-17).
 * Dung fake repository/service (khong can Mongo) de kiem hanh vi tang application.
 */
import * as fs from 'fs';
import * as zlib from 'zlib';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SummaryService } from '../src/modules/analysis/application/summary.service';
import { AnalysisService } from '../src/modules/analysis/application/analysis.service';
import { ReportWorkerService } from '../src/modules/analysis/application/report-worker.service';
import { AiWorkerService } from '../src/modules/analysis/application/services/ai-worker.service';
import { buildReportPdf, parseTrueType } from '../src/modules/analysis/application/pdf-builder.util';
import { buildReportSections } from '../src/modules/analysis/application/report-content.util';
import { resolveTopN } from '../src/modules/analysis/domain/top-n.util';
import type {
  AiJobRecord,
  AnalysisResultRecord,
  AnalysisRunRecord,
  ProjectSaveRecord,
  ReportJobRecord,
} from '../src/modules/analysis/domain/ports/analysis.repository.port';

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

function analysisService(repo: FakeRepo, proj = projects(), ws = workspaces()): AnalysisService {
  return new AnalysisService(repo as never, proj as never, {} as never, {} as never, config() as never, ws as never);
}

describe('AN-01 / AN-10: SUMMARY-01 chan ket qua stale + top_n', () => {
  it('AN-01: ket qua stale -> 409 ANALYSIS_RESULT_STALE, khong tao Tong ket', async () => {
    const repo: FakeRepo = {
      findLatestRunByProject: jest.fn(async () => run()),
      findResultByRun: jest.fn(async () => result({ isStale: true, staleReason: 'config_changed' })),
      createSave: jest.fn(),
    };
    const svc = new SummaryService(repo as never, projects() as never);
    const err = await svc.createSummary(P).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ error: 'ANALYSIS_RESULT_STALE', details: { staleReason: 'config_changed' } });
    expect(repo.createSave).not.toHaveBeenCalled();
  });

  it('AN-10: top_n cua lan chay gioi han so phat hien', async () => {
    const repo: FakeRepo = {
      findLatestRunByProject: jest.fn(async () => run({ config: { top_n: 5 } })),
      findResultByRun: jest.fn(async () => result()),
      findConfigByProject: jest.fn(),
      countEvidencesByRun: jest.fn(async () => 0),
      createSave: jest.fn(async (d: Record<string, unknown>) => ({ ...save('s1'), summary: d.summary })),
      markSavesStale: jest.fn(),
    };
    const out = await new SummaryService(repo as never, projects() as never).createSummary(P);
    const summary = out.summary as { issues: unknown[]; top_n: number };
    expect(summary.issues).toHaveLength(5);
    expect(summary.top_n).toBe(5);
  });

  it('resolveTopN: mac dinh 50, chan tren 500', () => {
    expect(resolveTopN(undefined)).toBe(50);
    expect(resolveTopN(0)).toBe(50);
    expect(resolveTopN(7)).toBe(7);
    expect(resolveTopN(9999)).toBe(500);
  });
});

describe('AN-02 / AN-06 / AN-07: AnalysisService', () => {
  it('AN-02: getResult tra isStale/staleReason', async () => {
    const repo: FakeRepo = {
      findLatestRunByProject: jest.fn(async () => run()),
      findResultByRun: jest.fn(async () => result({ isStale: true, staleReason: 'config_changed' })),
    };
    const out = await analysisService(repo).getResult(P);
    expect(out).toMatchObject({ isStale: true, staleReason: 'config_changed' });
  });

  it.each(['succeeded', 'running', 'pending'] as const)('AN-06: retry job %s -> 409 AI_JOB_NOT_RETRYABLE', async (status) => {
    const repo: FakeRepo = { findJobById: jest.fn(async () => job({ status })), updateJobById: jest.fn() };
    const err = await analysisService(repo).retryJob(JOB).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ error: 'AI_JOB_NOT_RETRYABLE' });
    expect(repo.updateJobById).not.toHaveBeenCalled();
  });

  it('AN-07: retry khi ket qua stale -> 409 ANALYSIS_RESULT_STALE', async () => {
    const repo: FakeRepo = {
      findJobById: jest.fn(async () => job()),
      findResultByRun: jest.fn(async () => result({ isStale: true, staleReason: 'config_changed' })),
      updateJobById: jest.fn(),
    };
    const err = await analysisService(repo).retryJob(JOB).catch((e: unknown) => e);
    expect((err as ConflictException).getResponse()).toMatchObject({ error: 'ANALYSIS_RESULT_STALE' });
    expect(repo.updateJobById).not.toHaveBeenCalled();
  });

  it('retry hop le: job failed + ket qua con hieu luc -> pending, attempt+1', async () => {
    const repo: FakeRepo = {
      findJobById: jest.fn(async () => job({ status: 'failed', attempt: 1 })),
      findResultByRun: jest.fn(async () => result()),
      updateJobById: jest.fn(async () => job({ status: 'pending', attempt: 2 })),
    };
    const out = await analysisService(repo).retryJob(JOB);
    expect(out).toMatchObject({ status: 'pending', attempt: 2 });
  });
});

describe('AN-08: phan quyen route job theo project', () => {
  const repo: FakeRepo = { findJobById: jest.fn(async () => job()) };

  it('nguoi ngoai project -> 404 (khong lo su ton tai)', async () => {
    const svc = analysisService(repo, projects(null), workspaces(null));
    await expect(svc.assertJobAccess(JOB, { userId: 'u1', role: 'analyst' })).rejects.toBeInstanceOf(NotFoundException);
  });
  it('viewer duoc xem nhung khong duoc thu lai', async () => {
    const svc = analysisService(repo, projects('viewer'), workspaces('member'));
    await expect(svc.assertJobAccess(JOB, { userId: 'u1', role: 'analyst' })).resolves.toBeUndefined();
    await expect(svc.assertJobAccess(JOB, { userId: 'u1', role: 'analyst' }, true)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('member duoc thu lai; SYS-ADMIN bo qua kiem tra', async () => {
    await expect(analysisService(repo, projects('member')).assertJobAccess(JOB, { userId: 'u1', role: 'analyst' }, true)).resolves.toBeUndefined();
    const proj = projects(null);
    await expect(analysisService(repo, proj).assertJobAccess(JOB, { userId: 'a', role: 'admin' }, true)).resolves.toBeUndefined();
    expect(proj.getProjectById).not.toHaveBeenCalled();
  });
  it('job khong ton tai -> 404', async () => {
    const svc = analysisService({ findJobById: jest.fn(async () => null) });
    await expect(svc.assertJobAccess(JOB, { userId: 'u1' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AN-04 / AN-05: AI worker khong mat luot retry khi loi JSON', () => {
  function setup(attempt: number) {
    const repo: FakeRepo = {
      findJobById: jest.fn(async () => job({ status: 'running', attempt })),
      updateJobById: jest.fn(),
      heartbeatJob: jest.fn(),
    };
    const analysis = { buildPromptForJob: jest.fn(async () => 'prompt'), ingestAiResult: jest.fn(async () => ({ status: 'failed' })) };
    const inference = { complete: jest.fn(async () => ({ text: 'khong phai json', modelId: null, durationMs: 1 })) };
    const worker = new AiWorkerService(repo as never, analysis as never, inference as never, config({ AI_MAX_RETRIES: 2 }) as never);
    return { repo, analysis, worker };
  }
  const process = (w: AiWorkerService, id: string): Promise<void> =>
    (w as unknown as { processJob(id: string): Promise<void> }).processJob(id);

  it('AN-04: con luot -> pending, attempt+1, khong ghi danh gia failed', async () => {
    const { repo, analysis, worker } = setup(0);
    await process(worker, JOB);
    const last = repo.updateJobById.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(last).toMatchObject({ status: 'pending', attempt: 1 });
    expect(analysis.ingestAiResult).not.toHaveBeenCalled();
  });
  it('AN-05: het luot -> danh gia failed roi job failed voi ma loi goc AI_FAILED', async () => {
    const { repo, analysis, worker } = setup(2);
    await process(worker, JOB);
    expect(analysis.ingestAiResult).toHaveBeenCalledTimes(1);
    const last = repo.updateJobById.mock.calls.at(-1)?.[1] as { status: string; error: { code: string } };
    expect(last.status).toBe('failed');
    expect(last.error.code).toBe('AI_FAILED');
  });
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
    expect(repo.updateReportById.mock.calls.at(-1)?.[1]).toMatchObject({ status: 'succeeded' });
    expect(storage.uploadStream).toHaveBeenCalledTimes(1);
  });
  it('save thuoc project khac -> failed REPORT_BUILD_FAILED', async () => {
    const { repo, worker } = setup(reportJob({ projectId: P_OTHER }));
    await worker.buildPdf('r1');
    expect(repo.updateReportById.mock.calls.at(-1)?.[1]).toMatchObject({ status: 'failed', error: { code: 'REPORT_BUILD_FAILED' } });
  });
  it('AN-09: moi tick thu hoi job PDF ket truoc khi claim (lease)', async () => {
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

  it('che do ASCII (khong font): PDF hop le, nhieu trang, co so trang', () => {
    const pdf = buildReportPdf({ title: 'Báo cáo', sections: [...sections, { heading: 'Dài', table: { headers: ['x'], rows: Array.from({ length: 200 }, (_, i) => [`dòng ${i}`]) } }] });
    const s = pdf.toString('latin1');
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(s).toContain('/BaseFont /Helvetica');
    expect(Number(/\/Count (\d+)/.exec(s)?.[1])).toBeGreaterThan(1);
  });

  it('che do ASCII: ky hieu (η², ≥, ·, •) duoc thay bang ASCII, khong thanh "?"', () => {
    const s = buildReportPdf({ title: 'x', sections }).toString('latin1');
    const text = [...s.matchAll(/stream\n([\s\S]*?)\nendstream/g)]
      .map((m) => zlib.inflateSync(Buffer.from(m[1] as string, 'latin1')).toString('latin1'))
      .join('\n');
    expect(text).toContain('eta2');
    expect(text).toContain('IR >= 3');
    expect(text).not.toMatch(/\(\?|\?\?/);
  });

  it('font khong hop le -> parseTrueType null, PDF van sinh (ASCII)', () => {
    expect(parseTrueType(Buffer.from('not a font'))).toBeNull();
    const pdf = buildReportPdf({ title: 'x', sections, font: Buffer.from('not a font') });
    expect(pdf.toString('latin1')).toContain('/Helvetica');
  });

  const fontPath = ['/System/Library/Fonts/Supplemental/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'].find((p) => fs.existsSync(p));
  (fontPath ? it : it.skip)('che do Unicode: nhung TTF Identity-H + ToUnicode, glyph tieng Viet co that', () => {
    const font = fs.readFileSync(fontPath as string);
    const ttf = parseTrueType(font);
    expect(ttf).not.toBeNull();
    for (const ch of 'ạếữđƯ') expect(ttf?.glyphFor(ch.codePointAt(0) as number)).toBeGreaterThan(0);
    const s = buildReportPdf({ title: 'Báo cáo Tổng kết', sections, font }).toString('latin1');
    expect(s).toContain('/Subtype /Type0');
    expect(s).toContain('/Encoding /Identity-H');
    expect(s).toContain('/FontFile2');
    expect(s).toContain('/ToUnicode');
  });
});
