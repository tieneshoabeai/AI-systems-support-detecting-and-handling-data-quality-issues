/**
 * PORT từ nhánh Vqd_BE @8969ee3 — test/analysis-wave8.spec.ts (Phần 13 v14 mục 3.26).
 * Chỉ đổi import/khởi tạo sang `./legacy-analysis-facade` (handler mới); assert giữ nguyên (TC-01).
 * Chỉ giữ các test còn đúng với code hiện hành; test không port ghi lý do tại chỗ ([Nhóm A — không port]).
 */
/**
 * Phan 13 v10 muc 3.23 — test AN-34 → AN-45 cho dot G module analysis
 * (cot ngay trong DQ, ngay hop le chat, nhom Nghi van, goi y nam/thang, vai tro so thap phan).
 * Mock noi bo, khong qua HTTP/CASL.
 */
import { RemovedServicePlaceholder as ProjectAccessService } from './legacy-analysis-facade';
import { RemovedServicePlaceholder as StalenessService } from './legacy-analysis-facade';
import { LegacyAnalysisService as AnalysisService } from './legacy-analysis-facade';
import { LegacySummaryService as SummaryService } from './legacy-analysis-facade';
import { buildReportSections } from '../../src/modules/analysis/application/report-content.util';
import { parseStrictDate, detectDayMonthOrder } from '../../src/modules/analysis/domain/date-parse.util';
import { detectSuspicions } from '../../src/modules/analysis/domain/suspicion.util';
import { inferColumnRole } from '../../src/modules/analysis/domain/column-role.util';
import { computeDq03 } from '../../src/modules/analysis/domain/dq.util';
import { isMissingToken } from '../../src/shared/domain/utils/missing-tokens.util';
import type { AnalysisResultRecord, AnalysisRunRecord } from '../../src/modules/analysis/domain/ports/analysis.repository.port';

const P = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const WS = 'cccccccccccccccccccccccc';
const RUN = 'dddddddddddddddddddddddd';
const DS = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const JOB = 'eeeeeeeeeeeeeeeeeeeeeeee';
const RES = 'ffffffffffffffffffffffff';

type Col = { key: string; index: number; name: string; dataType: 'string' | 'number' | 'boolean' | 'date'; originalName: string; missingCount: number; isPii: boolean };
const col = (i: number, name: string, dataType: Col['dataType'], isPii = false): Col => ({ key: `c${i}`, index: i, name, dataType, originalName: name, missingCount: 0, isPii });

function result(over: Partial<AnalysisResultRecord> = {}): AnalysisResultRecord {
  return { id: RES, analysisRunId: RUN, projectId: P, inputFingerprint: 'fp', isStale: false, staleReason: null, createdAt: new Date(), ...over };
}
function run(over: Partial<AnalysisRunRecord> = {}): AnalysisRunRecord {
  return {
    id: RUN, projectId: P, workspaceId: WS, datasetId: DS, status: 'running', inputFingerprint: 'fp', config: {},
    startedBy: 'u1', startedAt: null, finishedAt: null, durationMs: null, error: null, createdAt: new Date(), updatedAt: new Date(), ...over,
  };
}
const projects = () => ({ getProjectById: jest.fn(async (id: string) => ({ id, workspaceId: WS })), resolveUserProjectRole: jest.fn(async () => 'member') });
const workspaces = () => ({ resolveUserWorkspaceRole: jest.fn(async () => 'member') });

/** Du lieu kieu taxis: 2 cot ngay + so tien + mau xe + tien te (hang). */
const taxiCols = [col(0, 'pickup', 'date'), col(1, 'dropoff', 'date'), col(2, 'fare', 'number'), col(3, 'color', 'string'), col(4, 'currency', 'string')];
const COLORS = ['yellow', 'green', 'yellow', 'green', 'yellow', 'green', 'yellow', 'NA', '?', 'Yellow', ' green ', 'yellow', 'green', 'yellow'];
const FARES: unknown[] = [10, 10, 12, 7.5, 8, 9, 11, 13, 6, 14, '?', -999, -999, 9.5];
const taxiProps = (i: number): Record<string, unknown> => ({
  // dong 0 va 1 chi khac nhau o pickup/dropoff → KHONG phai dong trung
  c0: i === 2 ? null : i === 3 ? '2019-02-30 10:00:00' : `2019-03-${String(10 + i).padStart(2, '0')} 08:00:00`,
  c1: `2019-03-${String(10 + i).padStart(2, '0')} 08:30:00`,
  c2: FARES[i],
  c3: i === 1 ? COLORS[0] : COLORS[i],
  c4: 'USD',
});
const taxiRecords = Array.from({ length: 14 }, (_, i) => ({ rowIndex: i, props: taxiProps(i) }));

function setup(cols: Col[] = taxiCols, records = taxiRecords) {
  const stored = { projectId: P, workspaceId: WS, selectedColumns: null, labelColumn: null, timeColumn: null, timeGranularity: 'day', valueColumn: null, topN: 50, chartTopN: 5, columnRoles: {} };
  const repo: Record<string, jest.Mock> = {
    findConfigByProject: jest.fn(async () => stored),
    create: jest.fn(async () => run()),
    updateById: jest.fn(),
    insertEvidences: jest.fn(async () => 0),
    saveResult: jest.fn(async (d: Record<string, unknown>) => ({ ...result(), ...d, id: RES })),
    findResultByRun: jest.fn(async () => result()),
    createJob: jest.fn(async () => ({ id: JOB })),
    markResultsStale: jest.fn(),
    findById: jest.fn(async () => run()),
  };
  const ds = { findByProject: jest.fn(async () => ({ id: DS, fileChecksum: 'sum', rowCount: records.length, columns: cols })), findById: jest.fn(async () => ({ id: DS, columns: cols })) };
  const recs = { listAllRecords: jest.fn(async () => records) };
  const access = new ProjectAccessService(projects() as never, workspaces() as never);
  const svc = new AnalysisService(repo as never, projects() as never, ds as never, recs as never, { get: jest.fn(() => undefined) } as never, access, new StalenessService(repo as never, ds as never));
  return { svc, repo };
}
type Saved = {
  dq_summary: { columns: { column: string; missingCount: number; invalidCount: number }[]; duplicateRowCount: number };
  suspicions: { kind: string; column: string; count: number; examples: string[] }[];
  correlationMatrix: { columns: string[]; excludedColumns: { column: string; reason: string }[] };
};
async function runTaxis() {
  const s = setup();
  const api = await s.svc.runAnalysis(P, { correlation_method: 'pearson', outlier_method: 'iqr', top_n: 50 }, 'u1');
  return { ...s, api, saved: s.repo.saveResult?.mock.calls[0]?.[0] as Saved };
}

describe('AN-34 / AN-35: cot ngay trong DQ', () => {
  // [Nhóm A — không port] AN-34: lỗi thật K2 — sửa ở đợt K; test mới viết theo hành vi hiện hành ở `test/analysis-dot-k.spec.ts` (assert cũ gắn cơ chế đã đổi). Chi tiết: cột ngày bị loại khỏi DQ-01..04 (`classifyColumn(date) = excluded`) (đợt G).
  // [Nhóm A — không port] AN-35: lỗi thật K2 — sửa ở đợt K; test mới viết theo hành vi hiện hành ở `test/analysis-dot-k.spec.ts` (assert cũ gắn cơ chế đã đổi). Chi tiết: như AN-34 — bỏ cột ngày nên hai dòng chỉ khác ngày bị báo trùng (đợt G).
});

describe('AN-36 / AN-37: ngay hop le chat', () => {
  it('AN-36: dinh dang hop le; ngay khong ton tai / chuoi tu do la sai', () => {
    for (const v of ['2019-03-23', '2019/03/23', '2019-03-23 20:21:09', '2019-03-23T20:21:09.123Z', '2019-03-23T20:21:09+07:00', '23/03/2019', '23-03-2019 08:15']) {
      expect(parseStrictDate(v).ok).toBe(true);
    }
    expect(parseStrictDate('2019-02-30')).toEqual({ ok: false, reason: 'nonexistent_date' });
    expect(parseStrictDate('2019-13-45 99:99:99')).toEqual({ ok: false, reason: 'nonexistent_date' });
    expect(parseStrictDate('2020-02-29').ok).toBe(true); // nam nhuan
    expect(parseStrictDate('March 5')).toEqual({ ok: false, reason: 'invalid_date_format' });
    const tz = parseStrictDate('2019-03-23T20:00:00+07:00');
    expect(tz.ok && tz.date.toISOString()).toBe('2019-03-23T13:00:00.000Z');
  });
  it('AN-37: phan dinh DD/MM, MM/DD, mo ho, mau thuan; mo ho → nghi van', () => {
    expect(detectDayMonthOrder(['23/03/2019', '01/02/2019'])).toBe('dmy');
    expect(detectDayMonthOrder(['03/23/2019', '01/02/2019'])).toBe('mdy');
    expect(detectDayMonthOrder(['03/04/2019', '01/02/2019'])).toBe('ambiguous');
    expect(detectDayMonthOrder(['23/03/2019', '03/23/2019'])).toBe('conflict');
    expect(detectDayMonthOrder(['2019-03-04'])).toBeNull();
    expect(parseStrictDate('03/23/2019', 'dmy').ok).toBe(false);
    expect(parseStrictDate('03/23/2019', 'mdy').ok).toBe(true);
    const s = detectSuspicions([{ name: 'd', dataType: 'date', role: 'datetime', isPii: false }], [{ d: '03/04/2019' }, { d: '01/02/2019' }]);
    expect(s.map((x) => x.kind)).toEqual(['ambiguous_date_format']);
  });
});

describe('AN-38: ky hieu thieu', () => {
  it('cot chu: NA/? khong vao DQ-03 + nghi van missing_token; cot so: ? vao DQ-03', async () => {
    const { saved } = await runTaxis();
    const by = Object.fromEntries(saved.dq_summary.columns.map((c) => [c.column, c]));
    expect(by.color?.invalidCount).toBe(0);
    expect(by.fare?.invalidCount).toBe(1);
    const mt = saved.suspicions.find((x) => x.kind === 'missing_token' && x.column === 'color');
    expect(mt).toMatchObject({ count: 2 });
    expect(mt?.examples.join(' ')).toContain('"?"');
    expect(isMissingToken(' N/A ')).toBe(true);
    expect(isMissingToken('')).toBe(false);
    const dq = computeDq03([{ column: 'x', dataType: 'string' }, { column: 'y', dataType: 'number' }], [
      { rowIndex: 0, values: { x: 'NA', y: 'NA' } }, { rowIndex: 1, values: { x: 'a', y: '?' } },
    ]);
    expect(dq.map((d) => d.invalidCount)).toEqual([0, 2]);
  });
});

describe('AN-39 / AN-40: hoa/thuong, khoang trang, sentinel, cot hang', () => {
  it('AN-39 + AN-40 tren du lieu taxis', async () => {
    const { saved } = await runTaxis();
    const kinds = saved.suspicions.map((x) => `${x.kind}:${x.column}`);
    expect(kinds).toEqual(expect.arrayContaining(['case_variant:color', 'whitespace:color', 'sentinel:fare', 'constant_column:currency']));
    expect(saved.suspicions.find((x) => x.kind === 'sentinel')).toMatchObject({ count: 2 });
    expect(saved.suspicions.find((x) => x.kind === 'case_variant')?.examples[0]).toMatch(/yellow ×\d+ \/ Yellow ×1/);
  });
  it('sentinel xuat hien 1 lan o cot co gia tri am khac → khong bao (dot H: cot khong am van bao, xem AN-56)', () => {
    const rows = [1, 2, 3, 4, 5, 6, -3, -999].map((v) => ({ v }));
    expect(detectSuspicions([{ name: 'v', dataType: 'number', role: 'measure', isPii: false }], rows)).toEqual([]);
  });
});

describe('AN-41 / AN-42: Tong ket + PDF, che PII', () => {
  const susp = [{ kind: 'case_variant', column: 'color', count: 1, rate: 0.07, examples: ['yellow ×7 / Yellow ×1'], message: 'msg', recommendation: 'rec' }];
  it('AN-41: Tong ket co suspicions tach khoi issues; PDF co muc 3b', async () => {
    const res = result({
      dq_summary: { totalScanned: 14, duplicateRowCount: 0, notes: [], columns: [{ column: 'color', missingCount: 0, missingRate: 0, invalidCount: 0, invalidRate: 0, outlierCount: 0, outlierRate: 0 }] },
      dq05: { status: 'unassessed' },
      suspicions: susp,
    });
    const repo: Record<string, jest.Mock> = {
      findLatestRunByProject: jest.fn(async () => run({ status: 'succeeded', config: { top_n: 50 } })),
      findResultByRun: jest.fn(async () => res),
      countEvidencesByRun: jest.fn(async () => 0),
      createSave: jest.fn(async (d: Record<string, unknown>) => ({ id: 's1', summary: d.summary })),
      markSavesStale: jest.fn(),
    };
    const out = await new SummaryService(repo as never, projects() as never, new StalenessService(repo as never, {} as never)).createSummary(P);
    const s = out.summary as { suspicions: unknown[]; issues: { dq: string }[] };
    expect(s.suspicions).toEqual(susp);
    expect(s.issues.every((i) => i.dq.startsWith('DQ-'))).toBe(true);
    const sections = buildReportSections({ projectId: P, save: { id: 's1', projectId: P, analysisRunId: RUN, inputFingerprint: 'fp', summary: s, isStale: false, createdAt: new Date() }, result: res, evidences: [], topN: 50 });
    const sec = sections.find((x) => x.heading.startsWith('3b.'));
    expect(sec?.table?.rows[0]).toEqual(['Nhiều cách viết', 'color', '1', '7.00%', 'yellow ×7 / Yellow ×1']);
  });
  it('AN-42: vi du nghi van duoc che theo chinh sach PII', () => {
    const rows = [{ n: ' Nguyen Van A ' }, { n: 'Tran B' }, { n: 'Le C' }];
    const pii = detectSuspicions([{ name: 'n', dataType: 'string', role: 'text', isPii: true }], rows);
    expect(pii.find((x) => x.kind === 'whitespace')?.examples).toEqual(['***']);
    const shaped = detectSuspicions([{ name: 'n', dataType: 'string', role: 'text', isPii: false }], rows);
    expect(shaped.find((x) => x.kind === 'whitespace')?.examples).toEqual(['Aaaaaa Aaa A']);
  });
});

describe('AN-43 / AN-44 / AN-45', () => {
  // [Nhóm A — không port] AN-43: thay đổi thiết kế của nhánh `backend`, chấp nhận (analysis_plan mục 7i). Khác biệt: `detectTimePartColumns` + tham số `columns` của `analyzeTime` đã mất (đợt G).
  // [Nhóm A — không port] AN-43b: thay đổi thiết kế của nhánh `backend`, chấp nhận (analysis_plan mục 7i). Khác biệt: `analyzeTime` không còn ghi lý do `excluded_invalid_dates_N` (đợt G).
  it('AN-44: so thap phan it gia tri → measure; so nguyen it gia tri van category', () => {
    const tolls = Array.from({ length: 60 }, (_, i) => [0, 5.76, 6.12][i % 3]);
    expect(inferColumnRole({ key: 'c0', name: 'tolls', dataType: 'number' }, tolls, 60).role).toBe('measure');
    const pclass = Array.from({ length: 60 }, (_, i) => (i % 3) + 1);
    expect(inferColumnRole({ key: 'c1', name: 'Pclass', dataType: 'number' }, pclass, 60).role).toBe('category');
  });
  it('AN-45: API ket qua phan tich khong tra suspicions (chi luu noi bo)', async () => {
    const { api, saved } = await runTaxis();
    expect(saved.suspicions.length).toBeGreaterThan(0);
    expect(api).not.toHaveProperty('suspicions');
  });
});
