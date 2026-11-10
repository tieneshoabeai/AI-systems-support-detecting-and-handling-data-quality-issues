import * as ss from 'simple-statistics';
export type CorrelationKind = 'pearson' | 'spearman' | 'cramers_v' | 'eta_squared';
export interface ICorrelationCell { colA: string; colB: string; coef: number | null; kind: CorrelationKind; n: number; totalScanned: number; missingAOnly: number; missingBOnly: number; missingBoth: number; computable: boolean; reason: string | null; }

export type ColumnRole = 'numeric' | 'categorical' | 'excluded';

export interface AnalyzableColumn {
  key: string;
  role: ColumnRole;
  reason: string | null;
}

const NULL_TOKENS = new Set(['', 'null', 'undefined', 'na', 'n/a', 'none', '-']);

export function isMissingValue(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') {
    return NULL_TOKENS.has(val.trim().toLowerCase());
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

export function toCategory(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return null;
    return String(val);
  }
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'string') {
    const t = val.trim();
    if (NULL_TOKENS.has(t.toLowerCase())) return null;
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
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = avg;
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

function cramersV(aCats: string[], bCats: string[]): { v: number | null; r: number; c: number } {
  const aLevels = [...new Set(aCats)];
  const bLevels = [...new Set(bCats)];
  const r = aLevels.length;
  const c = bLevels.length;
  const n = aCats.length;
  if (r < 2 || c < 2 || n < 4) return { v: null, r, c };
  const aIdx = new Map(aLevels.map((v, i) => [v, i]));
  const bIdx = new Map(bLevels.map((v, i) => [v, i]));
  const obs: number[][] = Array.from({ length: r }, () => new Array<number>(c).fill(0));
  for (let k = 0; k < n; k++) {
    const i = aIdx.get(aCats[k]) ?? -1;
    const j = bIdx.get(bCats[k]) ?? -1;
    if (i >= 0 && j >= 0) obs[i][j] += 1;
  }
  const rowSum = obs.map((row) => row.reduce((s, v) => s + v, 0));
  const colSum = bLevels.map((_, j) => obs.reduce((s, row) => s + row[j], 0));
  let chi2 = 0;
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      const expected = (rowSum[i] * colSum[j]) / n;
      if (expected <= 0) continue;
      const d = obs[i][j] - expected;
      chi2 += (d * d) / expected;
    }
  }
  const denom = n * (Math.min(r, c) - 1);
  if (!(denom > 0) || !Number.isFinite(chi2)) return { v: null, r, c };
  const v = Math.sqrt(chi2 / denom);
  return { v: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null, r, c };
}

function etaSquared(nums: number[], cats: string[]): { eta2: number | null; groups: number } {
  const groups = new Map<string, number[]>();
  for (let k = 0; k < nums.length; k++) {
    const g = cats[k];
    const arr = groups.get(g);
    if (arr) arr.push(nums[k]);
    else groups.set(g, [nums[k]]);
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
}

export function computePairCell(input: PairInput, method: 'pearson' | 'spearman'): ICorrelationCell {
  const totalScanned = input.rows.length;
  const zero: PairMissing = { n: 0, totalScanned, missingAOnly: 0, missingBOnly: 0, missingBoth: 0 };
  const isValid = (key: string, role: ColumnRole, v: unknown): boolean =>
    role === 'numeric' ? toFiniteNumber(v) !== null : toCategory(v) !== null;

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
      const aOk = toCategory(row[input.colA]) !== null;
      const bOk = toCategory(row[input.colB]) !== null;
      countMissing(aOk, bOk, m);
      if (aOk && bOk) {
        aCats.push(toCategory(row[input.colA]) as string);
        bCats.push(toCategory(row[input.colB]) as string);
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
    const catOk = toCategory(row[catKey]) !== null;
    const aOk = input.roleA === 'numeric' ? numOk : catOk;
    const bOk = input.roleA === 'numeric' ? catOk : numOk;
    countMissing(aOk, bOk, m);
    if (numOk && catOk) {
      nums.push(toFiniteNumber(row[numKey]) as number);
      cats.push(toCategory(row[catKey]) as string);
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
): { cells: ICorrelationCell[]; notes: string[] } {
  const active = columns.filter((c) => c.role !== 'excluded');
  const cells: ICorrelationCell[] = [];
  for (const a of active) {
    for (const b of active) {
      cells.push(computePairCell({ colA: a.key, roleA: a.role, colB: b.key, roleB: b.role, rows }, method));
    }
  }
  const excluded = columns.filter((c) => c.role === 'excluded');
  const notes: string[] = [
    'mỗi cặp dùng tập dòng hợp lệ riêng (pairwise), không điền thiếu',
    'không trộn thang diễn giải giữa pearson/spearman, cramers_v [0,1] và eta_squared [0,1]',
  ];
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
