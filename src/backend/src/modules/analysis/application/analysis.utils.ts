import { maskForAi, truncateChars } from '../domain/pii-mask.util';
import type { AnalysisRole } from '../domain/column-role.util';
/**
 * ANALYSIS — Hàm thuần dùng chung cho handlers.
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 *
 * OPEN-07/GĐ2 — Giá trị thường (không PII, không identifier/text) được gửi
 * thô (cắt 40 ký tự) thay vì loại bỏ. Chỉ ô thiếu mới trả `null` để caller
 * bỏ qua. Cột PII / giá trị khớp regex PII → `***`. Cột identifier/text →
 * dạng mẫu (shape) để không lộ danh tính mà AI vẫn thấy phân bố.
 */

export function maskSampleValue(
  value: unknown,
  columnMarkedPII: boolean,
  role?: AnalysisRole | null,
): string | null {
  const masked = maskForAi(value, {
    markedPii: columnMarkedPII,
    role: role ?? null,
  });
  if (masked === null) return null;
  return masked.value;
}

/** Giữ export cũ cho test/support: cắt thô theo code point. */
export { truncateChars };
