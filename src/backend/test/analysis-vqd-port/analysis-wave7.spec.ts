/**
 * PORT từ nhánh Vqd_BE @8969ee3 — test/analysis-wave7.spec.ts (Phần 13 v14 mục 3.26).
 * Chỉ đổi import/khởi tạo sang `./legacy-analysis-facade` (handler mới); assert giữ nguyên (TC-01).
 * Chỉ giữ các test còn đúng với code hiện hành; test không port ghi lý do tại chỗ ([Nhóm A — không port]).
 */
/**
 * Phan 13 v9 muc 3.22 — test AN-22 → AN-33 cho dot F module analysis
 * (vai tro cot, che PII theo vai tro, mau o loi, duong cheo, PDF tam giac tren).
 * Mock noi bo, khong qua HTTP/CASL.
 */
import { RemovedServicePlaceholder as ProjectAccessService } from './legacy-analysis-facade';
import { RemovedServicePlaceholder as StalenessService } from './legacy-analysis-facade';
import { LegacyAnalysisService as AnalysisService } from './legacy-analysis-facade';
import { buildReportSections } from '../../src/modules/analysis/application/report-content.util';
import { inferColumnRoles, nameTokens } from '../../src/modules/analysis/domain/column-role.util';
import { maskForAi, toShapePattern } from '../../src/modules/analysis/domain/pii-mask.util';
import { buildCorrV1Prompt, upperTriangleCells, type CorrCell } from '../../src/modules/analysis/domain/ai-grounding.util';
import { computeInputFingerprint, type ResolvedRunConfig } from '../../src/modules/analysis/domain/input-fingerprint.util';
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
const col = (i: number, name: string, dataType: Col['dataType'], isPii = false): Col => ({ key: `c${i}`, index: i, name, dataType, originalName: name, missingCount: 0, isPii });

/** Du lieu kieu Titanic 60 dong: Age co 1 o sai kieu ('abc'), 2 o thieu, 1 ngoai le (400). */
const N = 60;
const titanicCols = (piiAge = false): Col[] => [
  col(0, 'PassengerId', 'number'),
  col(1, 'Survived', 'number'),
  col(2, 'Pclass', 'number'),
  col(3, 'Name', 'string'),
  col(4, 'Sex', 'string'),
  col(5, 'Age', 'number', piiAge),
  col(6, 'Ticket', 'string'),
  col(7, 'Fare', 'number'),
  col(8, 'Embarked', 'string'),
];
const ageOf = (i: number): unknown => (i === 3 ? 'abc' : i === 10 || i === 11 ? null : i === 59 ? 400 : 20 + ((i * 7) % 41));
const titanicProps = (i: number): Record<string, unknown> => ({
  c0: i + 1,
  c1: i % 3 === 0 ? 1 : 0,
  c2: (i % 3) + 1,
  c3: `Braund, Mr. Owen ${i}`,
  c4: i % 2 ? 'male' : 'female',
  c5: ageOf(i),
  c6: `A/5 ${21171 + i}`,
  c7: Number((5 + i * 1.37).toFixed(2)),
  c8: ['S', 'C', 'Q'][i % 3],
});
const recordRows = Array.from({ length: N }, (_, i) => ({ rowIndex: i, props: titanicProps(i) }));
const namedRows = recordRows.map((r) => {
  const out: Record<string, unknown> = {};
  for (const c of titanicCols()) out[c.name] = r.props[c.key];
  return out;
});

const projects = () => ({ getProjectById: jest.fn(async (id: string) => ({ id, workspaceId: WS })), resolveUserProjectRole: jest.fn(async () => 'member') });
const workspaces = () => ({ resolveUserWorkspaceRole: jest.fn(async () => 'member') });
const cfg = () => ({ get: jest.fn(() => undefined) });
function result(over: Partial<AnalysisResultRecord> = {}): AnalysisResultRecord {
  return { id: RES, analysisRunId: RUN, projectId: P, inputFingerprint: 'fp', isStale: false, staleReason: null, createdAt: new Date(), ...over };
}
function run(over: Partial<AnalysisRunRecord> = {}): AnalysisRunRecord {
  return {
    id: RUN, projectId: P, workspaceId: WS, datasetId: DS, status: 'running', inputFingerprint: 'fp', config: {},
    startedBy: 'u1', startedAt: null, finishedAt: null, durationMs: null, error: null, createdAt: new Date(), updatedAt: new Date(), ...over,
  };
}

function setup(opts: { cols?: Col[]; storedRoles?: Record<string, string> } = {}) {
  const cols = opts.cols ?? titanicCols();
  const stored = {
    projectId: P, workspaceId: WS, selectedColumns: null, labelColumn: 'c4', timeColumn: null, timeGranularity: 'day',
    valueColumn: null, topN: 50, chartTopN: 5, columnRoles: opts.storedRoles ?? {},
  };
  const repo: FakeRepo = {
    findConfigByProject: jest.fn(async () => stored),
    upsertConfig: jest.fn(async (_p: string, _w: string, d: Record<string, unknown>) => ({ ...stored, columnRoles: d.column_roles ?? stored.columnRoles })),
    create: jest.fn(async () => run()),
    updateById: jest.fn(),
    insertEvidences: jest.fn(async () => 0),
    saveResult: jest.fn(async (d: Record<string, unknown>) => ({ ...result(), ...d, id: RES })),
    findResultByRun: jest.fn(async () => result()),
    createJob: jest.fn(async () => ({ id: JOB })),
    markResultsStale: jest.fn(),
    findById: jest.fn(async () => run()),
  };
  const ds = { findByProject: jest.fn(async () => ({ id: DS, fileChecksum: 'sum', rowCount: N, columns: cols })), findById: jest.fn(async () => ({ id: DS, columns: cols })) };
  const records = { listAllRecords: jest.fn(async () => recordRows) };
  const access = new ProjectAccessService(projects() as never, workspaces() as never);
  const svc = new AnalysisService(repo as never, projects() as never, ds as never, records as never, cfg() as never, access, new StalenessService(repo as never, ds as never));
  return { svc, repo, ds, records };
}
const runDto = { correlation_method: 'pearson' as const, outlier_method: 'iqr' as const, top_n: 50 };

type SavedResult = {
  column_roles: { key: string; name: string; role: string; source: string; uncertain: boolean }[];
  ai_samples: Record<string, string[]>;
  correlationMatrix: { columns: string[]; cells: CorrCell[]; excludedColumns: { column: string; reason: string }[] };
  vif: { columns: string[] };
  dq_summary: { columns: { column: string; outlierCount: number; outlierSkippedReason: string | null }[] };
};
async function runAndGet(opts: Parameters<typeof setup>[0] = {}) {
  const s = setup(opts);
  await s.svc.runAnalysis(P, runDto, 'u1');
  const saved = s.repo.saveResult?.mock.calls[0]?.[0] as SavedResult;
  const evidences = s.repo.insertEvidences?.mock.calls[0]?.[0] as { column: string; kind: string; value_masked: string | null }[];
  return { ...s, saved, evidences };
}

describe('AN-22 / AN-23: vai tro cot', () => {
  it('AN-22: suy vai tro tren du lieu kieu Titanic', () => {
    const roles = inferColumnRoles(titanicCols(), namedRows);
    const by = Object.fromEntries(roles.map((r) => [r.name, r]));
    expect(by.PassengerId?.role).toBe('identifier');
    expect(by.Name?.role).toBe('text');
    expect(by.Ticket?.role).toBe('text');
    for (const c of ['Survived', 'Pclass', 'Sex', 'Embarked']) expect(by[c]?.role).toBe('category');
    expect(by.Age?.role).toBe('measure');
    expect(by.Fare?.role).toBe('measure');
    expect(by.Pclass?.uncertain).toBe(true); // so ma hoa phan loai
    expect(by.Age?.uncertain).toBe(false);
    expect(roles.every((r) => r.source === 'system')).toBe(true);
  });

  it('AN-22b: khong suy dinh danh chi tu ten cot; token tach dung camelCase', () => {
    expect(nameTokens('PassengerId')).toEqual(['passenger', 'id']);
    const rows = Array.from({ length: 40 }, (_, i) => ({ user_id: i % 4 }));
    const [r] = inferColumnRoles([{ key: 'c0', name: 'user_id', dataType: 'number' }], rows);
    expect(r?.role).not.toBe('identifier');
    expect(r?.uncertain).toBe(true);
  });

  // [Nhóm A — không port] AN-23: OPEN-06 bỏ `column_roles` (ghi đè vai trò cột) — vai trò chỉ còn tự suy.

  // [Nhóm A — không port] AN-23b: như AN-23.
});

describe('AN-24 / AN-25 / AN-26: dung vai tro cho tuong quan, VIF, DQ-04', () => {
  it('AN-24: loai dinh danh/van ban khoi tuong quan kem ly do; Survived~Sex dung Cramer V', async () => {
    const { saved } = await runAndGet();
    expect(saved.correlationMatrix.excludedColumns).toEqual(
      expect.arrayContaining([
        { column: 'PassengerId', reason: 'identifier_column_excluded' },
        { column: 'Name', reason: 'free_text_column_excluded' },
        { column: 'Ticket', reason: 'free_text_column_excluded' },
      ]),
    );
    expect(saved.correlationMatrix.columns).toEqual(['Survived', 'Pclass', 'Sex', 'Age', 'Fare', 'Embarked']);
    const cell = saved.correlationMatrix.cells.find((c) => c.colA === 'Survived' && c.colB === 'Sex');
    expect(cell?.kind).toBe('cramers_v');
  });

  it('AN-25: VIF chi tren cot dinh luong, khong co nhan / dinh danh', async () => {
    const { saved } = await runAndGet();
    expect(saved.vif.columns).toEqual(['Age', 'Fare']);
  });

  // [Nhóm A — không port] AN-26: thay đổi thiết kế của nhánh `backend`, chấp nhận (analysis_plan mục 7i). Khác biệt: DQ-04 không còn ghi `outlierSkippedReason: not_measure_column` cho cột phân loại/định danh (đợt F).
});

describe('AN-27 / AN-28 / AN-29: che PII theo vai tro + mau o loi', () => {
  it('AN-27: maskForAi theo tung truong hop', () => {
    expect(maskForAi('Owen', { markedPii: true, role: 'category' })?.value).toBe('***');
    expect(maskForAi('a.b@c.vn', { markedPii: false, role: 'category' })?.value).toBe('***');
    expect(maskForAi('Braund, Mr. Owen', { markedPii: false, role: 'text' })?.value).toBe('Aaaaaa, Aa. Aaaa');
    expect(maskForAi('A/5 21171', { markedPii: false, role: 'identifier' })?.value).toBe('A/d ddddd');
    expect(maskForAi('male', { markedPii: false, role: 'category' })?.value).toBe('male');
    expect(maskForAi('x'.repeat(60), { markedPii: false, role: 'category' })?.value).toHaveLength(40);
    expect(toShapePattern('Đỗ Văn 9')).toBe('Aa Aaa d');
  });

  // [Nhóm A — không port] AN-28: thay đổi thiết kế của nhánh `backend`, chấp nhận (analysis_plan mục 7i). Khác biệt: không còn lưu `ai_samples` = ô lỗi; prompt lấy 20 giá trị đầu bất kỳ (đợt F).

  it('AN-28b: bieu do theo vai tro — khong Top N cho dinh danh/van ban/cot PII', async () => {
    const plain = await runAndGet();
    const charts = (plain.repo.saveResult?.mock.calls[0]?.[0] as { charts: { histograms: { column: string }[]; categories: { column: string }[] } }).charts;
    expect(charts.histograms.map((h) => h.column)).toEqual(['Age', 'Fare']);
    expect(charts.categories.map((c) => c.column)).toEqual(['Survived', 'Pclass', 'Sex', 'Embarked']);
    const pii = await runAndGet({ cols: titanicCols().map((c) => (c.name === 'Sex' ? { ...c, isPii: true } : c)) });
    const piiCharts = (pii.repo.saveResult?.mock.calls[0]?.[0] as { charts: { categories: { column: string }[] } }).charts;
    expect(piiCharts.categories.map((c) => c.column)).not.toContain('Sex');
  });

  // [Nhóm A — không port] AN-29: thay đổi thiết kế của nhánh `backend`, chấp nhận (analysis_plan mục 7i). Khác biệt: như AN-28 — không còn `ai_samples` theo chính sách che PII (đợt F).
});

describe('AN-30 / AN-31 / AN-32: duong cheo + tam giac tren', () => {
  const cellOf = (a: string, b: string, coef: number): CorrCell => ({
    colA: a, colB: b, coef, kind: 'pearson', n: 10, totalScanned: 10, missingAOnly: 0, missingBOnly: 0, missingBoth: 0, computable: true, reason: null,
  });
  const names = ['a', 'b', 'c'];
  const coef: Record<string, number> = { 'a|b': 0.2, 'a|c': -0.9, 'b|c': 0.5 };
  const full: CorrCell[] = names.flatMap((x) => names.map((y) => cellOf(x, y, x === y ? 1 : coef[[x, y].sort().join('|')] ?? 0)));

  // [Nhóm A — không port] AN-30: thay đổi thiết kế của nhánh `backend`, chấp nhận (analysis_plan mục 7i). Khác biệt: `groundAiAssessment` không còn loại cặp đường chéo X~X (đợt F).

  it('AN-31: prompt chi co tam giac tren', () => {
    expect(upperTriangleCells(full).map((c) => `${c.colA}${c.colB}`)).toEqual(['ab', 'ac', 'bc']);
    const prompt = buildCorrV1Prompt({ columns: [], cells: full, vif: null, maskedSamples: {}, method: 'pearson', excludedColumns: [] });
    const line = prompt.split('\n').find((l) => l.startsWith('Ma trận')) ?? '';
    const cells = JSON.parse(line.slice(line.indexOf('['))) as CorrCell[];
    expect(cells).toHaveLength(3);
    expect(cells.some((c) => c.colA === c.colB)).toBe(false);
  });

  // [Nhóm A — không port] AN-31b: thay đổi thiết kế của nhánh `backend`, chấp nhận (analysis_plan mục 7i). Khác biệt: prompt không còn dùng `aiSamples` (ô lỗi) đã lưu (đợt F).

  it('AN-32: bang PDF moi cap mot lan, khong duong cheo, xep theo |he so|', () => {
    const sections = buildReportSections({
      projectId: P,
      save: { id: 's1', projectId: P, analysisRunId: RUN, inputFingerprint: 'fp', summary: {}, isStale: false, createdAt: new Date() },
      result: result({
        correlationMatrix: { method: 'pearson', columns: names, cells: full, excludedColumns: [], totalScanned: 10 } as never,
        columnRoles: [{ name: 'a', role: 'measure', source: 'system', uncertain: false }],
      }),
      evidences: [],
      topN: 50,
    });
    const sec = sections.find((s) => s.heading === '4. Ma trận tương quan');
    expect(sec?.table?.rows.map((r) => `${r[0]}${r[1]}`)).toEqual(['ac', 'bc', 'ab']);
    expect(sec?.lines?.join(' ')).toContain('3 cặp');
    expect(sec?.lines?.join(' ')).toContain('a = measure');
  });
});

describe('AN-33: is_pii / column_roles lam ket qua loi thoi', () => {
  // OPEN-06: ResolvedRunConfig không còn `columnRoles` → helper bỏ tham số vai trò.
  const rc = (): ResolvedRunConfig => ({
    selectedKeys: ['c0', 'c1'], labelKey: null, timeKey: null, valueKey: null, correlationMethod: 'pearson', outlierMethod: 'iqr', topN: 50, timeGranularity: 'day',
  });
  const ds = (pii: boolean) => ({ id: DS, fileChecksum: 'x', rowCount: 3, columns: [col(0, 'a', 'number', pii), col(1, 'b', 'string')] });

  it('doi is_pii -> fingerprint doi', () => {
    expect(computeInputFingerprint(ds(false), rc())).not.toBe(computeInputFingerprint(ds(true), rc()));
  });
  // [Nhóm A — không port] doi column_roles -> fingerprint doi: OPEN-06 bỏ `column_roles` — `ResolvedRunConfig` không còn trường này.
  // [Nhóm A — không port] PATCH datasets/: OPEN-03 gỡ `PATCH datasets/{id}/columns`; cờ PII tự suy từ tên cột.
});
