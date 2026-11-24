/**
 * PORT từ nhánh Vqd_BE @8969ee3 — test/analysis-wave10.spec.ts (Phần 13 v14 mục 3.26).
 * Chỉ đổi import/khởi tạo sang `./legacy-analysis-facade` (handler mới); assert giữ nguyên (TC-01).
 * Chỉ giữ các test còn đúng với code hiện hành; test không port ghi lý do tại chỗ ([Nhóm A — không port]).
 */
/**
 * Phan 13 v12 muc 3.25 — test AN-63 → AN-68 cho dot I module analysis
 * (tu phat hien mau thuan du lieu duoi dang Nghi van; DQ-05 van chua danh gia).
 * Mock noi bo, khong qua HTTP/CASL.
 */
import { RemovedServicePlaceholder as ProjectAccessService } from './legacy-analysis-facade';
import { RemovedServicePlaceholder as StalenessService } from './legacy-analysis-facade';
import { LegacyAnalysisService as AnalysisService } from './legacy-analysis-facade';
import { buildReportSections } from '../../../../src/modules/analysis/application/report-content.util';
import { detectSuspicions, type SuspicionColumn } from '../../../../src/modules/analysis/domain/suspicion.util';
import type { AnalysisResultRecord, AnalysisRunRecord } from '../../../../src/modules/analysis/domain/ports/analysis.repository.port';

const P = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const WS = 'cccccccccccccccccccccccc';
const RUN = 'dddddddddddddddddddddddd';
const DS = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const RES = 'ffffffffffffffffffffffff';

const sc = (name: string, dataType: string, role: SuspicionColumn['role']): SuspicionColumn => ({ name, dataType, role, isPii: false });
const kinds = (cols: SuspicionColumn[], rows: Record<string, unknown>[]) => detectSuspicions(cols, rows);
/** n gia tri duong 1..n (lap lai), thay mot so vi tri bang gia tri dac biet. */
const positives = (n: number, special: Record<number, number> = {}) => Array.from({ length: n }, (_, i) => ({ v: special[i] ?? 10 + (i % 17) }));

describe('AN-63 / AN-64 / AN-68: gia tri am / bang 0 trong cot gan nhu toan duong', () => {
  it('AN-63: so am ≤ 5% → bao; > 5% → khong; sentinel -999 khong bi bao trung', () => {
    const few = kinds([sc('v', 'number', 'measure')], positives(100, { 3: -2, 50: -7 }));
    expect(few.find((x) => x.kind === 'negative_in_positive')).toMatchObject({ column: 'v', count: 2 });
    const many = kinds([sc('v', 'number', 'measure')], positives(100, Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i * 3, -5]))));
    expect(many.some((x) => x.kind === 'negative_in_positive')).toBe(false);
    const sent = kinds([sc('v', 'number', 'measure')], positives(100, { 1: -999, 2: -999, 3: -999 }));
    expect(sent.some((x) => x.kind === 'sentinel')).toBe(true);
    expect(sent.some((x) => x.kind === 'negative_in_positive')).toBe(false);
  });

  it('AN-64: so 0 ≤ 3% → bao; nhieu so 0 → khong; cot so phan loai → bao; cot dinh danh → khong', () => {
    const z = kinds([sc('distance', 'number', 'measure')], positives(200, { 5: 0, 9: 0 }).map((r) => ({ distance: r.v })));
    expect(z.find((x) => x.kind === 'zero_in_positive')).toMatchObject({ column: 'distance', count: 2 });
    const tips = Array.from({ length: 100 }, (_, i) => ({ tip: i % 3 === 0 ? 0 : 2 + (i % 5) }));
    expect(kinds([sc('tip', 'number', 'measure')], tips).some((x) => x.kind === 'zero_in_positive')).toBe(false);
    const cat = positives(100, { 1: 0 });
    // cot so vai tro phan loai (vd passengers 0–6) van duoc xet dau
    expect(kinds([sc('v', 'number', 'category')], cat).some((x) => x.kind === 'zero_in_positive')).toBe(true);
    expect(kinds([sc('v', 'number', 'identifier')], cat).some((x) => x.kind === 'zero_in_positive')).toBe(false);
  });

  it('AN-68: cot < 20 gia tri → khong bao dau', () => {
    expect(kinds([sc('v', 'number', 'measure')], positives(15, { 1: -3, 2: 0 })).some((x) => x.kind === 'negative_in_positive' || x.kind === 'zero_in_positive')).toBe(false);
  });
});

describe('AN-65 / AN-66', () => {
  it('AN-65: dong trong moi cot dinh luong → bao dung so dong; 1 cot dinh luong → khong', () => {
    const rows = Array.from({ length: 30 }, (_, i) => (i === 3 || i === 20
      ? { species: 'Adelie', bill: '', mass: '' }
      : { species: 'Adelie', bill: 40 + (i % 9), mass: 3000 + i * 10 }));
    const cols = [sc('species', 'string', 'category'), sc('bill', 'number', 'measure'), sc('mass', 'number', 'measure')];
    expect(kinds(cols, rows).find((x) => x.kind === 'row_all_measures_missing')).toMatchObject({ count: 2, examples: ['dòng 4', 'dòng 21'] });
    expect(kinds([sc('species', 'string', 'category'), sc('bill', 'number', 'measure')], rows).some((x) => x.kind === 'row_all_measures_missing')).toBe(false);
  });

  it('AN-66: missing_in_filled_group bao o trong o nhom gan nhu luon co gia tri; khong co mau thieu theo nhom thi khong bao', () => {
    const rows = [
      ...Array.from({ length: 40 }, (_, i) => ({ status: 'paid', paid_at: i < 2 ? '' : '2024-01-02' })),
      ...Array.from({ length: 10 }, () => ({ status: 'pending', paid_at: '' })),
      ...Array.from({ length: 10 }, () => ({ status: 'cancelled', paid_at: '' })),
    ];
    const cols = [sc('status', 'string', 'category'), sc('paid_at', 'date', 'datetime')];
    const out = kinds(cols, rows);
    expect(out.find((x) => x.kind === 'conditional_missing')).toBeDefined();
    expect(out.find((x) => x.kind === 'missing_in_filled_group')).toMatchObject({ column: 'paid_at', count: 2, examples: ['status = paid: 2/40 ô trống'] });
    // trong ngau nhien o moi nhom → khong co mau thieu theo nhom → khong bao
    const random = Array.from({ length: 60 }, (_, i) => ({ status: ['a', 'b', 'c'][i % 3], paid_at: i % 4 === 0 ? '' : 'x' }));
    expect(kinds(cols, random).some((x) => x.kind === 'missing_in_filled_group')).toBe(false);
  });
});

describe('AN-67: DQ-05 van chua danh gia; Nghi van chi o Tong ket + PDF', () => {
  it('API ket qua khong co suspicions, dq05 unassessed; PDF co nhan moi', async () => {
    const cols = [
      { key: 'c0', index: 0, name: 'x', dataType: 'number' as const, originalName: 'x', missingCount: 0, isPii: false },
      { key: 'c1', index: 1, name: 'y', dataType: 'number' as const, originalName: 'y', missingCount: 0, isPii: false },
    ];
    const records = Array.from({ length: 60 }, (_, i) => ({ rowIndex: i, props: { c0: i === 7 ? 0 : 4 + (i % 11) * 0.37, c1: i === 9 ? -3 : 2 + (i % 13) * 0.53 } }));
    const stored = { projectId: P, workspaceId: WS, selectedColumns: null, labelColumn: null, timeColumn: null, timeGranularity: 'month', valueColumn: null, topN: 50, chartTopN: 5, columnRoles: {} };
    const run: AnalysisRunRecord = {
      id: RUN, projectId: P, workspaceId: WS, datasetId: DS, status: 'running', inputFingerprint: 'fp', config: {},
      startedBy: 'u1', startedAt: null, finishedAt: null, durationMs: null, error: null, createdAt: new Date(), updatedAt: new Date(),
    };
    const result = { id: RES, analysisRunId: RUN, projectId: P, inputFingerprint: 'fp', isStale: false, staleReason: null, createdAt: new Date() } as AnalysisResultRecord;
    const repo: Record<string, jest.Mock> = {
      findConfigByProject: jest.fn(async () => stored), create: jest.fn(async () => run), updateById: jest.fn(),
      insertEvidences: jest.fn(async () => 0), saveResult: jest.fn(async (d: Record<string, unknown>) => ({ ...result, ...d })),
      findResultByRun: jest.fn(async () => result), createJob: jest.fn(async () => ({ id: 'j' })), markResultsStale: jest.fn(), findById: jest.fn(async () => run),
    };
    const ds = { findByProject: jest.fn(async () => ({ id: DS, fileChecksum: 's', rowCount: records.length, columns: cols })), findById: jest.fn(async () => ({ id: DS, columns: cols })) };
    const projects = { getProjectById: jest.fn(async (id: string) => ({ id, workspaceId: WS })), resolveUserProjectRole: jest.fn(async () => 'member') };
    const access = new ProjectAccessService(projects as never, { resolveUserWorkspaceRole: jest.fn(async () => 'member') } as never);
    const svc = new AnalysisService(repo as never, projects as never, ds as never, { listAllRecords: jest.fn(async () => records) } as never, { get: jest.fn(() => undefined) } as never, access, new StalenessService(repo as never, ds as never));
    const api = await svc.runAnalysis(P, { correlation_method: 'pearson', outlier_method: 'iqr', top_n: 50 }, 'u1');
    expect(api).not.toHaveProperty('suspicions');
    const saved = repo.saveResult?.mock.calls[0]?.[0] as { dq05: { status: string }; suspicions: { kind: string; column: string }[] };
    expect(saved.dq05.status).toBe('unassessed');
    expect(saved.suspicions.map((x) => `${x.kind}:${x.column}`)).toEqual(expect.arrayContaining(['zero_in_positive:x', 'negative_in_positive:y']));
    const sections = buildReportSections({
      projectId: P, save: { id: 's1', projectId: P, analysisRunId: RUN, inputFingerprint: 'fp', summary: { suspicions: saved.suspicions }, isStale: false, createdAt: new Date() },
      result, evidences: [], topN: 50,
    });
    const labels = (sections.find((x) => x.heading.startsWith('3b.'))?.table?.rows ?? []).map((r) => r[0]);
    expect(labels).toEqual(expect.arrayContaining(['Giá trị âm bất thường', 'Giá trị 0 bất thường']));
  });
});
