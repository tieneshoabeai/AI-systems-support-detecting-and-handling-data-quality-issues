import * as ss from 'simple-statistics';
import { Matrix, inverse, determinant } from 'ml-matrix';
export interface IVifRow { column: string; vif: number | null; flag: 'ok' | 'review' | 'high'; computable: boolean; reason: string | null; }
import { toFiniteNumber } from './correlation.util';

export interface VifComputation {
  columns: string[];
  rows: IVifRow[];
  commonN: number;
  totalScanned: number;
  commonNRate: number | null;
  lossWarning: string | null;
  excluded: { column: string; reason: string }[];
  singular: boolean;
}

function withRate(commonN: number, totalScanned: number): { commonNRate: number | null; lossWarning: string | null } {
  if (totalScanned <= 0) return { commonNRate: null, lossWarning: null };
  const rate = Number((commonN / totalScanned).toFixed(4));
  const loss = 1 - rate;
  let lossWarning: string | null = null;
  if (loss >= 0.5) {
    lossWarning = `mat_${Math.round(loss*100)}_phan_tram_dong_do_thieu_rac_vif_kem_tin`;
  } else if (loss >= 0.2) {
    lossWarning = `mat_${Math.round(loss*100)}_phan_tram_dong_can_than_trong_khi_doc_vif`;
  }
  return { commonNRate: rate, lossWarning };
}

function isConstant(values: number[]): boolean {
  if (values.length === 0) return true;
  // OPEN-10 — chỉ dùng để kiểm tra "có phân tán không", **không** xuất ra API
  // ⇒ dùng phân kỳ mẫu cho nhất quán với toàn hệ thống.
  const sd = values.length >= 2 ? ss.sampleStandardDeviation(values) : 0;
  return !(sd > 0);
}

function pearsonOnCommon(xs: number[], ys: number[]): number | null {
  if (xs.length < 2) return null;
  // OPEN-10 — chỉ dùng để kiểm tra "có phân tán không", không xuất ra API.
  const sx = ss.sampleStandardDeviation(xs);
  const sy = ss.sampleStandardDeviation(ys);
  if (!(sx > 0) || !(sy > 0)) return null;
  const c = ss.sampleCorrelation(xs, ys);
  if (!Number.isFinite(c)) return null;
  const clamped = Math.min(1, Math.max(-1, c));
  return clamped;
}

export function computeVif(
  numericColumns: string[],
  rows: Record<string, unknown>[],
): VifComputation {
  const totalScanned = rows.length;
  const excluded: { column: string; reason: string }[] = [];

  if (numericColumns.length < 2) {
    return {
      columns: [],
      rows: [],
      commonN: 0,
      totalScanned,
      ...withRate(0, totalScanned),
      excluded: numericColumns.map((c) => ({ column: c, reason: 'need_at_least_two_numeric_columns' })),
      singular: false,
    };
  }

  const matrix: number[][] = [];
  for (const row of rows) {
    const vals: number[] = [];
    let ok = true;
    for (const col of numericColumns) {
      const v = toFiniteNumber(row[col]);
      if (v === null) {
        ok = false;
        break;
      }
      vals.push(v);
    }
    if (ok) matrix.push(vals);
  }
  const commonN = matrix.length;

  if (commonN < numericColumns.length + 1) {
    return {
      columns: numericColumns,
      rows: numericColumns.map((column) => ({
        column,
        vif: null,
        flag: 'ok' as const,
        computable: false,
        reason: `insufficient_common_n_${commonN}_need_${numericColumns.length + 1}`,
      })),
      commonN,
      totalScanned,
      excluded,
      ...withRate(commonN, totalScanned),
      singular: false,
    };
  }

  const byCol: number[][] = numericColumns.map((_, j) => matrix.map((r) => r[j] ?? 0));
  const usableCols: string[] = [];
  const usableIdx: number[] = [];
  byCol.forEach((vals, j) => {
    const column = numericColumns[j];
    if (column === undefined) return;
    if (isConstant(vals)) {
      excluded.push({ column, reason: 'constant_column' });
    } else {
      usableCols.push(column);
      usableIdx.push(j);
    }
  });

  if (usableCols.length < 2) {
    return {
      columns: usableCols,
      rows: numericColumns.map((column) => {
        const ex = excluded.find((e) => e.column === column);
        if (ex) {
          return { column, vif: null, flag: 'ok' as const, computable: false, reason: ex.reason };
        }
        return { column, vif: null, flag: 'ok' as const, computable: false, reason: 'need_at_least_two_nonconstant_columns' };
      }),
      commonN,
      totalScanned,
      excluded,
      ...withRate(commonN, totalScanned),
      singular: false,
    };
  }

  const k = usableCols.length;
  const corr: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const rowI = corr[i];
      if (!rowI) continue;
      if (i === j) {
        rowI[j] = 1;
      } else if (j < i) {
        rowI[j] = corr[j]?.[i] ?? 0;
      } else {
        const c = pearsonOnCommon(
          usableIdx[i] !== undefined ? matrix.map((r) => r[usableIdx[i] as number] ?? 0) : [],
          usableIdx[j] !== undefined ? matrix.map((r) => r[usableIdx[j] as number] ?? 0) : [],
        );
        rowI[j] = c === null ? NaN : c;
      }
    }
  }

  const hasNaN = corr.some((row) => row.some((v) => !Number.isFinite(v)));
  if (hasNaN) {
    return {
      columns: usableCols,
      rows: numericColumns.map((column) => {
        if (!usableCols.includes(column)) {
          return { column, vif: null, flag: 'ok' as const, computable: false, reason: 'constant_column' };
        }
        return { column, vif: null, flag: 'ok' as const, computable: false, reason: 'undefined_pairwise_correlation' };
      }),
      commonN,
      totalScanned,
      excluded,
      ...withRate(commonN, totalScanned),
      singular: false,
    };
  }

  // Cộng tuyến hoàn hảo/gần hoàn hảo (|r| ~ 1): coi như suy biến, không bịa VIF hữu hạn.
  let maxAbsOffDiag = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const value = corr[i]?.[j];
      if (i !== j && value !== undefined && Number.isFinite(value)) {
        maxAbsOffDiag = Math.max(maxAbsOffDiag, Math.abs(value));
      }
    }
  }
  let det = NaN;
  try {
    det = determinant(new Matrix(corr));
  } catch {
    det = NaN;
  }
  const nearSingular =
    maxAbsOffDiag >= 1 - 1e-12 || (Number.isFinite(det) && Math.abs(det) < 1e-12);

  let diag: number[] | null = null;
  let inverseThrew = false;
  try {
    const inv = inverse(new Matrix(corr));
    const arr = inv.to2DArray();
    diag = arr.map((row, i) => row[i] ?? 0);
  } catch {
    diag = null;
    inverseThrew = true;
  }

  const exploded =
    diag !== null && diag.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e12);
  if (diag === null || inverseThrew || nearSingular || exploded) {
    return {
      columns: usableCols,
      rows: numericColumns.map((column) => {
        if (!usableCols.includes(column)) {
          return { column, vif: null, flag: 'ok' as const, computable: false, reason: 'constant_column' };
        }
        return {
          column,
          vif: null,
          flag: 'ok' as const,
          computable: false,
          reason: 'perfect_linear_dependency_no_vif',
        };
      }),
      commonN,
      totalScanned,
      excluded,
      ...withRate(commonN, totalScanned),
      singular: true,
    };
  }

  const rowsOut: IVifRow[] = numericColumns.map((column) => {
    const ui = usableCols.indexOf(column);
    if (ui < 0) {
      return { column, vif: null, flag: 'ok' as const, computable: false, reason: 'constant_column' };
    }
    const raw = diag as number[];
    const rawValue = raw[ui];
    if (rawValue === undefined) {
      return { column, vif: null, flag: 'ok' as const, computable: false, reason: 'invalid_vif_value' };
    }
    const vif = Number(rawValue.toFixed(4));
    if (!Number.isFinite(vif) || vif < 1) {
      return { column, vif: null, flag: 'ok' as const, computable: false, reason: 'invalid_vif_value' };
    }
    const flag = vif > 10 ? 'high' : vif > 5 ? 'review' : 'ok';
    return { column, vif, flag, computable: true, reason: null };
  });

  return { columns: usableCols, rows: rowsOut, commonN, totalScanned, ...withRate(commonN, totalScanned), excluded, singular: false };
}
