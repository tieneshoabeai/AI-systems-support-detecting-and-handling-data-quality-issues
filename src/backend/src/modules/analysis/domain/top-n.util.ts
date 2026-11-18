/** `top_n` (ANALYSIS-01 config) — so phat hien toi da trong Tong ket/PDF; mac dinh 50 theo Phan 2 v9 muc 6.6. */
export const DEFAULT_TOP_N = 50;
export const MAX_TOP_N = 100; // giu nhu hop dong cu (DTO max 100)

export function resolveTopN(v: unknown): number {
  const n = typeof v === 'number' ? Math.floor(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_TOP_N) : DEFAULT_TOP_N;
}
