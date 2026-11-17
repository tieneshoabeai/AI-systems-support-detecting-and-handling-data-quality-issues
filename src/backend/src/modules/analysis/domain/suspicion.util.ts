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
import { nameTokens, type AnalysisRole } from './column-role.util';

export type SuspicionKind =
  | 'missing_token'
  | 'case_variant'
  | 'whitespace'
  | 'sentinel'
  | 'constant_column'
  | 'ambiguous_date_format'
  // Đợt H (Phần 2 v13 mục 3.45)
  | 'identifier_not_unique'
  | 'duplicate_key'
  | 'locale_number_format'
  | 'conditional_missing'
  | 'leading_zero_numeric';

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

/** Đợt H: token tên cột gợi ý khóa nghiệp vụ (dùng cho `duplicate_key`). */
export const BUSINESS_KEY_NAME_TOKENS: readonly string[] = ['email', 'mail', 'phone', 'mobile', 'tel', 'tax', 'mst', 'cccd', 'cmnd', 'passport'];
/** Đợt H: dạng số theo vùng / tiền tệ (ô chuỗi không đọc được bằng Number). */
const LOCALE_NUMBER_RES: readonly RegExp[] = [
  /^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/, // 1.200,50 · 1.200.000
  /^[+-]?\d{1,3}( \d{3})+(,\d+)?$/, // 1 200,50
  /^[+-]?\d+,\d+$/, // 12,5
  /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/, // 1,200 · 1,200.50
  /^(?:[$€£₫]|VND|USD|EUR)\s?[+-]?[\d.,\s]*\d$/i, // $1,200 · VND 1.200
  /^[+-]?\d[\d.,\s]*\s?(?:[$€£₫đ]|VND|USD|EUR)$/i, // 1.200 ₫ · 1200đ
];
/** Đợt H: cột khóa nghiệp vụ phải có tỷ lệ giá trị khác nhau ≥ 80% số ô có dữ liệu. */
const BUSINESS_KEY_MIN_DISTINCT_RATIO = 0.8;
const LEADING_ZERO_MIN_RATE = 0.3;
const SAME_LENGTH_MIN_RATE = 0.9;
const CONDITIONAL_MISSING_MIN_RATE = 0.1;
const CONDITIONAL_GROUP_MIN_ROWS = 5;
const CONDITIONAL_MAX_CATEGORY_COLUMNS = 10;
const CONDITIONAL_MAX_CATEGORY_DISTINCT = 20;
const normKey = (v: unknown): string => String(v).trim().toLowerCase().replace(/\s+/g, ' ');

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

    // ---- Đợt H: cột định danh có giá trị lặp
    if (col.role === 'identifier' && present.length >= 2) {
      const counts = new Map<string, number>();
      for (const v of present) {
        const k = String(v).trim();
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      const dups = [...counts.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
      if (dups.length > 0) {
        const cnt = dups.reduce((a, [, n]) => a + n, 0);
        out.push({
          kind: 'identifier_not_unique', column: col.name, count: cnt, rate: rate(cnt),
          examples: dups.slice(0, MAX_EXAMPLES).map(([v, n]) => `${mask(v)} ×${n}`),
          message: `Cột định danh "${col.name}" có ${dups.length} giá trị xuất hiện nhiều lần (${cnt} ô) — một mã đang dùng cho nhiều bản ghi.`,
          recommendation: 'Xác nhận mã có phải duy nhất không; nếu phải, kiểm tra bản ghi trùng hoặc mã bị cấp lặp tại nguồn.',
        });
      }
    }

    if (col.dataType === 'number') {
      const strs = present.filter((v): v is string => typeof v === 'string').map((v) => v.trim());
      // ---- Đợt H: số viết theo vùng / tiền tệ (không đọc được thành số)
      const loc = strs.filter((v) => toFiniteNumber(v) === null && LOCALE_NUMBER_RES.some((re) => re.test(v)));
      if (loc.length > 0) {
        out.push({
          kind: 'locale_number_format', column: col.name, count: loc.length, rate: rate(loc.length),
          examples: [...new Set(loc.map(mask))].slice(0, MAX_EXAMPLES),
          message: `${loc.length} ô của "${col.name}" có dạng số viết theo vùng hoặc kèm ký hiệu tiền tệ (vd 1.200,50); hệ thống không tự chuyển đổi nên các ô này đang được tính sai định dạng (DQ-03).`,
          recommendation: 'Xác nhận dấu thập phân/ngăn nghìn với nguồn và chuẩn hóa về một định dạng số trước khi nạp.',
        });
      }
      // ---- Đợt H: chuỗi số có số 0 đầu, cùng độ dài → có thể là mã
      const lz = strs.filter((v) => /^0\d+$/.test(v));
      if (present.length >= 2 && lz.length / present.length >= LEADING_ZERO_MIN_RATE) {
        const lens = new Map<number, number>();
        for (const v of present) {
          const L = String(v).trim().length;
          lens.set(L, (lens.get(L) ?? 0) + 1);
        }
        const modeLen = Math.max(...lens.values());
        if (modeLen / present.length >= SAME_LENGTH_MIN_RATE) {
          out.push({
            kind: 'leading_zero_numeric', column: col.name, count: lz.length, rate: rate(lz.length),
            examples: [...new Set(lz.map(mask))].slice(0, MAX_EXAMPLES),
            message: `${lz.length} ô của "${col.name}" bắt đầu bằng số 0 và các giá trị cùng độ dài — có thể là mã (bưu chính, điện thoại), đọc như số sẽ mất số 0 đầu.`,
            recommendation: 'Xác nhận cột là mã; nếu đúng, đặt kiểu cột là văn bản ở Data Views.',
          });
        }
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
        const occ = new Map<number, number>();
        for (const n of nums) if (SENTINEL_VALUES.has(n)) occ.set(n, (occ.get(n) ?? 0) + 1);
        // ≥ 2 lần và ngoài hàng rào 3×IQR; Đợt H: hoặc sentinel ÂM xuất hiện đúng 1 lần ở cột không có giá trị âm nào khác
        // (cột dải rộng có thể chứa -999 trong hàng rào, dấu âm đơn lẻ mới là tín hiệu)
        const kept = [...occ.entries()].filter(([v, c]) =>
          (c >= 2 && (v < lo || v > hi)) || (c === 1 && v < 0 && !nums.some((n) => n < 0 && n !== v)));
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

  out.push(...detectDuplicateKeys(columns, rows, rate));
  out.push(...detectConditionalMissing(columns, rows, rate));
  return out;
}

/** Đợt H: dòng trùng theo khóa nghiệp vụ (email/điện thoại…) nhưng không trùng toàn bộ (DQ-02). */
function detectDuplicateKeys(
  columns: SuspicionColumn[],
  rows: Record<string, unknown>[],
  rate: (n: number) => number | null,
): Suspicion[] {
  // Cột khóa: tên có token khóa VÀ gần như duy nhất (vd loại `tax_rate`, `phone_type`)
  const keyCols = columns.filter((c) => {
    if (!nameTokens(c.name).some((t) => BUSINESS_KEY_NAME_TOKENS.includes(t))) return false;
    const vals = rows.map((r) => r[c.name]).filter((v) => !isMissingCell(v)).map(normKey);
    return vals.length >= 2 && new Set(vals).size / vals.length >= BUSINESS_KEY_MIN_DISTINCT_RATIO;
  });
  if (keyCols.length === 0) return [];
  if (keyCols.length === 1 && keyCols[0]?.role === 'identifier') return []; // đã có identifier_not_unique
  const groups = new Map<string, number[]>();
  rows.forEach((r, i) => {
    if (keyCols.some((c) => isMissingCell(r[c.name]))) return;
    const k = keyCols.map((c) => normKey(r[c.name])).join('\u0001');
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(i);
  });
  const full = (i: number): string => JSON.stringify(columns.map((c) => rows[i]?.[c.name] ?? null));
  const hit = [...groups.values()].filter((idx) => idx.length > 1 && new Set(idx.map(full)).size > 1);
  if (hit.length === 0) return [];
  const cnt = hit.reduce((a, g) => a + g.length, 0);
  const names = keyCols.map((c) => c.name).join(' + ');
  const maskKey = (i: number): string => keyCols
    .map((c) => maskForAi(rows[i]?.[c.name], { markedPii: c.isPii, role: c.role })?.value ?? '').join(' | ');
  return [{
    kind: 'duplicate_key', column: names, count: cnt, rate: rate(cnt),
    examples: hit.slice(0, MAX_EXAMPLES).map((g) => `${maskKey(g[0] as number)} ×${g.length}`),
    message: `${hit.length} nhóm (${cnt} dòng) có cùng ${names} (không phân biệt hoa/thường, khoảng trắng) nhưng khác ở các cột còn lại — có thể là cùng một đối tượng được nhập nhiều lần.`,
    recommendation: 'Xác nhận với nguồn đây là bản ghi trùng hay khác nhau; hệ thống không tự gộp.',
  }];
}

/** Đợt H: thiếu có cấu trúc — ô trống tập trung ở một số nhóm của một cột phân loại. */
function detectConditionalMissing(
  columns: SuspicionColumn[],
  rows: Record<string, unknown>[],
  rate: (n: number) => number | null,
): Suspicion[] {
  const total = rows.length;
  if (total === 0) return [];
  const cats = columns.filter((c) => c.role === 'category').filter((c) => {
    const d = new Set<string>();
    for (const r of rows) if (!isMissingCell(r[c.name])) d.add(String(r[c.name]).trim());
    return d.size >= 2 && d.size <= CONDITIONAL_MAX_CATEGORY_DISTINCT;
  }).slice(0, CONDITIONAL_MAX_CATEGORY_COLUMNS);
  const out: Suspicion[] = [];
  for (const x of columns) {
    const missIdx = rows.map((r, i) => (isMissingCell(r[x.name]) ? i : -1)).filter((i) => i >= 0);
    if (missIdx.length === 0 || missIdx.length / total < CONDITIONAL_MISSING_MIN_RATE) continue;
    let best: { c: SuspicionColumn; values: string[]; covered: number } | null = null;
    for (const c of cats) {
      if (c.name === x.name) continue;
      const stat = new Map<string, { n: number; miss: number }>();
      rows.forEach((r) => {
        if (isMissingCell(r[c.name])) return;
        const v = String(r[c.name]).trim();
        const st = stat.get(v) ?? { n: 0, miss: 0 };
        st.n++;
        if (isMissingCell(r[x.name])) st.miss++;
        stat.set(v, st);
      });
      const eligible = [...stat.entries()].filter(([, st]) => st.n >= CONDITIONAL_GROUP_MIN_ROWS);
      const high = eligible.filter(([, st]) => st.miss / st.n >= 0.9);
      const low = eligible.filter(([, st]) => st.miss / st.n <= 0.1);
      if (high.length === 0 || low.length === 0) continue;
      const covered = high.reduce((a, [, st]) => a + st.miss, 0);
      if (covered / missIdx.length < 0.9) continue;
      if (!best || covered > best.covered) best = { c, values: high.map(([v]) => v), covered };
    }
    if (!best) continue;
    const vals = best.values.map((v) => maskForAi(v, { markedPii: best!.c.isPii, role: best!.c.role })?.value ?? '');
    out.push({
      kind: 'conditional_missing', column: x.name, count: missIdx.length, rate: rate(missIdx.length),
      examples: [`${best.c.name} = ${vals.slice(0, MAX_EXAMPLES).join(' / ')}: ${best.covered}/${missIdx.length} ô trống`],
      message: `${best.covered}/${missIdx.length} ô trống của "${x.name}" nằm ở các dòng "${best.c.name}" = ${vals.slice(0, MAX_EXAMPLES).join(', ')} (gần như luôn trống ở các nhóm này) — thiếu có cấu trúc, có thể là hợp lệ. Mức ảnh hưởng DQ-01 không đổi.`,
      recommendation: `Xác nhận "${x.name}" có chỉ áp dụng cho một số giá trị của "${best.c.name}" không; nếu có, các ô trống còn lại mới là thiếu thật (khai báo luật ở DQ-05 khi có).`,
    });
  }
  return out;
}
