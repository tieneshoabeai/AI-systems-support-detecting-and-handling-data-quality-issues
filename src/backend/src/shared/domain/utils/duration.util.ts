/**
 * Utility thuần: phân tích chuỗi thời lượng kiểu "15m", "7d", "30d", "3600" → mili giây.
 *
 * Dùng cho TTL phiên đăng nhập (nhớ đăng nhập 30 ngày vs 7 ngày) và các cấu hình
 * thời hạn khác. Hàm thuần tuyệt đối — không phụ thuộc framework (được phép dùng
 * từ tầng `domain` theo quy tắc CA11 của kiểm thử kiến trúc).
 */

/** 1 phút / 1 giờ / 1 ngày tính theo mili giây. */
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: MINUTE_MS,
  h: HOUR_MS,
  d: DAY_MS,
  w: 7 * DAY_MS,
};

export const DEFAULT_DURATION_MS = 0;

/**
 * Phân tích thời lượng.
 * - "30d" → 30 ngày
 * - "15m" → 15 phút
 * - "3600" → 3600 giây (không có đơn vị ⇒ giây)
 * - Trả về `fallbackMs` nếu chuỗi rỗng/không hợp lệ.
 */
export function parseDurationMs(value: string | null | undefined, fallbackMs: number): number {
  if (typeof value !== 'string') return fallbackMs;
  const raw = value.trim().toLowerCase();
  if (raw.length === 0) return fallbackMs;

  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)?$/.exec(raw);
  if (!match) return fallbackMs;

  const amount = Number.parseFloat(match[1] ?? '');
  if (!Number.isFinite(amount) || amount < 0) return fallbackMs;

  const unit = match[2] ?? 's';
  const unitMs = UNIT_MS[unit];
  if (unitMs === undefined) return fallbackMs;

  return Math.floor(amount * unitMs);
}
