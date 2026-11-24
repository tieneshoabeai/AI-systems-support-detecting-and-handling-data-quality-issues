import { CursorCodec } from './cursor-codec';
import { ValidationError } from '../errors';
import { computeSha256Buffer } from '../crypto/crypto.util';

/**
 * Con trỏ keyset cho bản ghi dataset (Data Views — Phần 7 v13 mục 3.23).
 *
 * Khác `keyset-cursor.ts` (một trường chuỗi + `_id`, dùng cho danh sách
 * workspace/project): bản ghi có thể sắp theo **nhiều cột**, mỗi cột có kiểu
 * riêng (số / ngày / chuỗi / boolean), và hoà được phá bằng `row_index`.
 *
 * Hai dạng payload:
 *  - **Không sort:** `{ row_index }` — giữ nguyên dạng cũ của `GET /records`.
 *  - **Có sort:** `{ v: 1, s: [[key, order]…], k: [[tag, value]…], r: rowIndex }`
 *    - `s` = chữ ký sort, phát hiện cursor dùng lại với sort khác (§3.7 quy tắc 1).
 *    - `k` = giá trị sort **đã ép kiểu phía MongoDB** của dòng cuối trang trước;
 *      `tag`: `z` null · `f` số (lưu dạng chuỗi để giữ được `Infinity`/`NaN`)
 *      · `d` ngày (ISO) · `s` chuỗi · `b` boolean.
 *
 * Từ v16 (DL-3): `DataViewService` bọc hai dạng trên thêm một lớp
 *   `{ b: 1, c, q, t }` (mã băm bộ lọc + thời điểm cấp) — xem `bindRecordCursor`.
 *
 * Hàm thuần — không phụ thuộc NestJS/Mongoose.
 */

export type SortOrder = 'asc' | 'desc';
export type RecordSortSignature = ReadonlyArray<readonly [string, SortOrder]>;
export type RecordKeysetValue = string | number | boolean | Date | null;

export interface RecordKeysetPosition {
  values: RecordKeysetValue[];
  rowIndex: number;
}

type Tagged = ['z', null] | ['f', string] | ['d', string] | ['s', string] | ['b', boolean];

const INVALID = 'Cursor khong hop le (opaque cursor sai dinh dang)';
const MISMATCH = 'Cursor khong khop voi tham so sort hien tai. Vui long bat dau lai tu trang dau.';

function isRowIndex(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function tag(value: RecordKeysetValue): Tagged {
  if (value === null || value === undefined) return ['z', null];
  if (value instanceof Date) return ['d', value.toISOString()];
  if (typeof value === 'number') return ['f', String(value)];
  if (typeof value === 'boolean') return ['b', value];
  return ['s', value];
}

function untag(raw: unknown): RecordKeysetValue {
  if (!Array.isArray(raw) || raw.length !== 2) throw new ValidationError(INVALID);
  const [t, v] = raw as [unknown, unknown];
  switch (t) {
    case 'z':
      if (v !== null) break;
      return null;
    case 'f': {
      if (typeof v !== 'string') break;
      const n = Number(v);
      if (Number.isNaN(n) && v !== 'NaN') break;
      return n;
    }
    case 'd': {
      if (typeof v !== 'string') break;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) break;
      return d;
    }
    case 's':
      if (typeof v !== 'string') break;
      return v;
    case 'b':
      if (typeof v !== 'boolean') break;
      return v;
    default:
      break;
  }
  throw new ValidationError(INVALID);
}

/** Mã hoá vị trí dòng cuối thành cursor opaque. `sort` rỗng → dạng `{ row_index }`. */
export function encodeRecordCursor(sort: RecordSortSignature, position: RecordKeysetPosition): string {
  if (sort.length === 0) return CursorCodec.encode({ row_index: position.rowIndex });
  return CursorCodec.encode({
    v: 1,
    s: sort.map(([k, o]) => [k, o]),
    k: position.values.map(tag),
    r: position.rowIndex,
  });
}

/**
 * Giải mã + kiểm tra cursor cho chữ ký sort hiện tại.
 *
 * @returns `undefined` khi không có cursor (trang đầu).
 * @throws ValidationError khi cursor hỏng, sai dạng, hoặc sinh từ sort khác.
 */
export function decodeRecordCursor(
  cursor: string | undefined,
  sort: RecordSortSignature,
): RecordKeysetPosition | undefined {
  if (!cursor) return undefined;
  const raw = CursorCodec.decode<Record<string, unknown>>(cursor);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationError(INVALID);

  if (sort.length === 0) {
    if ('v' in raw) throw new ValidationError(MISMATCH);
    if (!isRowIndex(raw.row_index)) throw new ValidationError(INVALID);
    return { values: [], rowIndex: raw.row_index };
  }

  if (!('v' in raw)) {
    // Cursor `{ row_index }` (sinh từ truy vấn không sort) dùng cho truy vấn có sort.
    if ('row_index' in raw) throw new ValidationError(MISMATCH);
    throw new ValidationError(INVALID);
  }
  if (raw.v !== 1 || !Array.isArray(raw.s) || !Array.isArray(raw.k) || !isRowIndex(raw.r)) {
    throw new ValidationError(INVALID);
  }
  const s = raw.s as unknown[];
  const sameSort =
    s.length === sort.length &&
    s.every((pair, i) => {
      const expected = sort[i];
      return (
        Array.isArray(pair) &&
        pair.length === 2 &&
        expected !== undefined &&
        pair[0] === expected[0] &&
        pair[1] === expected[1]
      );
    });
  if (!sameSort) throw new ValidationError(MISMATCH);
  const k = raw.k as unknown[];
  if (k.length !== sort.length) throw new ValidationError(INVALID);
  return { values: k.map(untag), rowIndex: raw.r };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ràng buộc cursor theo truy vấn + hạn 24 giờ (Phần 7 v16 mục 3.26 DL-1…DL-4,
// §3.7 quy tắc 2, 3 — đóng OPEN-DV-01).
//
// Cursor của port (`{ row_index }` hoặc `{ v, s, k, r }`) được **bọc** thêm một
// lớp ở tầng service: `{ b: 1, c: <cursor trong>, q: <mã băm truy vấn>, t: <ms> }`.
// Port `RECORD_QUERY_PORT` và repository không cần biết lớp bọc này.
// ─────────────────────────────────────────────────────────────────────────────

/** Thời gian sống của cursor (§3.7 quy tắc 3). */
export const RECORD_CURSOR_TTL_MS = 24 * 60 * 60 * 1000;

/** Cho phép lệch đồng hồ giữa các instance khi kiểm tra thời điểm cấp. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const EXPIRED = 'Cursor da het han (qua 24 gio). Vui long bat dau lai tu trang dau.';
const QUERY_MISMATCH =
  'Cursor khong khop voi bo loc / tim kiem hien tai. Vui long bat dau lai tu trang dau.';

/** Bộ lọc ở dạng tối thiểu để băm (shared không phụ thuộc kiểu của module datasets). */
export interface RecordQueryHashFilter {
  column: string;
  operator: string;
  value?: unknown;
}

/**
 * Mã băm của phần **lọc** của truy vấn: `filters` (đã quy về key `cN`) + `search`.
 *
 * - Không phụ thuộc thứ tự `filters` và `search.columns` (thứ tự không đổi kết quả).
 * - `search` rỗng hoặc toàn khoảng trắng = không tìm (DV-12) → băm như không có `search`.
 * - Không gồm `sort` (cursor trong đã gắn chữ ký sort) và `limit` (đổi `limit` vẫn hợp lệ).
 */
export function computeRecordQueryHash(
  filters: readonly RecordQueryHashFilter[],
  search?: { columns: readonly string[]; value: string },
): string {
  const f = filters.map((x) => JSON.stringify([x.column, x.operator, x.value ?? null])).sort();
  const s =
    search && search.value.trim().length > 0
      ? { c: [...search.columns].sort(), v: search.value }
      : null;
  return computeSha256Buffer(JSON.stringify({ f, s })).slice(0, 16);
}

export interface RecordCursorBinding {
  queryHash: string;
  /** Thời điểm hiện tại (ms) — mặc định `Date.now()`; nhận tham số để test. */
  now?: number;
}

/** Bọc cursor trong của port. `inner` rỗng → `null` (hết trang). */
export function bindRecordCursor(
  inner: string | null | undefined,
  binding: RecordCursorBinding,
): string | null {
  if (!inner) return null;
  return CursorCodec.encode({ b: 1, c: inner, q: binding.queryHash, t: binding.now ?? Date.now() });
}

/**
 * Gỡ lớp bọc, kiểm tra hạn và truy vấn.
 *
 * @returns cursor trong (để giải mã tiếp bằng `decodeRecordCursor`), hoặc `undefined` khi không có cursor.
 * @throws ValidationError — sai định dạng; `details.reason = 'cursor_expired'` khi quá hạn
 *   hoặc là cursor dạng cũ (cấp trước v16); `details.reason = 'cursor_query_mismatch'` khi lệch truy vấn.
 */
export function unbindRecordCursor(
  cursor: string | undefined,
  binding: RecordCursorBinding,
): string | undefined {
  if (!cursor) return undefined;
  const raw = CursorCodec.decode<Record<string, unknown>>(cursor);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationError(INVALID);
  if (!('b' in raw)) {
    // Cursor cấp trước v16 (chưa có thời điểm cấp) → coi như đã hết hạn.
    if ('row_index' in raw || 'v' in raw) {
      throw new ValidationError(EXPIRED, { reason: 'cursor_expired' });
    }
    throw new ValidationError(INVALID);
  }
  const { b, c, q, t } = raw;
  if (
    b !== 1 ||
    typeof c !== 'string' ||
    c.length === 0 ||
    typeof q !== 'string' ||
    typeof t !== 'number' ||
    !Number.isFinite(t)
  ) {
    throw new ValidationError(INVALID);
  }
  const now = binding.now ?? Date.now();
  if (t > now + CLOCK_SKEW_MS) throw new ValidationError(INVALID);
  if (now - t > RECORD_CURSOR_TTL_MS) {
    throw new ValidationError(EXPIRED, { reason: 'cursor_expired' });
  }
  if (q !== binding.queryHash) {
    throw new ValidationError(QUERY_MISMATCH, { reason: 'cursor_query_mismatch' });
  }
  return c;
}
