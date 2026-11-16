import { maskCell } from '../domain/pii-mask.util';
/**
 * ANALYSIS — Hàm thuần dùng chung cho handlers.
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 */

export function maskSampleValue(value: unknown, columnMarkedPII: boolean): string | null {
  const res = maskCell(value, columnMarkedPII);
  if (res.dropped) return null;
  if (res.value !== null) return res.value;
  return 'null';
}
