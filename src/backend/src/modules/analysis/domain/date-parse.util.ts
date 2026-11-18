/**
 * Đợt G (Phần 2 v12 mục 3.44, Phần 12 v11 mục 3.20) — bộ đọc ngày CHẶT thay cho `new Date(chuỗi)`
 * (vốn nhận '2019-02-30' thành 02/03/2019 và nhận cả 'March 5').
 *
 * Định dạng nhận:
 *  - YYYY-MM-DD, YYYY/MM/DD; ISO ngày–giờ YYYY-MM-DD[T| ]HH:mm[:ss[.SSS]][Z|±HH:mm]
 *  - DD/MM/YYYY hoặc MM/DD/YYYY (phân cách / - .), có thể kèm HH:mm[:ss]
 * Ngày–giờ không có múi giờ được hiểu là UTC (đúng ghi chú trong Tổng kết/PDF).
 */

export type DayMonthOrder = 'dmy' | 'mdy';
/** Kết quả phân định thứ tự ngày/tháng của một cột. `null` = cột không có giá trị dạng DD/MM/YYYY. */
export type DayMonthDetection = DayMonthOrder | 'ambiguous' | 'conflict' | null;

export type DateParseResult =
  | { ok: true; date: Date }
  | { ok: false; reason: 'invalid_date_format' | 'nonexistent_date' };

const ISO_RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/;
const DMY_RE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function build(
  y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0, tz: string | undefined = undefined,
): DateParseResult {
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo) || h > 23 || mi > 59 || s > 59) {
    return { ok: false, reason: 'nonexistent_date' };
  }
  let t = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  if (tz && tz !== 'Z') {
    const m = /^([+-])(\d{2}):?(\d{2})$/.exec(tz);
    if (!m) return { ok: false, reason: 'invalid_date_format' };
    const off = (Number(m[2]) * 60 + Number(m[3])) * 60000 * (m[1] === '+' ? 1 : -1);
    if (Number(m[2]) > 14 || Number(m[3]) > 59) return { ok: false, reason: 'nonexistent_date' };
    t -= off;
  }
  return { ok: true, date: new Date(t) };
}

/**
 * Đọc một ô ngày.
 * @param order thứ tự ngày/tháng cho dạng DD/MM/YYYY: 'dmy' | 'mdy' | 'either' (hợp lệ theo một trong hai, ưu tiên DD/MM)
 */
export function parseStrictDate(value: unknown, order: DayMonthOrder | 'either' = 'either'): DateParseResult {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? { ok: false, reason: 'invalid_date_format' } : { ok: true, date: value };
  if (typeof value !== 'string') return { ok: false, reason: 'invalid_date_format' };
  const s = value.trim();
  const iso = ISO_RE.exec(s);
  if (iso) {
    const ms = iso[7] ? Number(iso[7].padEnd(3, '0')) : 0;
    return build(Number(iso[1]), Number(iso[2]), Number(iso[3]), Number(iso[4] ?? 0), Number(iso[5] ?? 0), Number(iso[6] ?? 0), ms, iso[8]);
  }
  const dm = DMY_RE.exec(s);
  if (dm) {
    const a = Number(dm[1]), b = Number(dm[2]), y = Number(dm[3]);
    const h = Number(dm[4] ?? 0), mi = Number(dm[5] ?? 0), sec = Number(dm[6] ?? 0);
    if (order === 'dmy') return build(y, b, a, h, mi, sec);
    if (order === 'mdy') return build(y, a, b, h, mi, sec);
    const asDmy = build(y, b, a, h, mi, sec);
    return asDmy.ok ? asDmy : build(y, a, b, h, mi, sec);
  }
  return { ok: false, reason: 'invalid_date_format' };
}

/**
 * Phân định thứ tự ngày/tháng của cột theo các giá trị dạng DD/MM/YYYY:
 * phần đầu > 12 → DD/MM; phần sau > 12 → MM/DD; cả hai phía đều có > 12 → 'conflict'; không phân định được → 'ambiguous'.
 */
export function detectDayMonthOrder(values: unknown[]): DayMonthDetection {
  let seen = false;
  let firstOver = false;
  let secondOver = false;
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const m = DMY_RE.exec(v.trim());
    if (!m) continue;
    seen = true;
    if (Number(m[1]) > 12) firstOver = true;
    if (Number(m[2]) > 12) secondOver = true;
  }
  if (!seen) return null;
  if (firstOver && secondOver) return 'conflict';
  if (firstOver) return 'dmy';
  if (secondOver) return 'mdy';
  return 'ambiguous';
}

/** Chế độ đọc dùng cho DQ-03 / phân tích thời gian từ kết quả phân định. Mâu thuẫn → giữ DD/MM theo mặc định. */
export function orderModeFor(detection: DayMonthDetection): DayMonthOrder | 'either' {
  if (detection === 'dmy' || detection === 'mdy') return detection;
  if (detection === 'conflict') return 'dmy';
  return 'either';
}
