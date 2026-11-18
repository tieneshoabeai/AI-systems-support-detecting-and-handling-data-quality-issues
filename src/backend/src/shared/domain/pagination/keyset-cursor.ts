import { CursorCodec } from './cursor-codec';
import type { ListCursor } from '../utils/list-cursor';

/**
 * Tiện ích dùng chung cho keyset cursor.
 *
 * Con trỏ là chuỗi Base64 URL-safe, mã hoá 4 thành phần:
 *   - `s`: mã loại sắp xếp (để phát hiện client dùng lại cursor với tham số sort khác)
 *   - `k`: giá trị của trường sắp xếp tại phần tử cuối của trang trước
 *          (ISO-8601 nếu trường là ngày, chuỗi thuần nếu trường là text)
 *   - `n`: `1` nếu giá trị trường sắp xếp tại phần tử cuối là `null`
 *   - `id`: `_id` (hex) của phần tử cuối — dùng làm tiebreaker khi giá trị sort bằng nhau
 *
 * Nguyên tắc: phân trang keyset luôn ổn định (không bị trôi/trùng dữ liệu khi có
 * insert/delete giữa các lần gọi), khác với offset pagination.
 */

export interface KeysetCursorPayload {
  /** Mã loại sắp xếp. */
  s: string;
  /** Giá trị trường sắp xếp của phần tử cuối (string). */
  k: string;
  /** `1` nếu giá trị trường sắp xếp là `null`. */
  n: 0 | 1;
  /** `_id` hex của phần tử cuối. */
  id: string;
}

/** Mã hoá payload thành con trỏ opaque. */
export function encodeKeysetCursor(payload: KeysetCursorPayload): string {
  return CursorCodec.encode({
    s: payload.s,
    k: payload.k,
    n: payload.n === 1 ? 1 : 0,
    id: payload.id,
  });
}

/**
 * Giải mã con trỏ. Trả về `null` nếu con trỏ hỏng / không đúng định dạng.
 */
export function decodeKeysetCursor(cursor: string): KeysetCursorPayload | null {
  const raw = CursorCodec.decode<Record<string, unknown>>(cursor);
  if (!raw) return null;
  const s = typeof raw.s === 'string' ? raw.s : null;
  const k = typeof raw.k === 'string' ? raw.k : null;
  const id = typeof raw.id === 'string' ? raw.id : null;
  if (!s || k === null || !id) return null;
  const n = raw.n === 1 ? 1 : 0;
  return { s, k, n, id };
}

/** Lỗi con trỏ không hợp lệ — tầng application chuyển thành 400 VALIDATION_ERROR. */
export class InvalidCursorError extends Error {
  constructor(message = 'Cursor không hợp lệ') {
    super(message);
    this.name = 'InvalidCursorError';
  }
}

/**
 * Giải mã + kiểm tra con trỏ cho một mã sắp xếp cụ thể.
 *
 * @param rawCursor     Con trỏ opaque do client gửi lên (undefined = trang đầu).
 * @param expectedSort  Mã sắp xếp hiện tại của request.
 * @throws InvalidCursorError khi con trỏ hỏng hoặc sinh từ tham số sort khác.
 */
export function parseListCursor(
  rawCursor: string | undefined,
  expectedSort: string,
): ListCursor | undefined {
  if (!rawCursor) return undefined;

  const decoded = decodeKeysetCursor(rawCursor);
  if (!decoded) throw new InvalidCursorError();

  if (decoded.s !== expectedSort) {
    throw new InvalidCursorError(
      'Cursor không khớp với tham số sort hiện tại. Vui lòng bắt đầu lại từ trang đầu.',
    );
  }

  return {
    sortCode: decoded.s,
    value: decoded.k,
    isNull: decoded.n === 1,
    id: decoded.id,
  };
}
