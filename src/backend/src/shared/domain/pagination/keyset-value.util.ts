import type { KeysetSortSpec } from './keyset-filter.util';

/**
 * Trích giá trị sắp xếp từ một document thô (dạng plain object của MongoDB).
 *
 * - Trường ngày: `Date` → ISO-8601; `null`/`undefined` → `isNull = true`.
 * - Trường chuỗi: giữ nguyên; `null`/`undefined` → chuỗi rỗng + `isNull = true`.
 */
export function extractSortValue(
  spec: KeysetSortSpec,
  doc: Record<string, unknown>,
): { value: string; isNull: boolean } {
  const raw = doc[spec.field];

  if (raw === null || raw === undefined) {
    return { value: spec.isDate ? EPOCH_ISO : '', isNull: true };
  }

  if (spec.isDate) {
    const date = raw instanceof Date ? raw : new Date(String(raw));
    const time = date.getTime();
    if (!Number.isFinite(time)) return { value: EPOCH_ISO, isNull: true };
    return { value: date.toISOString(), isNull: false };
  }

  return { value: String(raw), isNull: false };
}

/** Mốc thời gian tối thiểu — dùng thay cho giá trị `null` để sắp xếp được. */
export const EPOCH_ISO = '1970-01-01T00:00:00.000Z';
