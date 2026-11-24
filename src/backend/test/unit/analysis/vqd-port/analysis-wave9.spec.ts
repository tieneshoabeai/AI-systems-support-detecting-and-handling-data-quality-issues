/**
 * PORT từ nhánh Vqd_BE @8969ee3 — test/analysis-wave9.spec.ts (Phần 13 v14 mục 3.26).
 * Chỉ đổi import/khởi tạo sang `./legacy-analysis-facade` (handler mới); assert giữ nguyên (TC-01).
 * Chỉ giữ các test còn đúng với code hiện hành; test không port ghi lý do tại chỗ ([Nhóm A — không port]).
 */
/**
 * Phan 13 v11 muc 3.24 — test AN-46 → AN-62 cho dot H module analysis
 * (nhan theo vai tro, mot dinh nghia thieu cho cot chu, Nghi van mo rong, giai thich DQ-03/DQ-04/thoi gian).
 * Mock noi bo, khong qua HTTP/CASL.
 */
import { RemovedServicePlaceholder as ProjectAccessService } from './legacy-analysis-facade';
import { RemovedServicePlaceholder as StalenessService } from './legacy-analysis-facade';
import { LegacyAnalysisService as AnalysisService } from './legacy-analysis-facade';
import { detectSuspicions, type SuspicionColumn } from '../../../../src/modules/analysis/domain/suspicion.util';
import { evaluateImbalance } from '../../../../src/modules/analysis/domain/stats.util';
import { computePairCell } from '../../../../src/modules/analysis/domain/correlation.util';
import { issueExplanation } from '../../../../src/modules/analysis/domain/impact.util';
import type { AnalysisResultRecord, AnalysisRunRecord } from '../../../../src/modules/analysis/domain/ports/analysis.repository.port';

const P = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const WS = 'cccccccccccccccccccccccc';
const RUN = 'dddddddddddddddddddddddd';
const DS = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const JOB = 'eeeeeeeeeeeeeeeeeeeeeeee';
const RES = 'ffffffffffffffffffffffff';

type Col = { key: string; index: number; name: string; dataType: 'string' | 'number' | 'boolean' | 'date'; originalName: string; missingCount: number; isPii: boolean };
const col = (i: number, name: string, dataType: Col['dataType']): Col => ({ key: `c${i}`, index: i, name, dataType, originalName: name, missingCount: 0, isPii: false });

function result(over: Record<string, unknown> = {}): AnalysisResultRecord {
  return { id: RES, analysisRunId: RUN, projectId: P, inputFingerprint: 'fp', isStale: false, staleReason: null, createdAt: new Date(), ...over } as AnalysisResultRecord;
}
function run(over: Partial<AnalysisRunRecord> = {}): AnalysisRunRecord {
  return {
    id: RUN, projectId: P, workspaceId: WS, datasetId: DS, status: 'running', inputFingerprint: 'fp', config: {},
    startedBy: 'u1', startedAt: null, finishedAt: null, durationMs: null, error: null, createdAt: new Date(), updatedAt: new Date(), ...over,
  };
}
const projects = () => ({ getProjectById: jest.fn(async (id: string) => ({ id, workspaceId: WS })), resolveUserProjectRole: jest.fn(async () => 'member') });
const workspaces = () => ({ resolveUserWorkspaceRole: jest.fn(async () => 'member') });

function setup(cols: Col[], props: Record<string, unknown>[], cfg: Record<string, unknown> = {}) {
  const stored = { projectId: P, workspaceId: WS, selectedColumns: null, labelColumn: null, timeColumn: null, timeGranularity: 'month', valueColumn: null, topN: 50, chartTopN: 5, columnRoles: {}, ...cfg };
  const repo: Record<string, jest.Mock> = {
    findConfigByProject: jest.fn(async () => stored),
    upsertConfig: jest.fn(async (_p: string, _w: string, d: Record<string, unknown>) => ({ ...stored, ...d })),
    create: jest.fn(async () => run()),
    updateById: jest.fn(),
    insertEvidences: jest.fn(async () => 0),
    saveResult: jest.fn(async (d: Record<string, unknown>) => ({ ...result(), ...d, id: RES })),
    findResultByRun: jest.fn(async () => result()),
    createJob: jest.fn(async () => ({ id: JOB })),
    markResultsStale: jest.fn(),
    findById: jest.fn(async () => run()),
  };
  const records = props.map((p, i) => ({ rowIndex: i, props: p }));
  const ds = { findByProject: jest.fn(async () => ({ id: DS, fileChecksum: 'sum', rowCount: records.length, columns: cols })), findById: jest.fn(async () => ({ id: DS, columns: cols })) };
  const recs = { listAllRecords: jest.fn(async () => records) };
  const access = new ProjectAccessService(projects() as never, workspaces() as never);
  const svc = new AnalysisService(repo as never, projects() as never, ds as never, recs as never, { get: jest.fn(() => undefined) } as never, access, new StalenessService(repo as never, ds as never));
  return { svc, repo };
}
/** Truy cap long nhau vao ket qua luu (Mixed) trong test. */
interface Api { [k: string]: Api }
async function runWith(cols: Col[], props: Record<string, unknown>[], cfg: Record<string, unknown> = {}) {
  const s = setup(cols, props, cfg);
  const api = (await s.svc.runAnalysis(P, { correlation_method: 'pearson', outlier_method: 'iqr', top_n: 50 }, 'u1')) as unknown as Api;
  return { ...s, api, saved: s.repo.saveResult?.mock.calls[0]?.[0] as Api };
}


describe('AN-46 → AN-48: cot nhan theo vai tro', () => {
  // [Nhóm A — không port] AN-46: OPEN-06 gỡ saveConfig — cột nhãn tự suy.

  // [Nhóm A — không port] AN-47: lỗi thật K4 — sửa ở đợt K; test mới viết theo hành vi hiện hành ở `test/analysis-dot-k.spec.ts` (assert cũ gắn cơ chế đã đổi). Chi tiết: nhãn số 0/1 vai trò category bị coi là liên tục → không đánh giá mất cân bằng (đợt H).

  // [Nhóm A — không port] AN-48: OPEN-06 — không còn chọn cột nhãn / ghi đè vai trò để dựng các trường hợp này.
});

describe('AN-49 / AN-50: mot dinh nghia thieu cho cot chu', () => {
  const countries = ['IN', 'NA', 'VN', 'NA', 'JP', 'IN', 'VN', 'NA', 'JP', 'IN'];
  it('AN-49: cot chu co "NA" → mat can bang du lop, tuong quan du dong', async () => {
    const im = evaluateImbalance('country', 'string', countries.map((country) => ({ country })));
    expect(im).toMatchObject({ status: 'evaluated', classCount: 4, missingLabelRows: 0, validRows: 10 });
    const cols = [col(0, 'country', 'string'), col(1, 'score', 'number')];
    const props = countries.map((c, i) => ({ c0: c, c1: 10 + i }));
    const { saved } = await runWith(cols, props, { labelColumn: 'c0' });
    const cell = (saved.correlationMatrix?.cells as unknown as Api[]).find((x) => String(x.colA) === 'country' && String(x.colB) === 'score');
    expect(cell?.n).toBe(10);
  });

  it('AN-50: cot so co "?" van bi loai khoi tuong quan; cot chu khong co co text thi van loai ky hieu', () => {
    const rows = [1, 2, '?', 4, 5, 6].map((v, i) => ({ a: v, b: i * 2 }));
    expect(computePairCell({ colA: 'a', roleA: 'numeric', colB: 'b', roleB: 'numeric', rows }, 'pearson').n).toBe(5);
    const cat = [{ k: 'NA', v: 1 }, { k: 'x', v: 2 }, { k: 'x', v: 3 }, { k: 'NA', v: 4 }, { k: 'y', v: 5 }];
    expect(computePairCell({ colA: 'k', roleA: 'categorical', colB: 'v', roleB: 'numeric', rows: cat, textA: true }, 'pearson').n).toBe(5);
    expect(computePairCell({ colA: 'k', roleA: 'categorical', colB: 'v', roleB: 'numeric', rows: cat }, 'pearson').n).toBe(3);
  });
});

const sc = (name: string, dataType: string, role: SuspicionColumn['role']): SuspicionColumn => ({ name, dataType, role, isPii: false });

describe('AN-51 → AN-56: Nghi van moi', () => {
  it('AN-51: identifier_not_unique', () => {
    const rows = ['100001', '100002', '100004', '100004', '100005', '100006', '100006'].map((order_id) => ({ order_id }));
    const s = detectSuspicions([sc('order_id', 'number', 'identifier')], rows).find((x) => x.kind === 'identifier_not_unique');
    expect(s).toMatchObject({ column: 'order_id', count: 4 });
    expect(s?.examples).toHaveLength(2);
  });

  it('AN-52: duplicate_key (email khac hoa/thuong + cung phone); dong giong het khong bao o day', () => {
    const cols = [sc('customer_id', 'number', 'identifier'), sc('email', 'string', 'text'), sc('phone', 'number', 'identifier')];
    const rows = [
      { customer_id: 1001, email: 'u0@x.com', phone: '0915' },
      { customer_id: 2001, email: ' U0@X.COM ', phone: '0915' },
      { customer_id: 1003, email: 'u3@x.com', phone: '0999' },
      { customer_id: 1003, email: 'u3@x.com', phone: '0999' },
      { customer_id: 1004, email: 'u4@x.com', phone: '0888' },
      // khoa nghiep vu phai gan nhu duy nhat (≥ 80% gia tri khac nhau)
      ...Array.from({ length: 15 }, (_, i) => ({ customer_id: 3000 + i, email: `k${i}@x.com`, phone: `07${i}` })),
    ];
    const s = detectSuspicions(cols, rows).find((x) => x.kind === 'duplicate_key');
    expect(s).toMatchObject({ column: 'email + phone', count: 2 });
    // chi mot cot khoa la identifier → de cho identifier_not_unique
    expect(detectSuspicions([sc('phone', 'number', 'identifier')], rows).some((x) => x.kind === 'duplicate_key')).toBe(false);
    // cot co token khoa nhung khong duy nhat (thue suat hang) → khong phai khoa
    const tax = Array.from({ length: 10 }, (_, i) => ({ id: i, tax_rate: '0.1', note: 'x' }));
    expect(detectSuspicions([sc('id', 'number', 'identifier'), sc('tax_rate', 'number', 'measure'), sc('note', 'string', 'category')], tax).some((x) => x.kind === 'duplicate_key')).toBe(false);
  });

  it('AN-53: locale_number_format; "abc" khong phai so theo vung', () => {
    const rows = ['231.36', '1.200,50', '$1,200', '12,5', 'abc', '300', '1.200,50', 'N/A'].map((price) => ({ price }));
    const s = detectSuspicions([sc('price', 'number', 'measure')], rows).find((x) => x.kind === 'locale_number_format');
    expect(s?.count).toBe(4);
    expect(s?.examples.join(' ')).not.toContain('abc');
  });

  it('AN-54: conditional_missing (paid_at ↔ status); cot trong ngau nhien khong bi bao', () => {
    const rows = [
      ...Array.from({ length: 20 }, (_, i) => ({ status: 'paid', paid_at: i === 0 ? '' : '2024-01-02', note: i % 4 === 0 ? '' : 'x' })),
      ...Array.from({ length: 10 }, (_, i) => ({ status: 'pending', paid_at: '', note: i % 4 === 0 ? '' : 'y' })),
      ...Array.from({ length: 10 }, (_, i) => ({ status: 'cancelled', paid_at: null, note: i % 4 === 0 ? '' : 'z' })),
    ];
    const cols = [sc('status', 'string', 'category'), sc('paid_at', 'date', 'datetime'), sc('note', 'string', 'text')];
    const out = detectSuspicions(cols, rows).filter((x) => x.kind === 'conditional_missing');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ column: 'paid_at', count: 21 });
    expect(out[0]?.message).toContain('20/21');
  });

  it('AN-55: leading_zero_numeric (ma buu chinh); so binh thuong khong bi bao', () => {
    const zips = ['03249', '88775', '42151', '01234', '00999', '70499'].map((zip_code) => ({ zip_code }));
    expect(detectSuspicions([sc('zip_code', 'number', 'identifier')], zips).find((x) => x.kind === 'leading_zero_numeric')?.count).toBe(3);
    const nums = ['123', '45678', '9', '0', '10'].map((zip_code) => ({ zip_code }));
    expect(detectSuspicions([sc('zip_code', 'number', 'measure')], nums).some((x) => x.kind === 'leading_zero_numeric')).toBe(false);
  });

  it('AN-56: sentinel -999 xuat hien 1 lan o cot duong duoc bao', () => {
    const rows = [5079310, 3005718, 5734389, 2804813, 4746170, 4329835, -999].map((balance) => ({ balance }));
    expect(detectSuspicions([sc('balance', 'number', 'measure')], rows).find((x) => x.kind === 'sentinel')).toMatchObject({ count: 1 });
  });
});

describe('AN-57 → AN-61: giai thich, khong doi nguong', () => {
  // [Nhóm A — không port] AN-57: thay đổi thiết kế của nhánh `backend`, chấp nhận (analysis_plan mục 7i). Khác biệt: `timeAnalysis` không còn `dateOrder` / `dateOrderAmbiguous` (đợt H).

  // [Nhóm A — không port] AN-58: lỗi thật K3 — sửa ở đợt K; test mới viết theo hành vi hiện hành ở `test/analysis-dot-k.spec.ts` (assert cũ gắn cơ chế đã đổi). Chi tiết: Tổng kết không dùng `outlierBreakdown` → DQ-04 mất mức cao + lý do độ lệch (đợt H).

  it('AN-59: symbolMissingCount + ly do DQ-03 tach ky hieu thieu', async () => {
    const cols = [col(0, 'product_id', 'string'), col(1, 'price', 'number')];
    const prices = ['10', 'NA', 'null', 'abc', '12', '', '13', '14'];
    const { saved } = await runWith(cols, prices.map((p, i) => ({ c0: `P${i}`, c1: p })));
    const price = (saved.dq_summary?.columns as unknown as Api[]).find((c) => String(c.column) === 'price');
    expect(price).toMatchObject({ missingCount: 1, invalidCount: 3, symbolMissingCount: 2 });
    expect(issueExplanation('DQ-03', price as never)).toContain('2 ô là ký hiệu thiếu (NA, null…), 1 ô sai định dạng thật');
    expect(issueExplanation('DQ-03', { invalidCount: 3, symbolMissingCount: 0 })).toBeNull();
  });

  // [Nhóm A — không port] AN-60: thay đổi thiết kế của nhánh `backend`, chấp nhận (analysis_plan mục 7i). Khác biệt: `describeColumn` mất tham số vai trò — cột định danh vẫn có số liệu định lượng (đợt H).

  // [Nhóm A — không port] AN-61: thay đổi thiết kế của nhánh `backend`, chấp nhận (analysis_plan mục 7i). Khác biệt: `timeAnalysis.valueColumnIgnoredReason` không còn (đợt H). Lưu ý OPEN-06: cột giá trị nay tự suy — khi khôi phục cần xem lại kịch bản.
});

describe('AN-62: Nghi van moi chi o Tong ket + PDF', () => {
  // [Nhóm A — không port] API ket qua khong co suspicions; ban luu co loai moi: lỗi thật K2 — sửa ở đợt K; test mới viết theo hành vi hiện hành ở `test/analysis-dot-k.spec.ts` (assert cũ gắn cơ chế đã đổi). Chi tiết: `conditional_missing` trên cột ngày không còn được phát hiện vì cột ngày bị loại khỏi phân tích (đợt H/G).
});
