/**
 * Đợt G (Phần 2 v12 mục 3.44) — danh sách ký hiệu "thiếu" dùng chung cho suy kiểu cột, DQ-03, tương quan
 * và nghi vấn `missing_token`. So khớp sau khi bỏ khoảng trắng, không phân biệt hoa/thường.
 * Lưu ý spec 3.5.1: các ký hiệu này KHÔNG được tính là thiếu ở DQ-01 (DQ-01 chỉ đếm ô rỗng/khoảng trắng).
 */
export const MISSING_TOKENS: ReadonlySet<string> = new Set([
  'na', 'n/a', 'null', 'none', '-', '--', '?', 'nan', '#n/a', 'undefined', 'unknown',
]);

/** true nếu chuỗi (đã trim, lowercase) là một ký hiệu thiếu. Chuỗi rỗng KHÔNG phải ký hiệu. */
export function isMissingToken(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const t = value.trim().toLowerCase();
  return t !== '' && MISSING_TOKENS.has(t);
}
