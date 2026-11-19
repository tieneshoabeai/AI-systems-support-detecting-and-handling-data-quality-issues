import * as ss from 'simple-statistics';
import { isMissingToken } from '../../../shared/domain/utils/missing-tokens.util';
export type CorrelationKind = 'pearson' | 'spearman' | 'cramers_v' | 'eta_squared';
export interface ICorrelationCell { colA: string; colB: string; coef: number | null; kind: CorrelationKind; n: number; totalScanned: number; missingAOnly: number; missingBOnly: number; missingBoth: number; computable: boolean; reason: string | null; }

export type ColumnRole = 'numeric' | 'categorical' | 'excluded';

export interface AnalyzableColumn {
  key: string;
  role: ColumnRole;
  reason: string | null;
  /** GĐ2: cột kiểu chữ — ký hiệu NA/None… là một lớp, chỉ ô trống là thiếu (đồng bộ DQ-01). */
  textColumn?: boolean;
}

/** GĐ2: ô rỗng hoặc ký hiệu thiếu trong danh sách dùng chung (`shared/domain/utils/missing-tokens.util.ts`). */
const isNullToken = (s: string): boolean => s.trim() === '' || isMissingToken(s);

export function isMissingValue(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') {
    return isNullToken(val);
  }
  return false;
}

export function toFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val === 'boolean') return null;
  if (typeof val === 'string') {
    const t = val.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Chuyển ô thành nhãn lớp; null = thiếu/không hợp lệ.
 * GĐ2: `textColumn` = cột kiểu chữ → chỉ ô rỗng/khoảng trắng là thiếu;
 * cột khác → thêm danh sách ký hiệu thiếu dùng chung.
 */
export function toCategory(val: unknown, textColumn = false): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return null;
    return String(val);
  }
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'string') {
    const t = val.trim();
    if (t === '') return null;
    if (!textColumn && isMissingToken(t)) return null;
    return t;
  }
  if (val instanceof Date) return null;
  return String(val);
}

/** Phan hoach thieu cho mot cap: ca 2 hop le / chi A hong / chi B hong / ca 2 hong. */
export interface PairMissing {
  n: number;
  totalScanned: number;
  missingAOnly: number;
  missingBOnly: number;
  missingBoth: number;
}

export function classifyColumn(dataType: string): ColumnRole {
  if (dataType === 'number') return 'numeric';
  if (dataType === 'string' || dataType === 'boolean') return 'categorical';
  return 'excluded';
}

function rank(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    const current = indexed[i];
    if (!current) break;
    while (j + 1 < indexed.length) {
      const next = indexed[j + 1];
      if (!next || next.v !== current.v) break;
      j++;
    }
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) {
      const entry = indexed[k];
      if (entry) ranks[entry.i] = avg;
    }
    i = j + 1;
  }
  return ranks;
}

function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length < 3 || ys.length < 3 || xs.length !== ys.length) return null;
  const sx = ss.standardDeviation(xs);
  const sy = ss.standardDeviation(ys);
  if (!(sx > 0) || !(sy > 0)) return null;
  const c = ss.sampleCorrelation(xs, ys);
  return Number.isFinite(c) ? c : null;
}

function spearman(xs: number[], ys: number[]): number | null {
  if (xs.length < 3 || xs.length !== ys.length) return null;
  const rx = rank(xs);
  const ry = rank(ys);
  const sx = ss.standardDeviation(rx);
  const sy = ss.standardDeviation(ry);
  if (!(sx > 0) || !(sy > 0)) return null;
  const c = ss.sampleCorrelation(rx, ry);
  return Number.isFinite(c) ? c : null;
}

/**
 * GĐ8 — Cramér V trên **bảng contingency thưa** (sparse), không dùng ma trận dense.
 *
 * Bối cảnh: bản dense (`number[][]` kích thước `r × c`) đã khiến V8 OOM
 * (heap 4 GB) khi phân tích dataset chỉ 100.000 dòng — vì cột định danh
 * (`review_id`, `order_id`) có ~99.000 giá trị khác nhau, nên `r × c ≈ 9,8 tỷ ô`
 * ≈ 73 GB. Bảng thưa chỉ giữ các ô **thực sự có dữ liệu** (tối đa `n` ô),
 * nên bộ nhớ là O(n) thay vì O(r × c).
 *
 * Công thức χ² **không đổi**:
 *   χ² = Σ (O_ij − E_ij)² / E_ij,  E_ij = (rowSum_i × colSum_j) / n
 * Trong bảng thưa, các ô bằng 0 không đóng góp vào χ² — vì E_ij > 0 khi
 * rowSum_i > 0 và colSum_j > 0, và khi đó (0 − E)²/E = E > 0. Vì vậy phải cộng
 * thêm `E_ij` cho **mọi** cặp (i, j) có rowSum_i > 0 và colSum_j > 0, kể cả cặp
 * không có quan sát nào. Ta tính phần này bằng tổng tích phân:
 *   Σ_{i,j: E>0} E_ij = (Σ_i rowSum_i) × (Σ_j colSum_j) / n = n × n / n = n
 * nên phần "ô rỗng" đóng góp đúng `n − Σ_{ô có dữ liệu} E_ij`.
 *
 * Lưu ý về `r`, `c`: giữ nguyên **số giá trị khác nhau** để hợp đồng API
 * (`CorrelationCell`) không đổi; chỉ thay đổi cách lưu bảng.
 */
function cramersV(aCats: string[], bCats: string[]): { v: number | null; r: number; c: number } {
  const aLevels = [...new Set(aCats)];
  const bLevels = [...new Set(bCats)];
  const r = aLevels.length;
  const c = bLevels.length;
  const n = aCats.length;
  if (r < 2 || c < 2 || n < 4) return { v: null, r, c };

  const aIdx = new Map(aLevels.map((v, i) => [v, i] as const));
  const bIdx = new Map(bLevels.map((v, i) => [v, i] as const));

  // Bảng thưa: key = `i * c + j` (đóng gói 2 chỉ số vào 1 số) → tần suất quan sát.
  const obs = new Map<number, number>();
  const rowSum = new Map<number, number>();
  const colSum = new Map<number, number>();
  let counted = 0;
  for (let k = 0; k < n; k++) {
    const i = aIdx.get(aCats[k] ?? '');
    const j = bIdx.get(bCats[k] ?? '');
    if (i === undefined || j === undefined) continue;
    const key = i * c + j;
    obs.set(key, (obs.get(key) ?? 0) + 1);
    rowSum.set(i, (rowSum.get(i) ?? 0) + 1);
    colSum.set(j, (colSum.get(j) ?? 0) + 1);
    counted++;
  }
  if (counted < 4) return { v: null, r, c };

  // χ² = Σ_{ô có dữ liệu} (O − E)²/E  +  Σ_{ô rỗng, E>0} E
  // Phần thứ hai rút gọn = n − Σ_{ô có dữ liệu} E (vì Σ_{tất cả ô} E = n).
  let chi2 = 0;
  let expectedSum = 0;
  for (const [key, observed] of obs) {
    const i = Math.floor(key / c);
    const j = key % c;
    const expected = ((rowSum.get(i) ?? 0) * (colSum.get(j) ?? 0)) / counted;
    if (!(expected > 0)) continue;
    expectedSum += expected;
    const d = observed - expected;
    chi2 += (d * d) / expected;
  }
  const emptyCellsExpected = counted - expectedSum;
  if (emptyCellsExpected > 0) chi2 += emptyCellsExpected;

  const denom = counted * (Math.min(r, c) - 1);
  if (!(denom > 0) || !Number.isFinite(chi2)) return { v: null, r, c };
  const v = Math.sqrt(chi2 / denom);
  return { v: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null, r, c };
}

function etaSquared(nums: number[], cats: string[]): { eta2: number | null; groups: number } {
  const groups = new Map<string, number[]>();
  for (let k = 0; k < nums.length; k++) {
    const g = cats[k];
    if (g === undefined) continue;
    const value = nums[k];
    if (value === undefined) continue;
    const arr = groups.get(g);
    if (arr) arr.push(value);
    else groups.set(g, [value]);
  }
  if (groups.size < 2) return { eta2: null, groups: groups.size };
  for (const arr of groups.values()) {
    if (arr.length < 2) return { eta2: null, groups: groups.size };
  }
  const mean = ss.mean(nums);
  const sst = nums.reduce((s, v) => s + (v - mean) * (v - mean), 0);
  if (!(sst > 0)) return { eta2: null, groups: groups.size };
  let ssb = 0;
  for (const arr of groups.values()) {
    const gm = ss.mean(arr);
    ssb += arr.length * (gm - mean) * (gm - mean);
  }
  const eta2 = ssb / sst;
  return { eta2: Number.isFinite(eta2) ? Math.min(1, Math.max(0, eta2)) : null, groups: groups.size };
}

export interface PairInput {
  colA: string;
  roleA: ColumnRole;
  colB: string;
  roleB: ColumnRole;
  rows: Record<string, unknown>[];
  /** GĐ2: cột A/B là cột kiểu chữ (xem `toCategory`). */
  textA?: boolean;
  textB?: boolean;
}

export function computePairCell(input: PairInput, method: 'pearson' | 'spearman'): ICorrelationCell {
  const totalScanned = input.rows.length;
  const zero: PairMissing = { n: 0, totalScanned, missingAOnly: 0, missingBOnly: 0, missingBoth: 0 };
  const textOf = (key: string): boolean => (key === input.colA ? Boolean(input.textA) : Boolean(input.textB));
  const catOf = (key: string, v: unknown): string | null => toCategory(v, textOf(key));
  const isValid = (key: string, role: ColumnRole, v: unknown): boolean =>
    role === 'numeric' ? toFiniteNumber(v) !== null : catOf(key, v) !== null;

  if (input.colA === input.colB) {
    let n = 0;
    for (const row of input.rows) {
      if (isValid(input.colA, input.roleA, row[input.colA])) n++;
    }
    if (input.roleA === 'numeric') {
      return {
        colA: input.colA, colB: input.colB, coef: 1, kind: method,
        n, totalScanned, missingAOnly: 0, missingBOnly: 0, missingBoth: totalScanned - n,
        computable: true, reason: 'diagonal',
      };
    }
    return {
      colA: input.colA, colB: input.colB, coef: null,
      kind: input.roleA === 'categorical' ? 'cramers_v' : 'pearson',
      n, totalScanned, missingAOnly: 0, missingBOnly: 0, missingBoth: totalScanned - n,
      computable: false, reason: 'no_diagonal_for_categorical',
    };
  }

  const countMissing = (aOk: boolean, bOk: boolean, m: PairMissing): void => {
    if (aOk && bOk) m.n++;
    else if (!aOk && bOk) m.missingAOnly++;
    else if (aOk && !bOk) m.missingBOnly++;
    else m.missingBoth++;
  };

  if (input.roleA === 'numeric' && input.roleB === 'numeric') {
    const xs: number[] = [];
    const ys: number[] = [];
    const m: PairMissing = { ...zero };
    for (const row of input.rows) {
      const aOk = toFiniteNumber(row[input.colA]) !== null;
      const bOk = toFiniteNumber(row[input.colB]) !== null;
      countMissing(aOk, bOk, m);
      if (aOk && bOk) {
        xs.push(toFiniteNumber(row[input.colA]) as number);
        ys.push(toFiniteNumber(row[input.colB]) as number);
      }
    }
    const base = { colA: input.colA, colB: input.colB, ...m };
    if (m.n < 3) {
      return { ...base, coef: null, kind: method, computable: false, reason: 'insufficient_pairwise_n_lt_3' };
    }
    const coef = method === 'pearson' ? pearson(xs, ys) : spearman(xs, ys);
    if (coef === null) {
      return { ...base, coef: null, kind: method, computable: false, reason: 'constant_column_or_undefined' };
    }
    return { ...base, coef: round4(coef), kind: method, computable: true, reason: null };
  }
  if (input.roleA === 'categorical' && input.roleB === 'categorical') {
    const aCats: string[] = [];
    const bCats: string[] = [];
    const m: PairMissing = { ...zero };
    for (const row of input.rows) {
      const aOk = catOf(input.colA, row[input.colA]) !== null;
      const bOk = catOf(input.colB, row[input.colB]) !== null;
      countMissing(aOk, bOk, m);
      if (aOk && bOk) {
        aCats.push(catOf(input.colA, row[input.colA]) as string);
        bCats.push(catOf(input.colB, row[input.colB]) as string);
      }
    }
    const base = { colA: input.colA, colB: input.colB, ...m };
    const kind: CorrelationKind = 'cramers_v';
    if (m.n < 4) {
      return { ...base, coef: null, kind, computable: false, reason: 'insufficient_pairwise_n_lt_4' };
    }
    const { v, r, c } = cramersV(aCats, bCats);
    if (v === null) {
      const reason = r < 2 || c < 2 ? 'single_group_no_variation' : 'undefined_chi2';
      return { ...base, coef: null, kind, computable: false, reason };
    }
    return { ...base, coef: round4(v), kind, computable: true, reason: null };
  }
  const numKey = input.roleA === 'numeric' ? input.colA : input.colB;
  const catKey = input.roleA === 'numeric' ? input.colB : input.colA;
  const nums: number[] = [];
  const cats: string[] = [];
  const m: PairMissing = { ...zero };
  for (const row of input.rows) {
    const numOk = toFiniteNumber(row[numKey]) !== null;
    const catOk = catOf(catKey, row[catKey]) !== null;
    const aOk = input.roleA === 'numeric' ? numOk : catOk;
    const bOk = input.roleA === 'numeric' ? catOk : numOk;
    countMissing(aOk, bOk, m);
    if (numOk && catOk) {
      nums.push(toFiniteNumber(row[numKey]) as number);
      cats.push(catOf(catKey, row[catKey]) as string);
    }
  }
  const base = { colA: input.colA, colB: input.colB, ...m };
  const kind: CorrelationKind = 'eta_squared';
  if (m.n < 4) {
    return { ...base, coef: null, kind, computable: false, reason: 'insufficient_pairwise_n_lt_4' };
  }
  const { eta2 } = etaSquared(nums, cats);
  if (eta2 === null) {
    return { ...base, coef: null, kind, computable: false, reason: 'single_group_or_constant_numeric' };
  }
  return { ...base, coef: round4(eta2), kind, computable: true, reason: null };
}

export function buildCorrelationMatrix(
  columns: AnalyzableColumn[],
  rows: Record<string, unknown>[],
  method: 'pearson' | 'spearman',
  options: { maxCells?: number } = {},
): { cells: ICorrelationCell[]; notes: string[] } {
  const maxCells = options.maxCells ?? MAX_CORRELATION_CELLS;
  const active = columns.filter((c) => c.role !== 'excluded');
  const cells: ICorrelationCell[] = [];

  // ── GĐ10 — đếm số mức (distinct) của từng cột phân loại ────────────────
  // Chỉ cột `categorical` mới có "số mức"; cột `numeric` không dựng
  // contingency nên không cần guard.
  const distinctCountByKey = new Map<string, number>();
  for (const col of active) {
    if (col.role !== 'categorical') continue;
    const levels = new Set<string>();
    for (const row of rows) {
      const cat = toCategory(row[col.key], Boolean(col.textColumn));
      if (cat !== null) levels.add(cat);
    }
    distinctCountByKey.set(col.key, levels.size);
  }

  const guardedPairs: string[] = [];

  for (const a of active) {
    for (const b of active) {
      const pairInput: PairInput = {
        colA: a.key, roleA: a.role, colB: b.key, roleB: b.role, rows,
        textA: a.textColumn, textB: b.textColumn,
      };
      if (a.key === b.key) {
        cells.push(computePairCell(pairInput, method));
        continue;
      }
      // GĐ10 — chặn cặp có cardinality quá lớn TRƯỚC khi tính.
      if (a.role === 'categorical' && b.role === 'categorical') {
        const dA = distinctCountByKey.get(a.key) ?? 0;
        const dB = distinctCountByKey.get(b.key) ?? 0;
        const guardReason = exceedsCardinalityGuard(dA, dB, maxCells);
        if (guardReason) {
          guardedPairs.push(`${a.key} x ${b.key} (${guardReason})`);
          cells.push({
            colA: a.key,
            colB: b.key,
            coef: null,
            kind: 'cramers_v',
            n: 0,
            totalScanned: rows.length,
            missingAOnly: 0,
            missingBOnly: 0,
            missingBoth: 0,
            computable: false,
            reason: guardReason,
          });
          continue;
        }
      }
      cells.push(computePairCell(pairInput, method));
    }
  }
  const excluded = columns.filter((c) => c.role === 'excluded');
  const notes: string[] = [
    'mỗi cặp dùng tập dòng hợp lệ riêng (pairwise), không điền thiếu',
    'không trộn thang diễn giải giữa pearson/spearman, cramers_v [0,1] và eta_squared [0,1]',
  ];
  if (guardedPairs.length > 0) {
    notes.push(
      `${guardedPairs.length} cặp cột bị bỏ qua do vượt ngưỡng cardinality (${maxCells.toLocaleString('vi-VN')} ô): ${guardedPairs.join('; ')}`,
    );
  }
  if (excluded.length > 0) {
    const dateCols = excluded.filter((c) => (c.reason ?? '').includes('date')).map((c) => c.key);
    if (dateCols.length > 0) {
      notes.push(`cột date bị loại khỏi tương quan/VIF (chưa chốt định nghĩa tương quan thời gian): ${dateCols.join(', ')}`);
    }
    const other = excluded.filter((c) => !(c.reason ?? '').includes('date')).map((c) => `${c.key} (${c.reason ?? 'unknown'})`);
    if (other.length > 0) notes.push(`cột bị loại khác: ${other.join(', ')}`);
  }
  const pairNs = new Set(cells.filter((c) => c.colA !== c.colB && c.computable).map((c) => c.n));
  void pairNs;
  if (pairNs.size > 1) notes.push('tập dòng khác nhau giữa các cặp nên n không hoàn toàn so sánh trực tiếp');
  return { cells, notes };
}

export function round4(v: number): number {
  return Number(v.toFixed(4));
}

// ── GĐ10 — Guard theo cardinality ────────────────────────────────────────

/**
 * Ngưỡng tối đa số ô contingency mà một cặp cột được phép "trả về".
 *
 * Lý do: ma trận contingency **dày** của một cặp có `r` mức A và `c` mức B cần
 * `r × c` ô. Với cột định danh (`r ≈ c ≈ 99.000`) đó là ~9,8 tỷ ô ≈ 73 GB →
 * OOM (đã xảy ra thật, xem `docs/restructures/21_cardinality_guard_gd8_gd9.md`).
 *
 * GĐ8 đã dùng bảng contingency **thưa** nên bộ nhớ là O(n) — nhưng đó là chiến
 * lược bên trong `cramersV()`. GĐ10 là **lưới an toàn cuối** ở tầng ma trận:
 * nếu một cặp vẫn lọt qua bộ lọc vai trò (GĐ9) mà có cardinality điên rồ,
 * ta **không tính** cặp đó và báo rõ lý do thay vì để bộ nhớ tăng vô hạn.
 *
 * 10.000.000 ô × 8 byte ≈ 80 MB — ngân sách bộ nhớ hợp lý cho một cặp.
 */
export const MAX_CORRELATION_CELLS = 10_000_000;

/**
 * Kiểm tra `distinct(A) × distinct(B)` có vượt ngưỡng GĐ10 không.
 *
 * @returns `null` nếu cặp an toàn, hoặc chuỗi lý do nếu vượt ngưỡng.
 */
export function exceedsCardinalityGuard(
  distinctA: number,
  distinctB: number,
  maxCells: number = MAX_CORRELATION_CELLS,
): string | null {
  if (!Number.isFinite(distinctA) || !Number.isFinite(distinctB)) return null;
  if (distinctA < 2 || distinctB < 2) return null;
  const cells = distinctA * distinctB;
  if (cells <= maxCells) return null;
  return `cardinality_guard_exceeded: distinct(A)=${distinctA} x distinct(B)=${distinctB} = ${cells.toLocaleString('vi-VN')} > ${maxCells.toLocaleString('vi-VN')} o`;
}
