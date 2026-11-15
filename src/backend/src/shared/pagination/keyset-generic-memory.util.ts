import type { ListCursor } from '../utils/list-cursor';

/**
 * Keyset pagination "in-memory" dùng chung cho các danh sách được nạp sẵn
 * vào bộ nhớ (ví dụ: danh sách thành viên workspace/project nằm trong
 * document dạng embedded array).
 *
 * Quy ước so sánh giống hệt BSON của MongoDB:
 *   - `null` luôn nhỏ hơn mọi giá trị khác (kể cả chuỗi rỗng).
 *   - chuỗi so sánh lexicographic (hoặc số học nếu `toNumber` được cung cấp).
 *   - tiebreaker: `_id` (hex string) so sánh cùng chiều với trường sắp xếp.
 */

/** Bản ghi tối thiểu cần có để dựng con trỏ keyset trong bộ nhớ. */
export interface GenericSortable {
  id: string;
}

/** Hàm trích xuất giá trị sắp xếp (chuỗi) từ bản ghi. `null` = giá trị rỗng. */
export type SortValueAccessor<T> = (item: T) => string | null | undefined;

/** Chiều sắp xếp: 1 = tăng dần, -1 = giảm dần. */
export type SortDirection = 1 | -1;

/**
 * Đặc tả sắp xếp cho một danh sách in-memory.
 *
 * - `code`: mã sort dùng trong con trỏ (để phát hiện client đổi sort giữa chừng).
 * - `accessor`: lấy giá trị sắp xếp từ bản ghi.
 * - `toNumber`: nếu có, giá trị chuỗi được chuyển sang số để so sánh
 *   (dùng cho trường ngày — ISO-8601 so sánh lexicographic cũng hợp lệ
 *   nhưng chuyển sang số rõ ràng hơn).
 * - `direction`: chiều sắp xếp.
 */
export interface GenericSortSpec<T> {
  code: string;
  accessor: SortValueAccessor<T>;
  toNumber?: (value: string) => number;
  direction: SortDirection;
}

/** Giá trị sắp xếp chuẩn hoá (dạng chuỗi) + cờ null. */
export function genericSortValue<T>(
  item: T,
  accessor: SortValueAccessor<T>,
): { value: string; isNull: boolean } {
  const raw = accessor(item);
  if (raw === null || raw === undefined) return { value: '', isNull: true };
  return { value: raw, isNull: false };
}

/** So sánh 2 chuỗi theo quy tắc của spec (số học nếu có `toNumber`). */
function compareValues(
  a: string,
  b: string,
  toNumber?: (value: string) => number,
): number {
  if (toNumber) {
    const na = toNumber(a);
    const nb = toNumber(b);
    return na === nb ? 0 : na < nb ? -1 : 1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * So sánh 2 bản ghi theo trường sắp xếp + tiebreaker `_id`.
 * `null` được coi là nhỏ hơn mọi giá trị khác (khác với so sánh JS thuần).
 */
export function compareGeneric<T extends GenericSortable>(
  a: T,
  b: T,
  spec: GenericSortSpec<T>,
): number {
  const av = genericSortValue(a, spec.accessor);
  const bv = genericSortValue(b, spec.accessor);

  if (av.isNull !== bv.isNull) {
    // null luôn nhỏ hơn → nếu tăng dần thì null đứng trước.
    return av.isNull ? -spec.direction : spec.direction;
  }
  if (!av.isNull) {
    const cmp = compareValues(av.value, bv.value, spec.toNumber);
    if (cmp !== 0) return cmp * spec.direction;
  }
  return compareValues(a.id, b.id) * spec.direction;
}

/**
 * Kiểm tra một bản ghi có nằm SAU con trỏ hay không.
 *
 * @param item   Bản ghi cần kiểm tra.
 * @param cursor Con trỏ đã giải mã.
 * @param spec   Đặc tả sắp xếp hiện tại.
 */
export function isAfterGenericCursor<T extends GenericSortable>(
  item: T,
  cursor: ListCursor,
  spec: GenericSortSpec<T>,
): boolean {
  const iv = genericSortValue(item, spec.accessor);

  if (cursor.isNull) {
    // Con trỏ đang ở nhóm null (nhóm nhỏ nhất).
    if (!iv.isNull) return true;
    return compareValues(item.id, cursor.id) * spec.direction > 0;
  }

  if (iv.isNull) {
    // Giá trị null luôn nhỏ hơn → chỉ nằm sau khi chiều tăng dần.
    return spec.direction === 1 ? false : true;
  }

  const cmp = compareValues(iv.value, cursor.value, spec.toNumber);
  if (cmp !== 0) return cmp * spec.direction > 0;
  return compareValues(item.id, cursor.id) * spec.direction > 0;
}
