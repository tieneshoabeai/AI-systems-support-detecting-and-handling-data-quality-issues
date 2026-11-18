import type { KeysetSortSpec } from './keyset-filter.util';

/**
 * Ánh xạ mã loại sắp xếp → đặc tả trường + chiều sort cho keyset pagination.
 *
 * Mỗi module nghiệp vụ định nghĩa bảng ánh xạ riêng (vì tên trường trong
 * collection là khác nhau), nhưng dùng chung cấu trúc `KeysetSortSpec`.
 */

/** Bảng ánh xạ chuẩn cho collection có `last_accessed_at`, `updated_at`, `created_at`, `name`. */
export const COMMON_SORT_SPECS = {
  last_accessed: { field: 'last_accessed_at', direction: -1, isDate: true },
  updated: { field: 'updated_at', direction: -1, isDate: true },
  name_asc: { field: 'name', direction: 1, isDate: false },
  name_desc: { field: 'name', direction: -1, isDate: false },
  joined: { field: 'created_at', direction: -1, isDate: true },
} as const satisfies Record<string, KeysetSortSpec>;

/** Loại sắp xếp mặc định khi client không truyền `sort`. */
export const DEFAULT_SORT_CODE = 'last_accessed';

/**
 * Lấy đặc tả keyset theo mã sort, fallback về mặc định.
 */
export function resolveSortSpec(
  table: Record<string, KeysetSortSpec>,
  sortCode: string | undefined,
): { code: string; spec: KeysetSortSpec } {
  const code = sortCode && sortCode in table ? sortCode : DEFAULT_SORT_CODE;
  const spec = table[code] ?? table[DEFAULT_SORT_CODE];
  if (!spec) {
    throw new Error('Không tìm thấy đặc tả sắp xếp keyset mặc định');
  }
  return { code, spec };
}
