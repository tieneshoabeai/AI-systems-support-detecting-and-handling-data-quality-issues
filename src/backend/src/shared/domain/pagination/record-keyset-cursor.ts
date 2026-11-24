import { CursorCodec } from './cursor-codec';
import { ValidationError } from '../errors';

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
