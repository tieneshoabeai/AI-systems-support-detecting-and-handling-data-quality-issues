import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { IDatasetRecord } from './dataset-record.schema';
import type {
  ColumnStatsResult,
  DatasetColumnRef,
  RecordQueryInput,
  RecordQueryPort,
  RecordRow,
} from '../../domain/ports/record-query.port';
import {
  coerceDate,
  coerceNumber,
  coerceValue,
  type ColumnDataType,
} from '../../domain/value-objects/value-coercion.vo';

/**
 * DATASETS — Adapter đọc bản ghi (Virtual Grid).
 *
 * Lưu ý kiến trúc (L2 — R3/CA6):
 * Adapter này nằm **trong** module `datasets` — module sở hữu collection
 * `dataset_records` — nên được phép chạm schema Mongoose `DatasetRecordSchema`.
 * Module `data-view`/`analysis` chỉ inject `RECORD_QUERY_PORT` (public contract).
 *
 * ── Về kiểu dữ liệu (schema vs dữ liệu thực tế) ──────────────────────────
 * Schema suy luận `dataType` từ CSV nhưng dữ liệu nạp vào có thể vẫn là
 * **chuỗi** (đặc biệt là dataset nạp trước khi sửa lỗi). MongoDB so sánh
 * **theo BSON type** → lọc `5` (number) không khớp `"5"` (string).
 *
 * Vì vậy adapter này **dịch giá trị bộ lọc theo `dataType` của cột** trước khi
 * dựng query, và **khớp cả hai dạng** (số và chuỗi) cho cột `number` để dữ liệu
 * cũ và dữ liệu mới (đã ép kiểu lúc nạp) đều được trả về.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Điều kiện khớp **cả hai** dạng lưu trữ của một cột `number`:
 * số thật (đã ép lúc nạp) và chuỗi số (dữ liệu cũ).
 *
 * - `equals` → `{ $in: [5, '5'] }`
 * - `notEquals` → `{ $nin: [5, '5'] }`
 * - `gt/gte/lt/lte` → so sánh trên **cả hai** dạng: `{ $gt: 5 }` **hoặc**
 *   `{ $gt: '5' }` (chuỗi so sánh lexicographic — chỉ đúng khi cả hai cùng độ dài,
 *   nên ta dùng `$expr` để ép về số trước khi so sánh).
 *
 * Cách chắc chắn & hiệu quả nhất cho cột `number`: dùng `$expr` + `$convert`
 * để ép **phía server** rồi so sánh số — đúng với mọi giá trị, kể cả `"10"` vs `"9"`.
 */
function numericCondition(path: string, op: string, value: unknown): Record<string, unknown> | null {
  const num = coerceNumber(value);
  if (typeof num !== 'number' || !Number.isFinite(num)) return null;
  const converted = { $convert: { input: `$${path}`, to: 'double', onError: null, onNull: null } };
  const cmp =
    op === 'greaterThan' ? '$gt'
    : op === 'greaterThanOrEqual' ? '$gte'
    : op === 'lessThan' ? '$lt'
    : op === 'lessThanOrEqual' ? '$lte'
    : null;
  if (!cmp) return null;
  return { $expr: { [cmp]: [converted, num] } };
}

/** Điều kiện cho cột `number` với toán tử so sánh bằng (`equals`/`notEquals`). */
function numericEqualityCondition(path: string, op: string, value: unknown): Record<string, unknown> | null {
  const num = coerceNumber(value);
  if (typeof num !== 'number' || !Number.isFinite(num)) return null;
  const str = typeof value === 'string' ? value.trim() : String(value);
  const candidates = num === Number(str) ? [num, str] : [num];
  if (op === 'notEquals') return { [path]: { $nin: candidates } };
  return { [path]: { $in: candidates } };
}

function toRow(doc: unknown): RecordRow {
  const raw = doc as { row_index: number; props: Record<string, unknown> };
  return { rowIndex: raw.row_index, props: raw.props ?? {} };
}

function decodeRowIndex(cursor: string | undefined): number | undefined {
  if (!cursor) return undefined;
  try {
    const json = Buffer.from(cursor.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const decoded = JSON.parse(json) as { row_index?: number };
    if (typeof decoded.row_index === 'number' && Number.isInteger(decoded.row_index) && decoded.row_index >= 0) {
      return decoded.row_index;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

@Injectable()
export class RecordQueryRepository implements RecordQueryPort {
  constructor(
    @InjectModel('DatasetRecord')
    private readonly recordModel: Model<IDatasetRecord>,
  ) {}

  resolveColumnKey(column: string, keys: string[], _names: string[]): string | null {
    if (keys.includes(column)) return column;
    return null;
  }

  async listRecords(
    datasetId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<{ items: RecordRow[]; hasMore: boolean }> {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 500) : 50;
    const lastRowIndex = decodeRowIndex(cursor);
    const filter: Record<string, unknown> = { dataset_id: new Types.ObjectId(datasetId) };
    if (lastRowIndex !== undefined) filter.row_index = { $gt: lastRowIndex };
    const docs = await this.recordModel.find(filter).sort({ row_index: 1 }).limit(safeLimit + 1).lean().exec();
    const hasMore = docs.length > safeLimit;
    const page = hasMore ? docs.slice(0, safeLimit) : docs;
    return { items: page.map(toRow), hasMore };
  }

  async listAllRecords(datasetId: string): Promise<RecordRow[]> {
    const docs = await this.recordModel.find({ dataset_id: new Types.ObjectId(datasetId) }).sort({ row_index: 1 }).lean().exec();
    return docs.map(toRow);
  }

  async queryRecords(
    datasetId: string,
    input: RecordQueryInput,
    columns: DatasetColumnRef[],
  ): Promise<{ items: RecordRow[]; hasMore: boolean }> {
    const byKey = new Map(columns.map((c) => [c.key, c.key]));
    const byName = new Map<string, string>();
    for (const c of columns) {
      if (!byName.has(c.name)) byName.set(c.name, c.key);
      if (!byName.has(c.originalName)) byName.set(c.originalName, c.key);
    }
    const typeByKey = new Map(columns.map((c) => [c.key, c.dataType] as const));
    const resolveKey = (col: string): string => {
      const hk = byKey.get(col);
      if (hk) return hk;
      const hn = byName.get(col);
      if (hn) return hn;
      throw new Error(`Cot khong ton tai trong dataset: ${col}`);
    };
    /** Kiểu của cột theo schema — dùng để dịch giá trị bộ lọc. */
    const resolveType = (col: string): ColumnDataType =>
      typeByKey.get(resolveKey(col)) ?? 'string';
    for (const f of input.filters) resolveKey(f.column);
    for (const s of input.sort) resolveKey(s.column);
    if (input.search) for (const c of input.search.columns) resolveKey(c);
    const lastRowIndex = decodeRowIndex(input.cursor);
    const base: Record<string, unknown> = { dataset_id: new Types.ObjectId(datasetId) };
    const conditions = this.buildFilterConditions(input.filters, input.search, resolveKey, resolveType);
    const filter: Record<string, unknown> = conditions.length > 0 ? { $and: [base, ...conditions] } : base;
    if (lastRowIndex !== undefined) {
      (filter as Record<string, unknown>).row_index = { $gt: lastRowIndex };
    }
    const safeLimit = Number.isFinite(input.limit) && (input.limit as number) > 0
      ? Math.min(Math.floor(input.limit as number), 500)
      : 50;

    // ── Sắp xếp ───────────────────────────────────────────────────────────
    // Cột `number` / `date` phải ép kiểu **trước khi sort**, nếu không MongoDB
    // so sánh theo BSON type → cột số lưu chuỗi sẽ sort theo thứ tự
    // lexicographic ("10" < "9"). Dùng aggregation `$addFields` + `$convert`.
    const numericSorts = input.sort.filter((s) => {
      const t = resolveType(s.column);
      return t === 'number' || t === 'date';
    });
    const plainSorts = input.sort.filter((s) => {
      const t = resolveType(s.column);
      return t !== 'number' && t !== 'date';
    });

    if (numericSorts.length > 0) {
      const addFields: Record<string, unknown> = {};
      const sortStage: Record<string, 1 | -1> = {};
      numericSorts.forEach((s, i) => {
        const key = resolveKey(s.column);
        const alias = `__sort_${i}`;
        addFields[alias] = {
          $convert: {
            input: `$props.${key}`,
            to: resolveType(s.column) === 'number' ? 'double' : 'date',
            onError: null,
            onNull: null,
          },
        };
        sortStage[alias] = s.order === 'desc' ? -1 : 1;
      });
      for (const s of plainSorts) sortStage[`props.${resolveKey(s.column)}`] = s.order === 'desc' ? -1 : 1;
      sortStage.row_index = 1;

      const docs = await this.recordModel
        .aggregate<{ row_index: number; props: Record<string, unknown> }>([
          { $match: filter },
          { $addFields: addFields },
          { $sort: sortStage },
          { $limit: safeLimit + 1 },
        ])
        .exec();
      const hasMore = docs.length > safeLimit;
      const page = hasMore ? docs.slice(0, safeLimit) : docs;
      return { items: page.map(toRow), hasMore };
    }

    const sortSpec: Record<string, 1 | -1> = {};
    for (const s of plainSorts) sortSpec[`props.${resolveKey(s.column)}`] = s.order === 'desc' ? -1 : 1;
    sortSpec.row_index = 1;
    const docs = await this.recordModel.find(filter).sort(sortSpec).limit(safeLimit + 1).lean().exec();
    const hasMore = docs.length > safeLimit;
    const page = hasMore ? docs.slice(0, safeLimit) : docs;
    return { items: page.map(toRow), hasMore };
  }

  async getColumnStats(datasetId: string, columnKey: string): Promise<ColumnStatsResult> {
    const objectDatasetId = new Types.ObjectId(datasetId);
    const fieldPath = `props.${columnKey}`;
    // `$convert` thay cho `$isNumber`: `$isNumber` chỉ đúng với giá trị **đã là
    // số**, còn dữ liệu nạp trước khi sửa lỗi lưu chuỗi → thống kê ra rỗng.
    // `$convert` ép chuỗi số → số ở phía server, `onError/onNull = null` để bỏ qua
    // giá trị không chuyển được mà không làm hỏng cả aggregation.
    const numericExpr = {
      $convert: { input: `$${fieldPath}`, to: 'double', onError: null, onNull: null },
    };
    const res = await this.recordModel.aggregate<{
      total: number;
      null_count: number;
      numeric_values: (number | null)[];
    }>([
      { $match: { dataset_id: objectDatasetId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          null_count: {
            $sum: {
              $cond: [{ $or: [{ $eq: [`$${fieldPath}`, null] }, { $not: [`$${fieldPath}`] }] }, 1, 0],
            },
          },
          numeric_values: {
            $push: { $cond: [{ $ne: [numericExpr, null] }, numericExpr, '$REMOVE'] },
          },
        },
      },
    ]);
    const stats = res[0];
    const totalRecords = stats?.total ?? 0;
    const nullCount = stats?.null_count ?? 0;
    const missingRatio = totalRecords > 0 ? nullCount / totalRecords : 0;
    const numericValues = (stats?.numeric_values ?? []).filter(
      (v): v is number => typeof v === 'number' && Number.isFinite(v),
    );
    if (numericValues.length === 0) {
      return { columnKey, columnName: columnKey, totalRecords, nullCount, missingRatio, histogram: [] };
    }
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const sum = numericValues.reduce((acc, val) => acc + val, 0);
    const average = sum / numericValues.length;
    const bucketCount = 10;
    const range = max - min;
    const step = range > 0 ? range / bucketCount : 1;
    const histogram: { bucketStart: number; bucketEnd: number; count: number }[] = [];
    for (let i = 0; i < bucketCount; i++) {
      const bStart = min + i * step;
      const bEnd = i === bucketCount - 1 ? max : min + (i + 1) * step;
      histogram.push({ bucketStart: Number(bStart.toFixed(2)), bucketEnd: Number(bEnd.toFixed(2)), count: 0 });
    }
    for (const val of numericValues) {
      const index = Math.min(Math.floor((val - min) / step), bucketCount - 1);
      const bucket = histogram[index];
      if (index >= 0 && index < bucketCount && bucket) bucket.count++;
    }
    return { columnKey, columnName: columnKey, totalRecords, nullCount, missingRatio, min, max, average: Number(average.toFixed(2)), histogram };
  }

  private buildFilterConditions(
    filters: { column: string; operator: string; value?: unknown }[],
    search: { columns: string[]; value: string } | undefined,
    resolveKey: (col: string) => string,
    resolveType: (col: string) => ColumnDataType,
  ): Record<string, unknown>[] {
    const conditions: Record<string, unknown>[] = [];
    const byColumn = new Map<string, { column: string; operator: string; value?: unknown }[]>();
    for (const f of filters) {
      const list = byColumn.get(f.column) ?? [];
      list.push(f);
      byColumn.set(f.column, list);
    }
    for (const [column, columnFilters] of byColumn) {
      const key = resolveKey(column);
      const path = `props.${key}`;
      const dataType = resolveType(column);
      const orParts: Record<string, unknown>[] = [];
      for (const f of columnFilters) {
        const part = this.buildOneCondition(path, f.operator, f.value, dataType);
        if (part) orParts.push(part);
      }
      const first = orParts[0];
      if (orParts.length > 0 && first) {
        conditions.push(orParts.length === 1 ? first : { $or: orParts });
      }
    }
    if (search && search.value.length > 0) {
      const needle = search.value;
      const orParts = search.columns.map((column) => {
        const key = resolveKey(column);
        return { [`props.${key}`]: { $regex: escapeRegExp(needle), $options: 'i' } };
      });
      const firstSearch = orParts[0];
      if (firstSearch) {
        conditions.push(orParts.length === 1 ? firstSearch : { $or: orParts });
      }
    }
    return conditions;
  }

  /**
   * Dựng điều kiện Mongo cho một bộ lọc, **dịch giá trị theo kiểu cột**.
   *
   * Với cột `number`: dùng `$expr` + `$convert` để so sánh về số ở phía
   * server → khớp được cả dữ liệu đã ép kiểu (số) lẫn dữ liệu cũ (chuỗi số),
   * đồng thời sắp xếp đúng thứ tự số (không còn lỗi lexicographic).
   *
   * Với cột `boolean`: ép về boolean rồi so sánh (khớp cả `true` lẫn `"true"`).
   * Với cột `date`: ép về `Date` rồi so sánh.
   * Cột `string`: giữ nguyên hành vi cũ (so sánh chuỗi).
   */
  private buildOneCondition(
    path: string,
    operator: string,
    value: unknown,
    dataType: ColumnDataType = 'string',
  ): Record<string, unknown> | null {
    // ── Cột số: so sánh số (khớp cả dạng số lẫn chuỗi số) ──────────────
    if (dataType === 'number') {
      if (operator === 'equals' || operator === 'notEquals') {
        return numericEqualityCondition(path, operator, value);
      }
      if (
        operator === 'greaterThan' ||
        operator === 'greaterThanOrEqual' ||
        operator === 'lessThan' ||
        operator === 'lessThanOrEqual'
      ) {
        return numericCondition(path, operator, value);
      }
      if (operator === 'between') {
        const arr = Array.isArray(value) ? (value as unknown[]) : [];
        const lo = numericCondition(path, 'greaterThanOrEqual', arr[0]);
        const hi = numericCondition(path, 'lessThanOrEqual', arr[1]);
        if (!lo || !hi) return null;
        return { $and: [lo, hi] };
      }
      if (operator === 'in') {
        const arr = Array.isArray(value) ? (value as unknown[]) : [];
        const candidates = arr.flatMap((v) => {
          const n = coerceNumber(v);
          if (typeof n !== 'number' || !Number.isFinite(n)) return [v];
          const str = typeof v === 'string' ? v.trim() : String(v);
          return n === Number(str) ? [n, str] : [n];
        });
        if (candidates.length === 0) return null;
        return { [path]: { $in: candidates } };
      }
      // `contains`/`startsWith`/`endsWith`/`isEmpty`/`isNotEmpty` → ngữ nghĩa chuỗi
    }

    // ── Cột boolean ───────────────────────────────────────────────────────
    if (dataType === 'boolean' && (operator === 'equals' || operator === 'notEquals')) {
      const coerced = coerceValue(value, 'boolean');
      if (typeof coerced === 'boolean') {
        const candidates =
          typeof value === 'string'
            ? coerced === (value.trim().toLowerCase() === 'false' || value.trim().toLowerCase() === 'no' || value.trim() === '0')
              ? [false, 'false', 'no', '0']
              : [true, 'true', 'yes', '1']
            : [coerced];
        return operator === 'notEquals'
          ? { [path]: { $nin: candidates } }
          : { [path]: { $in: candidates } };
      }
    }

    // ── Cột ngày: so sánh Date ───────────────────────────────────────────
    if (dataType === 'date') {
      const asDate = coerceDate(value);
      if (asDate instanceof Date && !Number.isNaN(asDate.getTime())) {
        if (operator === 'equals') return { [path]: asDate };
        if (operator === 'notEquals') return { [path]: { $ne: asDate } };
        if (operator === 'greaterThan') return { [path]: { $gt: asDate } };
        if (operator === 'greaterThanOrEqual') return { [path]: { $gte: asDate } };
        if (operator === 'lessThan') return { [path]: { $lt: asDate } };
        if (operator === 'lessThanOrEqual') return { [path]: { $lte: asDate } };
        if (operator === 'between') {
          const arr = Array.isArray(value) ? (value as unknown[]) : [];
          const lo = coerceDate(arr[0]);
          const hi = coerceDate(arr[1]);
          if (lo instanceof Date && hi instanceof Date) {
            return { [path]: { $gte: lo, $lte: hi } };
          }
        }
      }
    }

    switch (operator) {
      case 'equals': return { [path]: value };
      case 'notEquals': return { [path]: { $ne: value } };
      case 'contains': return { [path]: { $regex: escapeRegExp(String(value)), $options: 'i' } };
      case 'notContains': return { [path]: { $not: { $regex: escapeRegExp(String(value)), $options: 'i' } } };
      case 'startsWith': return { [path]: { $regex: `^${escapeRegExp(String(value))}`, $options: 'i' } };
      case 'endsWith': return { [path]: { $regex: `${escapeRegExp(String(value))}$`, $options: 'i' } };
      case 'greaterThan': return { [path]: { $gt: value } };
      case 'greaterThanOrEqual': return { [path]: { $gte: value } };
      case 'lessThan': return { [path]: { $lt: value } };
      case 'lessThanOrEqual': return { [path]: { $lte: value } };
      case 'between': {
        const arr: unknown[] = Array.isArray(value) ? (value as unknown[]) : [];
        return { [path]: { $gte: arr[0], $lte: arr[1] } };
      }
      case 'in': return { [path]: { $in: Array.isArray(value) ? (value as unknown[]) : [] } };
      case 'isEmpty':
        return { $or: [{ [path]: null }, { [path]: { $exists: false } }, { [path]: '' }] };
      case 'isNotEmpty':
        return { $and: [{ [path]: { $ne: null } }, { [path]: { $exists: true } }, { [path]: { $nin: ['', null] } }] };
      default: return null;
    }
  }
}
