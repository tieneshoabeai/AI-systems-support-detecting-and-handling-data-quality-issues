import type { ListCursor } from '../utils/list-cursor';

/**
 * Hỗ trợ keyset pagination cho các đường dẫn "in-memory"
 * (ví dụ admin xem toàn bộ workspace — dữ liệu đã nạp sẵn vào bộ nhớ).
 *
 * Vì không có cơ sở dữ liệu để so sánh, ta mô phỏng đúng thứ tự so sánh BSON:
 *   - trường ngày: `null` luôn nhỏ hơn mọi Date (MongoDB: null < Date).
 *   - trường chuỗi: so sánh lexicographic.
 *   - tiebreaker: so sánh `_id` (hex string).
 */

/** Bản ghi tối thiểu cần có để dựng con trỏ keyset trong bộ nhớ. */
export interface InMemorySortable {
  id: string;
  name: string;
  lastAccessedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

/** Trường được dùng để sắp xếp theo từng mã sort. */
export function sortFieldOf(
  _item: InMemorySortable,
  sort: string,
): 'name' | 'lastAccessedAt' | 'updatedAt' | 'createdAt' {
  switch (sort) {
    case 'name_asc':
    case 'name_desc':
      return 'name';
    case 'updated':
      return 'updatedAt';
    case 'joined':
      return 'createdAt';
    case 'last_accessed':
    default:
      return 'lastAccessedAt';
  }
}

/** Chiều sort: 1 = tăng dần, -1 = giảm dần. */
export function sortDirectionOf(sort: string): 1 | -1 {
  return sort === 'name_asc' ? 1 : -1;
}

/**
 * Giá trị sắp xếp chuẩn hoá (dạng chuỗi) của một bản ghi.
 * Với trường ngày bị `null` → trả `isNull = true` (giá trị sẽ bị bỏ qua khi so sánh).
 */
export function sortValueOf(
  item: InMemorySortable,
  sort: string,
): { value: string; isNull: boolean } {
  const field = sortFieldOf(item, sort);
  if (field === 'name') return { value: item.name, isNull: false };
  const date = item[field];
  if (!date) return { value: '', isNull: true };
  return { value: date.toISOString(), isNull: false };
}

/** Millisecond của giá trị sắp xếp (dùng cho so sánh). `null` → -Infinity (nhỏ nhất). */
function millisOf(item: InMemorySortable, field: ReturnType<typeof sortFieldOf>): number {
  if (field === 'name') return 0;
  const date = item[field];
  return date ? date.getTime() : Number.NEGATIVE_INFINITY;
}

/** So sánh 2 bản ghi theo mã sort (dùng cho sort in-memory). */
export function compareBySort(a: InMemorySortable, b: InMemorySortable, sort: string): number {
  const field = sortFieldOf(a, sort);
  const dir = sortDirectionOf(sort);

  if (field === 'name') {
    const cmp = a.name.localeCompare(b.name);
    if (cmp !== 0) return cmp * dir;
    return a.id.localeCompare(b.id) * dir;
  }

  const av = millisOf(a, field);
  const bv = millisOf(b, field);
  if (av !== bv) return (av - bv) * dir;
  return a.id.localeCompare(b.id) * dir;
}

/**
 * Kiểm tra một bản ghi có nằm SAU con trỏ hay không.
 *
 * @param item   Bản ghi cần kiểm tra.
 * @param cursor Con trỏ đã giải mã.
 * @param sort   Mã sort hiện tại.
 */
export function isAfterCursor(item: InMemorySortable, cursor: ListCursor, sort: string): boolean {
  const field = sortFieldOf(item, sort);
  const dir = sortDirectionOf(sort);

  // 1. So sánh theo trường sắp xếp.
  if (field === 'name') {
    const cmp = item.name.localeCompare(cursor.value);
    if (cmp !== 0) return cmp * dir > 0;
  } else {
    const curMs = cursor.isNull ? Number.NEGATIVE_INFINITY : Date.parse(cursor.value);
    const itemMs = millisOf(item, field);
    if (itemMs !== curMs) return (itemMs - curMs) * dir > 0;
  }

  // 2. Tiebreaker theo `_id`.
  return item.id.localeCompare(cursor.id) * dir > 0;
}
