/**
 * Sinh tập dữ liệu vàng (gold set) cho benchmark 5 model AI.
 *
 * Yêu cầu (Phần 12 v8 §3.15.5 Bước 1):
 *  - 200 mẫu, phủ DQ-01..DQ-05 × 3 mức ảnh hưởng
 *  - có cả mẫu `false_positive` (dữ liệu sạch → đáp án là "không phát hiện vấn đề")
 *    và mẫu `missed_issue` (vấn đề tinh vi, dễ bỏ sót)
 *  - mỗi mẫu: thống kê tổng hợp + mẫu ô lỗi (đã che PII) + đáp án đúng
 *
 * Cấu trúc payload bám đúng `CorrV1Context` của production để prompt dựng
 * được bằng chính `buildCorrV1Prompt()` — không tạo prompt riêng cho benchmark.
 *
 * Bộ sinh DETERMINISTIC (PRNG seed cố định) → chạy lại cho cùng kết quả.
 */
import type { CorrV1Context, ICorrelationCell, IVifRow } from '../../src/modules/analysis/domain/ai-grounding.util';
import { MAX_COLUMNS_PER_SAMPLE } from './models';

export type DqCode = 'DQ-01' | 'DQ-02' | 'DQ-03' | 'DQ-04' | 'DQ-05';
export type Severity = 'low' | 'medium' | 'high';
export type SampleKind = 'corr' | 'dq' | 'clean';

export interface ColumnStat {
  column: string;
  role: string;
  totalRows: number;
  missingCount: number;
  missingRate: number;
  invalidCount: number;
  invalidRate: number;
  outlierCount: number;
  outlierRate: number;
  duplicateRowCount: number;
  duplicateRate: number;
}

export interface ExpectedPair {
  colA: string;
  colB: string;
  coef: number;
}

export interface ExpectedIssue {
  code: DqCode;
  column: string;
  severity: Severity;
}

export interface GoldExpected {
  /** Cặp tương quan đáng chú ý (|coef| ≥ 0,75) */
  notablePairs: ExpectedPair[];
  /** Cột VIF vượt ngưỡng */
  highVif: string[];
  /** Vấn đề chất lượng dữ liệu DQ-01..DQ-04 */
  issues: ExpectedIssue[];
  /** Đáp án nhị phân: mẫu này có vấn đề hay không (dùng cho F1 micro) */
  hasIssue: boolean;
  /** Mẫu là "bẫy" (false positive) hay "dễ sót" (missed issue) */
  trap: 'false_positive' | 'missed_issue' | null;
}

export interface GoldSample {
  id: string;
  kind: SampleKind;
  /** Chỉ số mức ảnh hưởng 0=low 1=medium 2=high (null cho mẫu clean) */
  severityIndex: number | null;
  payload: CorrV1Context & { stats: ColumnStat[] };
  expected: GoldExpected;
}

/** PRNG xorshift32 — deterministic, không phụ thuộc thư viện ngoài. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

const COLUMN_POOL = [
  'tuoi',
  'thu_nhap',
  'so_don_duong',
  'diem_toan',
  'so_luong_hang',
  'ty_le_chi_muc',
  'nam_sinh',
  'ma_khach_hang',
  'so_dien_thoai',
  'ngay_cap_nhat',
  'dia_chi',
  'trang_thai_don',
];

function pick(rng: () => number, arr: readonly string[]): string {
  const idx = Math.floor(rng() * arr.length) % arr.length;
  return arr[idx] ?? arr[0] ?? '';
}

function round(value: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** Ngưỡng ảnh hưởng §3.11 — 'low' | 'medium' | 'high' | null. */
export function severityByRate(rate: number, kind: 'duplicate' | 'default'): Severity | null {
  if (rate <= 0) return null;
  if (kind === 'duplicate') {
    if (rate < 0.005) return 'low';
    if (rate <= 0.05) return 'medium';
    return 'high';
  }
  if (rate < 0.01) return 'low';
  if (rate <= 0.1) return 'medium';
  return 'high';
}

/** Tỉ lệ mục tiêu theo mức ảnh hưởng (low / medium / high). */
const RATE_BY_SEVERITY = {
  missing: [0.004, 0.05, 0.18] as const,
  duplicate: [0.002, 0.03, 0.09] as const,
  invalid: [0.006, 0.04, 0.15] as const,
  outlier: [0.02, 0.05, 0.11] as const,
};

const SEVERITY_NAMES: readonly Severity[] = ['low', 'medium', 'high'];

/** Truy cập mảng tỉ lệ an toàn (noUncheckedIndexedAccess). */
function rateAt(rates: readonly number[], index: number): number {
  return rates[index] ?? rates[rates.length - 1] ?? 0;
}

function buildSample(rng: () => number, index: number): GoldSample {
  const id = `G${String(index + 1).padStart(3, '0')}`;
  const columnCount = Math.min(
    MAX_COLUMNS_PER_SAMPLE,
    3 + Math.floor(rng() * 4), // 3..6 cột (bị chặn trần bởi MAX_COLUMNS_PER_SAMPLE)
  );
  const columns: string[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (columns.length < columnCount && guard < 200) {
    guard += 1;
    const c = pick(rng, COLUMN_POOL);
    if (used.has(c)) continue;
    used.add(c);
    columns.push(c);
  }

  const totalScanned = 120 + Math.floor(rng() * 880);
  const commonN = totalScanned - Math.floor(rng() * 30);

  // Phân bổ loại mẫu: clean ~20%, dq ~30%, corr ~50%.
  const roll = rng();
  let kind: SampleKind = 'corr';
  if (roll > 0.78) kind = 'dq';
  else if (roll > 0.62) kind = 'clean';
  // Cưỡng chế để phủ chắc chắn cả 3 mức ảnh hưởng và đủ mẫu bẫy.
  if (index % 7 === 3) kind = 'clean';
  if (index % 11 === 5) kind = 'dq';

  const severityIndex = kind === 'dq' ? index % 3 : null;

  const cells: ICorrelationCell[] = [];
  const expectedPairs: ExpectedPair[] = [];
  const expectedHighVif: string[] = [];
  const expectedIssues: ExpectedIssue[] = [];

  // ── Ma trận tương quan ────────────────────────────────────────────────
  // Duyệt tam giác trên: (0,1), (0,2), (1,2), (0,3)...
  const pairs: [string, string][] = [];
  for (let i = 0; i < columns.length; i++) {
    for (let j = i + 1; j < columns.length; j++) {
      const a = columns[i];
      const b = columns[j];
      if (a && b) pairs.push([a, b]);
    }
  }
  for (let i = 0; i < pairs.length; i++) {
    const [colA, colB] = pairs[i]!;
    let coef: number;
    if (kind === 'clean') {
      coef = round((rng() - 0.5) * 0.6, 3); // |coef| < 0,3 → không đáng chú ý
    } else if (kind === 'corr' && i === 0) {
      const mag = 0.82 + rng() * 0.16; // 0,82..0,98 → chắc chắn vượt ngưỡng 0,75
      coef = round(rng() > 0.5 ? mag : -mag, 3);
    } else {
      coef = round((rng() - 0.5) * 0.8, 3);
    }
    const computable = rng() > 0.08;
    const n = computable ? Math.max(4, commonN - Math.floor(rng() * 20)) : 0;
    cells.push({
      colA,
      colB,
      coef: computable ? coef : null,
      kind: 'pearson',
      n,
      totalScanned,
      // missingAOnly/missingBOnly/missingBoth giữ ở payload để đúng cấu trúc
      // `CorrV1Context` của production, nhưng được rút gọn khi dựng prompt.
      missingAOnly: Math.floor(rng() * 12),
      missingBOnly: Math.floor(rng() * 12),
      missingBoth: Math.floor(rng() * 6),
      computable,
      reason: computable ? null : 'not_enough_common_observations',
    });
    if (computable && Math.abs(coef) >= 0.75) {
      expectedPairs.push({ colA, colB, coef });
    }
  }

  // ── VIF ───────────────────────────────────────────────────────────────
  const vifRows: IVifRow[] = [];
  for (const c of columns) {
    let vif = round(1 + rng() * 1.6, 2);
    const firstPair = expectedPairs[0];
    // VIF cao chỉ ở cột thực sự có tương quan mạnh (đa cộng tuyến).
    if (kind === 'corr' && firstPair && (c === firstPair.colA || c === firstPair.colB)) {
      vif = round(10.5 + rng() * 6, 2); // ≥ 10 → flag 'high'
    }
    const flag: IVifRow['flag'] = vif >= 10 ? 'high' : vif >= 5 ? 'review' : 'ok';
    vifRows.push({ column: c, vif, flag, computable: true, reason: null });
    if (flag !== 'ok') expectedHighVif.push(c);
  }

  // ── Vấn đề chất lượng dữ liệu DQ-01..DQ-04 ─────────────────────────────
  if (kind === 'dq' && severityIndex !== null) {
    const codes: DqCode[] = ['DQ-01', 'DQ-02', 'DQ-03', 'DQ-04'];
    const code = codes[index % codes.length] ?? 'DQ-01';
    const column = columns[index % columns.length] ?? columns[0] ?? '';
    const rate =
      code === 'DQ-01'
        ? rateAt(RATE_BY_SEVERITY.missing, severityIndex)
        : code === 'DQ-02'
          ? rateAt(RATE_BY_SEVERITY.duplicate, severityIndex)
          : code === 'DQ-03'
            ? rateAt(RATE_BY_SEVERITY.invalid, severityIndex)
            : rateAt(RATE_BY_SEVERITY.outlier, severityIndex);
    const severity =
      code === 'DQ-04'
        ? (SEVERITY_NAMES[severityIndex] as Severity)
        : (severityByRate(rate, code === 'DQ-02' ? 'duplicate' : 'default') as Severity);
    expectedIssues.push({ code, column, severity });
  }

  // ── Thống kê tổng hợp + mẫu ô đã che PII ─────────────────────────────
  const stats: ColumnStat[] = [];
  const maskedSamples: Record<string, string[]> = {};

  for (const c of columns) {
    const issue = expectedIssues.find((i) => i.column === c);
    const sevIdx = severityIndex ?? 0;
    const missingRate = issue?.code === 'DQ-01' ? rateAt(RATE_BY_SEVERITY.missing, sevIdx) : 0;
    const duplicateRate = issue?.code === 'DQ-02' ? rateAt(RATE_BY_SEVERITY.duplicate, sevIdx) : 0;
    const invalidRate = issue?.code === 'DQ-03' ? rateAt(RATE_BY_SEVERITY.invalid, sevIdx) : 0;
    const outlierRate = issue?.code === 'DQ-04' ? rateAt(RATE_BY_SEVERITY.outlier, sevIdx) : 0;

    stats.push({
      column: c,
      role: 'numeric',
      totalRows: totalScanned,
      missingCount: Math.round(missingRate * totalScanned),
      missingRate: round(missingRate, 4),
      invalidCount: Math.round(invalidRate * totalScanned),
      invalidRate: round(invalidRate, 4),
      outlierCount: Math.round(outlierRate * totalScanned),
      outlierRate: round(outlierRate, 4),
      duplicateRowCount: Math.round(duplicateRate * totalScanned),
      duplicateRate: round(duplicateRate, 4),
    });

    const samples: string[] = [];
    const sampleCount = 6 + Math.floor(rng() * 6);
    for (let i = 0; i < sampleCount; i++) {
      if (missingRate > 0 && rng() < missingRate * 3) {
        samples.push('');
        continue;
      }
      if (invalidRate > 0 && rng() < invalidRate * 3) {
        samples.push(pick(rng, ['N/A', 'khong xac dinh', 'chua co', '#ERROR', 'null-chuoi']));
        continue;
      }
      if (outlierRate > 0 && rng() < outlierRate * 2) {
        samples.push(String(Math.round(900 + rng() * 900)));
        continue;
      }
      samples.push(String(Math.round(rng() * 100)));
    }
    maskedSamples[c] = samples;
  }

  const hasIssue =
    expectedPairs.length > 0 || expectedHighVif.length > 0 || expectedIssues.length > 0;
  const trap: GoldExpected['trap'] =
    kind === 'clean' ? 'false_positive' : severityIndex === 0 ? 'missed_issue' : null;

  return {
    id,
    kind,
    severityIndex,
    payload: {
      columns: columns.map((c) => ({ key: c, role: 'numeric', usedRows: totalScanned, excludedRows: 0 })),
      cells,
      vif: {
        columns,
        rows: vifRows,
        commonN,
        totalScanned,
        commonNRate: round(commonN / totalScanned, 4),
        lossWarning: null,
        excluded: [],
      },
      maskedSamples,
      method: 'pearson',
      excludedColumns: [],
      stats,
    },
    expected: {
      notablePairs: expectedPairs,
      highVif: expectedHighVif,
      issues: expectedIssues,
      hasIssue,
      trap,
    },
  };
}

/** Sinh tập vàng đầy đủ. */
export function generateGoldSet(size = 200, seed = 20261116): GoldSample[] {
  const rng = makeRng(seed);
  const samples: GoldSample[] = [];
  for (let i = 0; i < size; i++) samples.push(buildSample(rng, i));
  return samples;
}

/** Thống kê phân bổ — dùng để kiểm tra độ phủ trước khi chạy. */
export function describeGoldSet(samples: GoldSample[]): {
  total: number;
  byKind: Record<string, number>;
  bySeverity: Record<string, number>;
  byCode: Record<string, number>;
  byTrap: Record<string, number>;
  totalExpectedPairs: number;
  totalExpectedHighVif: number;
  cleanSamples: number;
} {
  const byKind: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byCode: Record<string, number> = {};
  const byTrap: Record<string, number> = {};
  let pairs = 0;
  let vif = 0;
  for (const s of samples) {
    byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
    for (const i of s.expected.issues) {
      byCode[i.code] = (byCode[i.code] ?? 0) + 1;
      bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
    }
    if (s.expected.trap) byTrap[s.expected.trap] = (byTrap[s.expected.trap] ?? 0) + 1;
    pairs += s.expected.notablePairs.length;
    vif += s.expected.highVif.length;
  }
  return {
    total: samples.length,
    byKind,
    bySeverity,
    byCode,
    byTrap,
    totalExpectedPairs: pairs,
    totalExpectedHighVif: vif,
    cleanSamples: samples.filter((s) => !s.expected.hasIssue).length,
  };
}
