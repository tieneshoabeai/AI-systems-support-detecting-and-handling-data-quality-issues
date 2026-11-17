/**
 * Đợt G (Phần 2 v12 mục 3.44, Phần 12 v11 mục 3.20) — nhóm NGHI VẤN ("Cần xác nhận với nguồn").
 * Không phải lỗi đã xác nhận: không có mức ảnh hưởng, không vào danh sách vấn đề, không tự sửa dữ liệu,
 * không gửi AI. Chỉ hiển thị ở Tổng kết và PDF.
 */
import { isMissingToken } from '../../../shared/utils/missing-tokens.util';
import { isMissingCell } from './dq.util';
import { toFiniteNumber } from './correlation.util';
import { detectDayMonthOrder } from './date-parse.util';
import { maskForAi } from './pii-mask.util';
import type { AnalysisRole } from './column-role.util';

export type SuspicionKind =
  | 'missing_token'
  | 'case_variant'
  | 'whitespace'
  | 'sentinel'
  | 'constant_column'
  | 'ambiguous_date_format';

export interface Suspicion {
  kind: SuspicionKind;
  column: string;
  count: number;
  rate: number | null;
  examples: string[];
  message: string;
  recommendation: string;
}

export interface SuspicionColumn {
  name: string;
  dataType: string;
  role: AnalysisRole | null;
  isPii: boolean;
}

export const SENTINEL_VALUES: ReadonlySet<number> = new Set([-1, -9, -99, -999, -9999, 9999, 99999, 999999]);
const MAX_EXAMPLES = 5;
/** Cột chữ có quá nhiều giá trị khác nhau thì không gom biến thể (tốn bộ nhớ, ít ý nghĩa). */
const CASE_VARIANT_MAX_DISTINCT = 200;

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return (sorted[lo] as number) + (pos - lo) * ((sorted[hi] as number) - (sorted[lo] as number));
}

const r4 = (v: number): number => Math.round(v * 10000) / 10000;

export function detectSuspicions(columns: SuspicionColumn[], rows: Record<string, unknown>[]): Suspicion[] {
  const out: Suspicion[] = [];
  const total = rows.length;
  const rate = (n: number): number | null => (total > 0 ? r4(n / total) : null);

  for (const col of columns) {
    const mask = (v: unknown): string => maskForAi(v, { markedPii: col.isPii, role: col.role })?.value ?? '';
    const present = rows.map((r) => r[col.name]).filter((v) => !isMissingCell(v));

    // ---- cột hằng
    if (present.length >= 2) {
      const distinct = new Set(present.map((v) => String(v).trim()));
      if (distinct.size === 1) {
        out.push({
          kind: 'constant_column', column: col.name, count: present.length, rate: rate(present.length),
          examples: [mask(present[0])],
          message: `Cột "${col.name}" chỉ có một giá trị duy nhất trên ${present.length} ô có dữ liệu.`,
          recommendation: 'Xác nhận cột có còn ý nghĩa phân tích không (mặc định, sai cấu hình xuất dữ liệu?).',
        });
      }
    }

    if (col.dataType === 'string') {
      // ---- ký hiệu thiếu ở cột chữ
      const tokens = new Map<string, number>();
      for (const v of present) if (isMissingToken(v)) tokens.set(String(v).trim(), (tokens.get(String(v).trim()) ?? 0) + 1);
      const tokenCount = [...tokens.values()].reduce((a, b) => a + b, 0);
      if (tokenCount > 0) {
        out.push({
          kind: 'missing_token', column: col.name, count: tokenCount, rate: rate(tokenCount),
          examples: [...tokens.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_EXAMPLES).map(([k, n]) => `"${k}" ×${n}`),
          message: `${tokenCount} ô của "${col.name}" là ký hiệu thường dùng để ghi "không có dữ liệu" (${[...tokens.keys()].slice(0, MAX_EXAMPLES).join(', ')}). Theo DQ-01 các ô này không được tính là thiếu.`,
          recommendation: 'Xác nhận với nguồn đây là giá trị thật hay ký hiệu thiếu; nếu là thiếu thì chuẩn hóa thành ô trống tại nguồn.',
        });
      }

      // ---- khoảng trắng đầu/cuối
      const ws = present.filter((v) => typeof v === 'string' && v !== v.trim());
      if (ws.length > 0) {
        out.push({
          kind: 'whitespace', column: col.name, count: ws.length, rate: rate(ws.length),
          examples: [...new Set(ws.map(mask))].slice(0, MAX_EXAMPLES),
          message: `${ws.length} ô của "${col.name}" có khoảng trắng thừa ở đầu hoặc cuối (ví dụ đã bỏ khoảng trắng khi hiển thị).`,
          recommendation: 'Kiểm tra quy trình nhập/xuất dữ liệu; hệ thống không tự cắt khoảng trắng trong dữ liệu gốc.',
        });
      }

      // ---- biến thể hoa/thường của cùng giá trị
      if (col.role === 'category' || col.role === 'text') {
        const counts = new Map<string, number>();
        for (const v of present) {
          if (isMissingToken(v)) continue;
          const t = String(v).trim();
          counts.set(t, (counts.get(t) ?? 0) + 1);
        }
        if (counts.size <= CASE_VARIANT_MAX_DISTINCT) {
          const groups = new Map<string, [string, number][]>();
          for (const [v, n] of counts) {
            const k = v.toLowerCase().replace(/\s+/g, ' ');
            (groups.get(k) ?? groups.set(k, []).get(k)!).push([v, n]);
          }
          const variantGroups = [...groups.values()].filter((g) => g.length > 1);
          if (variantGroups.length > 0) {
            // số ô thuộc các cách viết ít gặp hơn trong mỗi nhóm
            const minority = variantGroups.reduce((s, g) => s + g.reduce((a, [, n]) => a + n, 0) - Math.max(...g.map(([, n]) => n)), 0);
            out.push({
              kind: 'case_variant', column: col.name, count: minority, rate: rate(minority),
              examples: variantGroups.slice(0, MAX_EXAMPLES).map((g) => g.sort((a, b) => b[1] - a[1]).map(([v, n]) => `${mask(v)} ×${n}`).join(' / ')),
              message: `"${col.name}" có ${variantGroups.length} giá trị được viết theo nhiều cách (khác hoa/thường hoặc khoảng trắng bên trong); ${minority} ô dùng cách viết ít gặp hơn.`,
              recommendation: 'Xác nhận các cách viết có cùng nghĩa không; hệ thống không tự gộp (spec 3.5.3).',
            });
          }
        }
      }
    }

    // ---- sentinel ở cột số
    if (col.dataType === 'number') {
      const nums = present.map((v) => toFiniteNumber(v)).filter((n): n is number => n !== null);
      if (nums.length >= 4) {
        const sorted = [...nums].sort((a, b) => a - b);
        const q1 = quantile(sorted, 0.25);
        const q3 = quantile(sorted, 0.75);
        const iqr = q3 - q1;
        const lo = q1 - 3 * iqr;
        const hi = q3 + 3 * iqr;
        const hits = new Map<number, number>();
        for (const n of nums) if (SENTINEL_VALUES.has(n) && (n < lo || n > hi)) hits.set(n, (hits.get(n) ?? 0) + 1);
        const kept = [...hits.entries()].filter(([, c]) => c >= 2);
        const cnt = kept.reduce((a, [, c]) => a + c, 0);
        if (cnt > 0) {
          out.push({
            kind: 'sentinel', column: col.name, count: cnt, rate: rate(cnt),
            examples: kept.map(([v, c]) => `${col.isPii ? '***' : v} ×${c}`),
            message: `"${col.name}" có giá trị ${kept.map(([v]) => (col.isPii ? '***' : v)).join(', ')} lặp lại và nằm xa vùng dữ liệu — thường là mã quy ước cho "không có dữ liệu".`,
            recommendation: 'Xác nhận với nguồn đây là mã thiếu hay giá trị thật; nếu là mã thiếu, các ô này đang bị tính vào thống kê và ngoại lệ (DQ-04).',
          });
        }
      }
    }

    // ---- ngày mơ hồ DD/MM hay MM/DD
    if (col.dataType === 'date') {
      const det = detectDayMonthOrder(present);
      if (det === 'ambiguous' || det === 'conflict') {
        const slash = present.filter((v) => typeof v === 'string' && /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}/.test(v.trim()));
        out.push({
          kind: 'ambiguous_date_format', column: col.name, count: slash.length, rate: rate(slash.length),
          examples: slash.slice(0, MAX_EXAMPLES).map(mask),
          message: det === 'ambiguous'
            ? `Không phân định được "${col.name}" là DD/MM/YYYY hay MM/DD/YYYY (mọi ngày và tháng đều ≤ 12); hệ thống chấp nhận cả hai cách đọc.`
            : `"${col.name}" có ngày vừa giống DD/MM vừa giống MM/DD ở các dòng khác nhau; hệ thống đọc theo DD/MM, các ô không hợp lệ theo DD/MM bị tính sai định dạng (DQ-03).`,
          recommendation: 'Xác nhận định dạng ngày với nguồn dữ liệu.',
        });
      }
    }
  }
  return out;
}
