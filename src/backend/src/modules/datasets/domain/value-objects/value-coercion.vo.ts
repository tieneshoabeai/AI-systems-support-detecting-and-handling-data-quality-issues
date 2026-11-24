/**
 * DATASETS — Ép kiểu giá trị theo `dataType` của cột (value object thuần).
 *
 * Vì sao cần: schema suy luận `dataType` từ CSV (`schema-inference.service.ts`)
 * nhưng ingestion ghi **giá trị thô** vào `props` — nên cột `number` lại lưu
 * chuỗi `"4"`. MongoDB so sánh **theo BSON type** → lọc `5` (number) không
 * khớp `"5"` (string), sort ra thứ tự lexicographic, `$isNumber` trả 0 dòng.
 *
 * Module này giữ quy tắc chuyển đổi ở **một chỗ** để:
 *  1. ingestion dùng để ghi đúng kiểu khi nạp (fix gốc),
 *  2. tầng query dùng để dịch giá trị filter (tương thích dữ liệu cũ),
 *  3. script backfill dùng để sửa dữ liệu đã có.
 *
 * Quy tắc an toàn (không mất dữ liệu):
 *  - Giá trị rỗng / null → `null`.
 *  - Không chuyển được → **giữ nguyên bản gốc** (không ép `null`), để không
 *    làm mất thông tin; bộ lọc/thống kê sẽ bỏ qua giá trị đó.
 *
 * Domain thuần: không import framework, không phụ thuộc Mongo/Mongoose.
 */

import type { ColumnDataType } from './column-type.vo';

export type { ColumnDataType };

/** Múi giờ dùng khi giá trị ngày không kèm múi giờ. */
export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

/** Ngưỡng tỉ lệ giá trị hợp lệ để một cột được coi là `number`/`boolean`/`date`. */
export const TYPE_INFERENCE_THRESHOLD = 0.8;

const TRUE_TOKENS = new Set(['true', 'yes', '1']);
const FALSE_TOKENS = new Set(['false', 'no', '0']);

/**
 * Chuỗi rỗng (hoặc toàn khoảng trắng) được coi là thiếu giá trị.
 * `null` / `undefined` cũng vậy.
 */
export function isBlankValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  return false;
}

/**
 * Ép một giá trị đơn lẻ theo kiểu cột.
 *
 * @param value Giá trị thô (thường là string từ CSV).
 * @param dataType Kiểu theo schema.
 * @returns Giá trị đã ép, hoặc giá trị gốc nếu không chuyển được.
 */
export function coerceValue(value: unknown, dataType: ColumnDataType): unknown {
  if (isBlankValue(value)) return null;
  switch (dataType) {
    case 'number':
      return coerceNumber(value);
    case 'boolean':
      return coerceBoolean(value);
    case 'date':
      return coerceDate(value);
    case 'string':
    default:
      return typeof value === 'string' ? value : String(value);
  }
}

/**
 * Ép sang số. Giữ nguyên bản gốc nếu không phải số hợp lệ.
 *
 * `Number('')` = 0 — nên phải chặn chuỗi rỗng trước (đã xử lý ở `coerceValue`).
 * `Number('  12  ')` = 12 — chấp nhận khoảng trắng thừa.
 * `Number('1,234')` = NaN — giữ nguyên chuỗi, không đoán.
 */
export function coerceNumber(value: unknown): unknown {
  if (typeof value === 'number') return Number.isFinite(value) ? value : value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  // `Number('Infinity')` = Infinity → không phải số hữu hạn, giữ nguyên bản gốc.
  if (!Number.isFinite(n)) return value;
  return n;
}

/**
 * Ép sang boolean. Giữ nguyên bản gốc nếu không nhận diện được.
 *
 * Nhận diện: `true/false/yes/no/1/0` (không phân biệt hoa thường) — **khớp**
 * với `SchemaInferenceService.isBooleanString` + `detectDataType`.
 */
export function coerceBoolean(value: unknown): unknown {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return value;
  }
  if (typeof value !== 'string') return value;
  const lower = value.trim().toLowerCase();
  if (TRUE_TOKENS.has(lower)) return true;
  if (FALSE_TOKENS.has(lower)) return false;
  return value;
}

/**
 * Ép sang `Date`.
 *
 * Quy tắc đã chốt:
 *  - Chuỗi **chỉ có ngày** (`YYYY-MM-DD`) → `Date` tại midnight **theo giờ Việt
 *    Nam**, lưu thành `Date` (MongoDB lưu UTC) → đọc lại ra đúng ngày đó.
 *  - Chuỗi có giờ nhưng **không có múi giờ** → hiểu là giờ Việt Nam.
 *  - Chuỗi có múi giờ (`Z`, `+07:00`) → giữ nguyên, `Date` tự xử lý.
 *  - Không chuyển được → giữ nguyên bản gốc.
 */
/**
 * Chuỗi ngày giờ **có múi giờ** tường minh ở cuối (`Z`, `+07:00`, `-0500`).
 * Dùng chung cho `coerceDate` và biểu thức đọc chuỗi ngày legacy phía MongoDB
 * (`RecordQueryRepository`) để hai nơi hiểu múi giờ giống nhau (Phần 7 v16 DL-5).
 */
export const EXPLICIT_ZONE_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/i;

export function coerceDate(value: unknown): unknown {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? value : value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  // Chỉ có ngày (YYYY-MM-DD) hoặc ngày giờ không có múi giờ.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const y = Number(dateOnly[1]);
    const mo = Number(dateOnly[2]);
    const d = Number(dateOnly[3]);
    const ms = Date.UTC(y, mo - 1, d, 0, 0, 0) - 7 * 60 * 60 * 1000; // UTC+7
    const dt = new Date(ms);
    return Number.isNaN(dt.getTime()) ? value : dt;
  }

  const hasExplicitZone = EXPLICIT_ZONE_SUFFIX.test(trimmed);
  const normalized = hasExplicitZone ? trimmed : `${trimmed.replace(' ', 'T')}+07:00`;
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return value;
  return dt;
}

/**
 * Ép một mảng giá trị (dùng cho toán tử `in`).
 * Giữ nguyên phần tử nào không chuyển được.
 */
export function coerceValueList(values: unknown[], dataType: ColumnDataType): unknown[] {
  return values.map((v) => coerceValue(v, dataType));
}

/**
 * Kiểm tra một giá trị có **thực sự là số** hay không (đã ép hay chưa).
 * Dùng cho bộ lọc/thống kê để biết giá trị có dùng được hay không.
 */
export function isNumericValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Chuyển một giá trị bất kỳ về số nếu được (dùng cho `$convert` tương đương
 * ở tầng JS — ví dụ khi đọc `props` ra để hiển thị/thống kê).
 * Trả `null` nếu không phải số.
 */
export function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
