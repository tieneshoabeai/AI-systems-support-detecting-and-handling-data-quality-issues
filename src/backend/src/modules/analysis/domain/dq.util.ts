import * as ss from 'simple-statistics';
import { isMissingValue, toFiniteNumber, toCategory, round4 } from './correlation.util';

export interface DqColumnFinding {
  column: string;
  missingCount: number;
  missingRate: number | null;
  invalidCount: number;
  invalidRate: number | null;
  outlierCount: number;
  outlierRate: number | null;
  checkedRows: number;
  excludedRows: number;
  method: string;
  reason: string | null;
}

export interface DqSummary {
  totalScanned: number;
  columns: DqColumnFinding[];
  duplicateGroups: { key: string; rowIndexes: number[]; count: number; hasPartialMissing: boolean }[];
  duplicateRowCount: number;
  fullyMissingRows: number;
  partiallyMissingRows: number;
  notes: string[];
}

/** DQ-01: thieu = null/undefined/chuoi rong hoac chi khoang trang. Khong coi 0/false/NA/null-chuoi la thieu. */
export function isMissingCell(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') return val.trim() === '';
  return false;
}

function fingerprintRow(row: Record<string, unknown>, cols: string[]): string | null {
  const parts: string[] = [];
  let allMissing = true;
  for (const c of cols) {
    const v = row[c];
    if (!isMissingCell(v)) allMissing = false;
    parts.push(JSON.stringify(v ?? null));
  }
  if (allMissing) return null;
  return parts.join('|');
}

export function computeDq0102(
  columns: string[],
  rows: { rowIndex: number; values: Record<string, unknown> }[],
): Pick<DqSummary, 'columns' | 'duplicateGroups' | 'duplicateRowCount' | 'fullyMissingRows' | 'partiallyMissingRows'> {
  const total = rows.length;
  const colStats = columns.map((column) => {
    let missingCount = 0;
    for (const r of rows) if (isMissingCell(r.values[column])) missingCount++;
    return {
      column,
      missingCount,
      missingRate: total > 0 ? round4(missingCount / total) : null,
      invalidCount: 0,
      invalidRate: null,
      outlierCount: 0,
      outlierRate: null,
      checkedRows: total,
      excludedRows: 0,
      method: 'dq01_exact_missing',
      reason: total === 0 ? 'no_data_to_evaluate' : null,
    };
  });
  let fullyMissingRows = 0;
  let partiallyMissingRows = 0;
  for (const r of rows) {
    const miss = columns.filter((c) => isMissingCell(r.values[c])).length;
    if (columns.length > 0 && miss === columns.length) fullyMissingRows++;
    else if (miss > 0) partiallyMissingRows++;
  }
  const groups = new Map<string, number[]>();
  const partialFlags = new Map<string, boolean>();
  rows.forEach((r) => {
    const fp = fingerprintRow(r.values, columns);
    if (fp === null) return;
    const arr = groups.get(fp) ?? [];
    arr.push(r.rowIndex);
    groups.set(fp, arr);
    const hasMiss = columns.some((c) => isMissingCell(r.values[c]));
    partialFlags.set(fp, (partialFlags.get(fp) ?? false) || hasMiss);
  });
  const duplicateGroups = [...groups.entries()]
    .filter(([, idx]) => idx.length > 1)
    .map(([key, rowIndexes]) => ({
      key: key.slice(0, 200),
      rowIndexes: [...rowIndexes].sort((a, b) => a - b),
      count: rowIndexes.length,
      hasPartialMissing: partialFlags.get(key) ?? false,
    }));
  const duplicateRowCount = duplicateGroups.reduce((s, g) => s + (g.count - 1), 0);
  return { columns: colStats, duplicateGroups, duplicateRowCount, fullyMissingRows, partiallyMissingRows };
}

/** DQ-03: sai kieu/dinh dang theo data_type da chot. Khong dem o thieu thanh loi kieu. */
export function isValidByType(val: unknown, dataType: string): { valid: boolean; reason: string | null } {
  if (isMissingCell(val)) return { valid: true, reason: null };
  if (dataType === 'number') {
    const n = toFiniteNumber(val);
    return n === null ? { valid: false, reason: 'invalid_number' } : { valid: true, reason: null };
  }
  if (dataType === 'boolean') {
    if (typeof val === 'boolean') return { valid: true, reason: null };
    if (typeof val === 'string') {
      const t = val.trim().toLowerCase();
      if (['true', 'false', 'yes', 'no', '1', '0'].includes(t)) return { valid: true, reason: null };
    }
    if (typeof val === 'number' && (val === 0 || val === 1)) return { valid: true, reason: null };
    return { valid: false, reason: 'invalid_boolean' };
  }
  if (dataType === 'date') {
    if (val instanceof Date) {
      return Number.isNaN(val.getTime()) ? { valid: false, reason: 'invalid_date' } : { valid: true, reason: null };
    }
    if (typeof val === 'string' || typeof val === 'number') {
      const d = new Date(val);
      return Number.isNaN(d.getTime()) ? { valid: false, reason: 'invalid_date' } : { valid: true, reason: null };
    }
    return { valid: false, reason: 'invalid_date' };
  }
  const c = toCategory(val);
  return c === null ? { valid: false, reason: 'invalid_string' } : { valid: true, reason: null };
}

export function computeDq03(
  colTypes: { column: string; dataType: string }[],
  rows: { rowIndex: number; values: Record<string, unknown> }[],
): { column: string; validCount: number; invalidCount: number; invalidRate: number | null; reasons: Record<string, number> }[] {
  return colTypes.map(({ column, dataType }) => {
    let validCount = 0;
    let invalidCount = 0;
    let missing = 0;
    const reasons: Record<string, number> = {};
    for (const r of rows) {
      const v = r.values[column];
      if (isMissingCell(v) || isMissingValue(v)) {
        if (isMissingCell(v)) missing++;
        else {
          invalidCount++;
          reasons['symbol_as_missing_excluded_from_dq01'] = (reasons['symbol_as_missing_excluded_from_dq01'] ?? 0) + 1;
        }
        continue;
      }
      const res = isValidByType(v, dataType);
      if (res.valid) validCount++;
      else {
        invalidCount++;
        const k = res.reason ?? 'invalid';
        reasons[k] = (reasons[k] ?? 0) + 1;
      }
    }
    const denom = validCount + invalidCount;
    void missing;
    return { column, validCount, invalidCount, invalidRate: denom > 0 ? round4(invalidCount / denom) : null, reasons };
  });
}

export interface OutlierResult {
  column: string;
  method: 'iqr' | 'modified_zscore' | 'both';
  iqrOutliers: number[];
  iqrExtremeOutliers: number[];
  zOutliers: number[];
  union: number[];
  intersection: number[];
  usedRows: number;
  excludedRows: number;
  iqrDispersionOk: boolean;
  madDispersionOk: boolean;
  reason: string | null;
}

function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  if (next === undefined) return sorted[base] as number;
  return (sorted[base] as number) + rest * (next - (sorted[base] as number));
}

/** DQ-04: IQR 1.5x/3x + Modified Z-score 3.5. IQR=0/MAD=0 -> bao khong du phan tan, khong ket luan. */
export function detectOutliers(
  column: string,
  values: { rowIndex: number; value: number }[],
  method: 'iqr' | 'modified_zscore' | 'both' = 'iqr',
): OutlierResult {
  const base = {
    column, method, iqrOutliers: [] as number[], iqrExtremeOutliers: [] as number[],
    zOutliers: [] as number[], union: [] as number[], intersection: [] as number[],
    usedRows: values.length, excludedRows: 0, iqrDispersionOk: true, madDispersionOk: true, reason: null as string | null,
  };
  if (values.length < 4) return { ...base, iqrDispersionOk: false, madDispersionOk: false, reason: 'insufficient_observations_min_4' };
  const nums = values.map((v) => v.value).sort((a, b) => a - b);
  const useIqr = method === 'iqr' || method === 'both';
  const useZ = method === 'modified_zscore' || method === 'both';
  let iqrSet = new Set<number>();
  let extremeSet = new Set<number>();
  if (useIqr) {
    const q1 = quantileSorted(nums, 0.25);
    const q3 = quantileSorted(nums, 0.75);
    const iqr = q3 - q1;
    if (!(iqr > 0)) {
      base.iqrDispersionOk = false;
      base.reason = 'iqr_zero_insufficient_dispersion';
    } else {
      const lo = q1 - 1.5 * iqr;
      const hi = q3 + 1.5 * iqr;
      const loX = q1 - 3 * iqr;
      const hiX = q3 + 3 * iqr;
      for (const v of values) {
        if (v.value < lo || v.value > hi) iqrSet.add(v.rowIndex);
        if (v.value < loX || v.value > hiX) extremeSet.add(v.rowIndex);
      }
    }
  }
  let zSet = new Set<number>();
  if (useZ) {
    const med = ss.median(nums);
    const deviations = nums.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
    const mad = ss.median(deviations);
    if (!(mad > 0)) {
      base.madDispersionOk = false;
      base.reason = base.reason ? `${base.reason};mad_zero_insufficient_dispersion` : 'mad_zero_insufficient_dispersion';
    } else {
      for (const v of values) {
        const mz = (0.6745 * (v.value - med)) / mad;
        if (Math.abs(mz) > 3.5) zSet.add(v.rowIndex);
      }
    }
  }
  void iqrSet;
  void extremeSet;
  void zSet;
  const iqrArr = [...iqrSet].sort((a, b) => a - b);
  const extArr = [...extremeSet].sort((a, b) => a - b);
  const zArr = [...zSet].sort((a, b) => a - b);
  const activeSets: Set<number>[] = [];
  if (useIqr) activeSets.push(iqrSet);
  if (useZ) activeSets.push(zSet);
  const union = new Set<number>();
  for (const s of activeSets) for (const x of s) union.add(x);
  let intersection: number[] = [];
  if (activeSets.length === 2) {
    intersection = [...activeSets[0] as Set<number>].filter((x) => (activeSets[1] as Set<number>).has(x)).sort((a, b) => a - b);
  } else if (activeSets.length === 1) {
    intersection = [...union].sort((a, b) => a - b);
  }
  return {
    ...base,
    iqrOutliers: useIqr ? iqrArr : [],
    iqrExtremeOutliers: useIqr ? extArr : [],
    zOutliers: useZ ? zArr : [],
    union: [...union].sort((a, b) => a - b),
    intersection,
  };
}
