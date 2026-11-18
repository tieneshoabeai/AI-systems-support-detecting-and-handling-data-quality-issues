/**
 * E1 — du lieu bieu do (Phan 2 v10 muc 3.21/3.42, Phan 12 v9 muc 3.18). Ham thuan, backend chi tra
 * so lieu; giao dien tu ve. Diem ngoai rau box plot chi la "co the bat thuong", khong mac dinh la loi.
 */

export const DEFAULT_CHART_TOP_N = 5;
export const MAX_HISTOGRAM_BINS = 50;

export interface HistogramBin { from: number; to: number; count: number }
export interface Histogram { column: string; method: 'freedman_diaconis' | 'sturges' | 'single_value'; bins: HistogramBin[] }
export interface BoxPlot {
  column: string;
  q1: number; median: number; q3: number;
  whiskerLow: number; whiskerHigh: number;
  outsideCount: number; n: number;
}
export interface CategoryChart {
  column: string;
  topN: number;
  items: { value: string; count: number; rate: number }[];
  other: { count: number; rate: number } | null;
  distinctCount: number;
}
export interface ChartData {
  missingRate: { column: string; missingRate: number | null }[];
  histograms: Histogram[];
  boxPlots: BoxPlot[];
  categories: CategoryChart[];
  timeSeries: { period: string; recordCount: number }[] | null;
}

const r4 = (v: number): number => Number(v.toFixed(4));

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const next = sorted[base + 1];
  const cur = sorted[base] as number;
  return next === undefined ? cur : cur + (pos - base) * (next - cur);
}

export function clampChartTopN(v: unknown): number {
  const n = typeof v === 'number' ? Math.floor(v) : NaN;
  return Number.isFinite(n) ? Math.min(20, Math.max(1, n)) : DEFAULT_CHART_TOP_N;
}

/** Freedman–Diaconis `2·IQR·n^(-1/3)`; IQR = 0 -> Sturges `ceil(log2 n) + 1`; toi da 50 bin. */
export function histogram(column: string, values: number[]): Histogram | null {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const min = xs[0] as number;
  const max = xs[xs.length - 1] as number;
  if (min === max) return { column, method: 'single_value', bins: [{ from: r4(min), to: r4(max), count: xs.length }] };
  const iqr = quantile(xs, 0.75) - quantile(xs, 0.25);
  let method: Histogram['method'] = 'freedman_diaconis';
  let k: number;
  if (iqr > 0) {
    const width = 2 * iqr * Math.cbrt(1 / xs.length);
    k = Math.ceil((max - min) / width);
  } else {
    method = 'sturges';
    k = Math.ceil(Math.log2(xs.length)) + 1;
  }
  k = Math.min(MAX_HISTOGRAM_BINS, Math.max(1, k));
  const w = (max - min) / k;
  const counts = new Array<number>(k).fill(0);
  for (const v of xs) {
    const i = Math.min(k - 1, Math.floor((v - min) / w));
    counts[i] = (counts[i] as number) + 1;
  }
  return {
    column,
    method,
    bins: counts.map((count, i) => ({ from: r4(min + i * w), to: r4(i === k - 1 ? max : min + (i + 1) * w), count })),
  };
}

export function boxPlot(column: string, values: number[]): BoxPlot | null {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const q1 = quantile(xs, 0.25);
  const q3 = quantile(xs, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const inside = xs.filter((v) => v >= lo && v <= hi);
  return {
    column,
    q1: r4(q1),
    median: r4(quantile(xs, 0.5)),
    q3: r4(q3),
    whiskerLow: r4((inside[0] ?? q1) as number),
    whiskerHigh: r4((inside[inside.length - 1] ?? q3) as number),
    outsideCount: xs.length - inside.length,
    n: xs.length,
  };
}

/** Top N gia tri pho bien + gop phan con lai vao "Khac". Ty le tinh tren so gia tri khong thieu. */
export function categoryTopN(column: string, values: string[], topN: number): CategoryChart | null {
  if (values.length === 0) return null;
  const n = clampChartTopN(topN);
  const freq = new Map<string, number>();
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1);
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const total = values.length;
  const top = sorted.slice(0, n);
  const restCount = sorted.slice(n).reduce((s, [, c]) => s + c, 0);
  return {
    column,
    topN: n,
    items: top.map(([value, count]) => ({ value, count, rate: r4(count / total) })),
    other: restCount > 0 ? { count: restCount, rate: r4(restCount / total) } : null,
    distinctCount: freq.size,
  };
}
