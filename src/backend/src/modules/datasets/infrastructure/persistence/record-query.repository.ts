import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type PipelineStage } from 'mongoose';
import type { IDatasetRecord } from './dataset-record.schema';
import type {
  ColumnStatsResult,
  ColumnValuesResult,
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
import { ValidationError } from '../../../../shared/domain/errors';
import {
  decodeRecordCursor,
  encodeRecordCursor,
  type RecordKeysetPosition,
  type RecordKeysetValue,
  type RecordSortSignature,
} from '../../../../shared/domain/pagination/record-keyset-cursor';

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
 *
 * ── Hợp đồng (Phần 7 v13 mục 3.23) ──────────────────────────────────────
 * - Cursor keyset gắn chữ ký sort; hỏng / lệch sort → `ValidationError`.
 * - Null (và giá trị không ép được kiểu) luôn xếp cuối khi sort, mọi kiểu cột.
 * - Giá trị bộ lọc chỉ nhận primitive; so sánh thứ tự với số/ngày sai → `ValidationError`.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Giá trị bộ lọc hợp lệ: chuỗi / số hữu hạn / boolean (Phần 7 v13 DV-6). */
type FilterPrimitive = string | number | boolean;

function isFilterPrimitive(v: unknown): v is FilterPrimitive {
  return typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v));
}

/**
 * Lớp phòng vệ thứ hai chống NoSQL operator injection (lớp 1 là Zod ở controller):
 * giá trị object (vd `{ "$ne": null }`, `{ "$regex": "(a+)+$" }`) nếu lọt vào
 * `{ [path]: value }` sẽ được MongoDB thực thi như toán tử.
 */
function assertFilterValue(column: string, value: unknown): void {
  if (value === undefined || value === null || isFilterPrimitive(value)) return;
  if (Array.isArray(value) && value.every(isFilterPrimitive)) return;
  throw new ValidationError(
    `Gia tri bo loc cua cot ${column} khong hop le (chi nhan chuoi, so, boolean hoac mang cac gia tri do)`,
  );
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

/** Số hữu hạn từ giá trị bộ lọc, `null` nếu không đọc được. */
function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'boolean') return null;
  const num = coerceNumber(value);
  return typeof num === 'number' && Number.isFinite(num) ? num : null;
}

/** `Date` hợp lệ từ giá trị bộ lọc, `null` nếu không đọc được. */
function toValidDate(value: unknown): Date | null {
  const d = value instanceof Date ? value : coerceDate(value);
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
}

/** So sánh thứ tự cần giá trị đọc được — sai → `ValidationError` (Phần 7 v13 DV-7). */
function requireNumber(column: string, value: unknown): number {
  const num = toFiniteNumber(value);
  if (num === null) {
    throw new ValidationError(`Gia tri "${String(value)}" khong phai so hop le cho cot ${column}`);
  }
  return num;
}

function requireDate(column: string, value: unknown): Date {
  const d = toValidDate(value);
  if (!d) {
    throw new ValidationError(`Gia tri "${String(value)}" khong phai ngay hop le cho cot ${column}`);
  }
  return d;
}

const COMPARE_OPERATORS: Readonly<Record<string, '$gt' | '$gte' | '$lt' | '$lte'>> = {
  greaterThan: '$gt',
  greaterThanOrEqual: '$gte',
  lessThan: '$lt',
  lessThanOrEqual: '$lte',
};

/** Biểu thức ép giá trị cột số về `double` phía server (khớp cả chuỗi số legacy). */
function numberExpr(path: string): Record<string, unknown> {
  return { $convert: { input: `$${path}`, to: 'double', onError: null, onNull: null } };
}

/** Biểu thức ép giá trị cột ngày về `Date` phía server (khớp cả chuỗi legacy). */
function dateExpr(path: string): Record<string, unknown> {
  return { $convert: { input: `$${path}`, to: 'date', onError: null, onNull: null } };
}

/** Dạng chuỗi của giá trị (số / boolean / ngày) — để `contains`/`search` khớp được. */
function stringExpr(path: string): Record<string, unknown> {
  return { $convert: { input: `$${path}`, to: 'string', onError: null, onNull: null } };
}

/**
 * Ứng viên khớp cho một giá trị số: số thật (đã ép lúc nạp) và chuỗi số (dữ liệu
 * cũ). Giá trị không phải số → khớp đúng chuỗi thô (để tìm ô sai kiểu trong cột số).
 */
function numericCandidates(value: unknown): unknown[] {
  const num = toFiniteNumber(value);
  if (num === null) return [value];
  const str = typeof value === 'string' ? value.trim() : String(value);
  return num === Number(str) ? [num, str] : [num];
}

/** Ứng viên khớp cho một giá trị boolean (native + chuỗi/số legacy, không phân biệt hoa/thường). */
function booleanCandidates(value: unknown): unknown[] {
  const coerced = coerceValue(value, 'boolean');
  if (coerced === true) return [true, 1, /^\s*(true|yes|1)\s*$/i];
  if (coerced === false) return [false, 0, /^\s*(false|no|0)\s*$/i];
  return [value];
}

/** Giá trị trống theo Phần 7 §3.7: `null` / thiếu / chuỗi toàn khoảng trắng. */
const BLANK_REGEX = /^\s*$/;

function textRegex(operator: string, needle: string): string | null {
  const escaped = escapeRegExp(needle);
  if (operator === 'contains' || operator === 'notContains') return escaped;
  if (operator === 'startsWith') return `^${escaped}`;
  if (operator === 'endsWith') return `${escaped}$`;
  return null;
}

// ── Sắp xếp + keyset ──────────────────────────────────────────────────────

/**
 * Alias sắp xếp cho từng kiểu cột. Giá trị không ép được / trống → `null`, để
 * cờ `__sortnull_i` đẩy xuống **cuối** cho mọi kiểu (Phần 7 v13 DV-5).
 */
function sortAliasExpr(path: string, dataType: ColumnDataType): Record<string, unknown> {
  if (dataType === 'number') return numberExpr(path);
  if (dataType === 'date') return dateExpr(path);
  const field = `$${path}`;
  if (dataType === 'boolean') {
    const lowered = { $toLower: { $trim: { input: { $ifNull: [stringExpr(path), ''] } } } };
    return {
      $switch: {
        branches: [
          { case: { $eq: [{ $type: field }, 'bool'] }, then: field },
          { case: { $in: [lowered, ['true', 'yes', '1']] }, then: true },
          { case: { $in: [lowered, ['false', 'no', '0']] }, then: false },
        ],
        default: null,
      },
    };
  }
  return {
    $cond: [
      {
        $cond: [
          { $eq: [{ $type: field }, 'string'] },
          { $eq: [{ $trim: { input: field } }, ''] },
          false,
        ],
      },
      null,
      { $ifNull: [field, null] },
    ],
  };
}

function toKeysetValue(v: unknown): RecordKeysetValue {
  if (v instanceof Date || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
    return v;
  }
  return null;
}

/**
 * Điều kiện "đứng sau vị trí cursor" theo thứ tự từ điển của bộ
 * `(cờ null₀, giá trị₀, cờ null₁, giá trị₁, …, row_index)`.
 *
 * Dùng `$expr` trên alias (không dùng `$gt` của find) vì `$gt` của find chỉ so
 * cùng kiểu BSON → bỏ sót dòng null / khác kiểu.
 */
function keysetAfterExpr(
  sort: RecordSortSignature,
  position: RecordKeysetPosition,
): Record<string, unknown> {
  const comps: { field: string; dir: 1 | -1; value: unknown }[] = [];
  sort.forEach(([, order], i) => {
    const value = position.values[i] ?? null;
    comps.push({ field: `$__sortnull_${i}`, dir: 1, value: value === null ? 1 : 0 });
    comps.push({ field: `$__sort_${i}`, dir: order === 'desc' ? -1 : 1, value });
  });
  comps.push({ field: '$row_index', dir: 1, value: position.rowIndex });
  const branches = comps.map((c, j) => {
    const strict = { [c.dir === 1 ? '$gt' : '$lt']: [c.field, c.value] };
    const equals = comps.slice(0, j).map((p) => ({ $eq: [p.field, p.value] }));
    return equals.length > 0 ? { $and: [...equals, strict] } : strict;
  });
  return { $or: branches };
}

function toRow(doc: unknown): RecordRow {
  const raw = doc as { row_index: number; props: Record<string, unknown> };
  return { rowIndex: raw.row_index, props: raw.props ?? {} };
}

/** Giải mã lỏng cho `listRecords` (giữ hành vi cũ: cursor hỏng → trang đầu). */
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

function clampLimit(limit: number | undefined): number {
  return Number.isFinite(limit) && (limit as number) > 0 ? Math.min(Math.floor(limit as number), 500) : 50;
}

const HISTOGRAM_BUCKETS = 10;

function round2(n: number): number {
  return Number(n.toFixed(2));
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
  ): Promise<{ items: RecordRow[]; hasMore: boolean; nextCursor: string | null }> {
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
      throw new ValidationError(`Cot khong ton tai trong dataset: ${col}`);
    };
    /** Kiểu của cột theo schema — dùng để dịch giá trị bộ lọc. */
    const resolveType = (col: string): ColumnDataType =>
      typeByKey.get(resolveKey(col)) ?? 'string';
    for (const f of input.filters) resolveKey(f.column);
    if (input.search) for (const c of input.search.columns) resolveKey(c);
    const signature: RecordSortSignature = input.sort.map(
      (s) => [resolveKey(s.column), s.order === 'desc' ? 'desc' : 'asc'] as const,
    );
    const position = decodeRecordCursor(input.cursor, signature);

    const base: Record<string, unknown> = { dataset_id: new Types.ObjectId(datasetId) };
    const conditions = this.buildFilterConditions(input.filters, input.search, resolveKey, resolveType);
    const filter: Record<string, unknown> = conditions.length > 0 ? { $and: [base, ...conditions] } : base;
    const safeLimit = clampLimit(input.limit);

    // ── Không sort: keyset theo row_index (dùng index { dataset_id, row_index }) ──
    if (signature.length === 0) {
      if (position) filter.row_index = { $gt: position.rowIndex };
      const docs = await this.recordModel.find(filter).sort({ row_index: 1 }).limit(safeLimit + 1).lean().exec();
      const hasMore = docs.length > safeLimit;
      const page = hasMore ? docs.slice(0, safeLimit) : docs;
      const last = page[page.length - 1];
      const nextCursor =
        hasMore && last ? encodeRecordCursor([], { values: [], rowIndex: last.row_index }) : null;
      return { items: page.map(toRow), hasMore, nextCursor };
    }

    // ── Có sort: alias đã ép kiểu + cờ null cho MỌI cột sort ──────────────
    // Cột `number`/`date` phải ép kiểu trước khi sort, nếu không MongoDB so
    // sánh theo BSON type → chuỗi số sort lexicographic ("10" < "9").
    // Cờ null phải ở stage `$addFields` thứ hai: MongoDB không cho tham chiếu
    // trường vừa tạo trong cùng một stage.
    const addFields: Record<string, unknown> = {};
    const nullFlags: Record<string, unknown> = {};
    const sortStage: Record<string, 1 | -1> = {};
    signature.forEach(([key, order], i) => {
      const alias = `__sort_${i}`;
      const nullAlias = `__sortnull_${i}`;
      addFields[alias] = sortAliasExpr(`props.${key}`, typeByKey.get(key) ?? 'string');
      nullFlags[nullAlias] = { $cond: [{ $eq: [`$${alias}`, null] }, 1, 0] };
      sortStage[nullAlias] = 1;
      sortStage[alias] = order === 'desc' ? -1 : 1;
    });
    sortStage.row_index = 1;

    const stages: PipelineStage[] = [
      { $match: filter },
      { $addFields: addFields },
      { $addFields: nullFlags },
    ];
    if (position) stages.push({ $match: { $expr: keysetAfterExpr(signature, position) } });
    stages.push({ $sort: sortStage }, { $limit: safeLimit + 1 });

    const docs = await this.recordModel
      .aggregate<{ row_index: number; props: Record<string, unknown> } & Record<string, unknown>>(stages)
      .exec();
    const hasMore = docs.length > safeLimit;
    const page = hasMore ? docs.slice(0, safeLimit) : docs;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeRecordCursor(signature, {
            values: signature.map((_, i) => toKeysetValue(last[`__sort_${i}`])),
            rowIndex: last.row_index,
          })
        : null;
    return { items: page.map(toRow), hasMore, nextCursor };
  }

  async getColumnStats(
    datasetId: string,
    columnKey: string,
    dataType?: ColumnDataType,
  ): Promise<ColumnStatsResult> {
    const objectDatasetId = new Types.ObjectId(datasetId);
    const fieldPath = `props.${columnKey}`;
    const field = `$${fieldPath}`;
    // Trống = null / thiếu / chuỗi toàn khoảng trắng (Phần 7 §3.7, v13 DV-11).
    const isBlank = {
      $cond: [
        { $eq: [{ $type: field }, 'string'] },
        { $eq: [{ $trim: { input: field } }, ''] },
        { $eq: [{ $ifNull: [field, null] }, null] },
      ],
    };
    // `$convert` thay cho `$isNumber`: `$isNumber` chỉ đúng với giá trị **đã là
    // số**, còn dữ liệu nạp trước khi sửa lỗi lưu chuỗi → thống kê ra rỗng.
    //
    // ⚠️ CHỈ ép khi kiểu BSON là số hoặc chuỗi. Nếu ép cả boolean thì `true`→1,
    // `false`→0 ⇒ cột boolean sinh ra histogram 0/1 vô nghĩa.
    const numericExpr = {
      $cond: [
        { $in: [{ $type: field }, ['double', 'int', 'long', 'decimal', 'string']] },
        numberExpr(fieldPath),
        null,
      ],
    };
    const wantNumeric = dataType === undefined || dataType === 'number';

    // Lượt 1: đếm + min/max/avg ngay trong `$group` (không `$push` toàn bộ giá trị
    // về Node → không chạm giới hạn 16 MB BSON, không `Math.min(...arr)` tràn stack).
    const group: Record<string, unknown> = {
      _id: null,
      total: { $sum: 1 },
      null_count: { $sum: { $cond: [isBlank, 1, 0] } },
    };
    if (wantNumeric) {
      group.numeric_count = { $sum: { $cond: [{ $ne: [numericExpr, null] }, 1, 0] } };
      group.min = { $min: numericExpr };
      group.max = { $max: numericExpr };
      group.avg = { $avg: numericExpr };
    }
    const res = await this.recordModel
      .aggregate<{
        total: number;
        null_count: number;
        numeric_count?: number;
        min?: number | null;
        max?: number | null;
        avg?: number | null;
      }>([{ $match: { dataset_id: objectDatasetId } }, { $group: group } as PipelineStage])
      .exec();
    const stats = res[0];
    const totalRecords = stats?.total ?? 0;
    const nullCount = stats?.null_count ?? 0;
    const missingRatio = totalRecords > 0 ? nullCount / totalRecords : 0;
    const empty: ColumnStatsResult = {
      columnKey,
      columnName: columnKey,
      totalRecords,
      nullCount,
      missingRatio,
      histogram: [],
    };
    const numericCount = stats?.numeric_count ?? 0;
    const min = stats?.min;
    const max = stats?.max;
    const avg = stats?.avg;
    if (
      !wantNumeric ||
      numericCount === 0 ||
      typeof min !== 'number' ||
      typeof max !== 'number' ||
      typeof avg !== 'number' ||
      !Number.isFinite(min) ||
      !Number.isFinite(max)
    ) {
      return empty;
    }
    const withNumbers = { ...empty, min, max, average: round2(avg) };

    // Cột hằng số: 1 bucket [min, max] (trước đây sinh 10 bucket, bucket cuối đảo đầu).
    if (min === max) {
      return {
        ...withNumbers,
        histogram: [{ bucketStart: round2(min), bucketEnd: round2(max), count: numericCount }],
      };
    }

    // Lượt 2: đếm theo bucket phía server, cùng công thức chỉ số với bản cũ.
    const step = (max - min) / HISTOGRAM_BUCKETS;
    const bucketRows = await this.recordModel
      .aggregate<{ _id: number; count: number }>([
        { $match: { dataset_id: objectDatasetId } },
        { $project: { _id: 0, v: numericExpr } },
        { $match: { v: { $ne: null } } },
        {
          $group: {
            _id: {
              $min: [{ $floor: { $divide: [{ $subtract: ['$v', min] }, step] } }, HISTOGRAM_BUCKETS - 1],
            },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();
    const histogram: { bucketStart: number; bucketEnd: number; count: number }[] = [];
    for (let i = 0; i < HISTOGRAM_BUCKETS; i++) {
      const bStart = min + i * step;
      const bEnd = i === HISTOGRAM_BUCKETS - 1 ? max : min + (i + 1) * step;
      histogram.push({ bucketStart: round2(bStart), bucketEnd: round2(bEnd), count: 0 });
    }
    for (const row of bucketRows) {
      const bucket = histogram[row._id];
      if (Number.isInteger(row._id) && bucket) bucket.count += row.count;
    }
    return { ...withNumbers, histogram };
  }

  async getColumnValues(
    datasetId: string,
    columnKey: string,
    dataType: ColumnDataType,
    limit: number,
    knownTotal?: number,
  ): Promise<ColumnValuesResult> {
    const objectDatasetId = new Types.ObjectId(datasetId);
    const fieldPath = `props.${columnKey}`;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100_000) : 10_000;

    // Ép kiểu phía server: cột `number` lưu chuỗi (dữ liệu cũ) vẫn ra số.
    const valueExpr =
      dataType === 'number'
        ? numberExpr(fieldPath)
        : dataType === 'date'
          ? dateExpr(fieldPath)
          : `$${fieldPath}`;

    // `$sort` theo row_index (dùng index) để mẫu ổn định giữa các lần gọi (v13 DV-16).
    const docs = await this.recordModel
      .aggregate<{ v: unknown }>([
        { $match: { dataset_id: objectDatasetId } },
        { $sort: { row_index: 1 } },
        { $limit: safeLimit },
        { $project: { _id: 0, v: valueExpr } },
      ])
      .exec();

    const totalRecords =
      knownTotal !== undefined && Number.isFinite(knownTotal) && knownTotal >= 0
        ? knownTotal
        : await this.recordModel.countDocuments({ dataset_id: objectDatasetId }).exec();

    return {
      columnKey,
      values: docs.map((d) => d.v ?? null),
      totalRecords,
      sampledRecords: docs.length,
      truncated: totalRecords > docs.length,
    };
  }

  private buildFilterConditions(
    filters: { column: string; operator: string; value?: unknown }[],
    search: { columns: string[]; value: string } | undefined,
    resolveKey: (col: string) => string,
    resolveType: (col: string) => ColumnDataType,
  ): Record<string, unknown>[] {
    const conditions: Record<string, unknown>[] = [];
    // Nhóm theo key `cN` đã quy đổi: `c0` và tên hiển thị của c0 là CÙNG một cột
    // ⇒ ghép OR (Phần 7 §3.7: OR trong cùng cột, AND giữa các cột).
    const byKey = new Map<string, { column: string; operator: string; value?: unknown }[]>();
    for (const f of filters) {
      assertFilterValue(f.column, f.value);
      const key = resolveKey(f.column);
      const list = byKey.get(key) ?? [];
      list.push(f);
      byKey.set(key, list);
    }
    for (const [key, columnFilters] of byKey) {
      const path = `props.${key}`;
      const dataType = resolveType(key);
      const orParts: Record<string, unknown>[] = [];
      for (const f of columnFilters) {
        const part = this.buildOneCondition(path, f.operator, f.value, dataType, f.column);
        if (part) orParts.push(part);
      }
      const first = orParts[0];
      if (orParts.length > 0 && first) {
        conditions.push(orParts.length === 1 ? first : { $or: orParts });
      }
    }
    // `search.value` KHÔNG trim (§3.7: có phân biệt khoảng trắng); toàn khoảng trắng = không tìm.
    if (search && search.value.trim().length > 0) {
      const regex = escapeRegExp(search.value);
      const orParts = search.columns.map((column) => {
        const path = `props.${resolveKey(column)}`;
        return this.textCondition(path, regex, resolveType(column));
      });
      const firstSearch = orParts[0];
      if (firstSearch) {
        conditions.push(orParts.length === 1 ? firstSearch : { $or: orParts });
      }
    }
    return conditions;
  }

  /**
   * So khớp regex không phân biệt hoa/thường. Cột không phải chuỗi (số / boolean /
   * ngày đã ép kiểu lúc nạp) so khớp trên **dạng chuỗi** của giá trị, vì `$regex`
   * của MongoDB bỏ qua giá trị không phải chuỗi (v13 DV-10).
   */
  private textCondition(path: string, regex: string, dataType: ColumnDataType): Record<string, unknown> {
    if (dataType === 'string') return { [path]: { $regex: regex, $options: 'i' } };
    return {
      $expr: {
        $regexMatch: { input: { $ifNull: [stringExpr(path), ''] }, regex, options: 'i' },
      },
    };
  }

  /**
   * Dựng điều kiện Mongo cho một bộ lọc, **dịch giá trị theo kiểu cột**.
   *
   * - Cột `number`: so sánh số phía server (`$expr` + `$convert`) → khớp cả số
   *   lẫn chuỗi số legacy, đúng thứ tự số. `equals`/`notEquals`/`in` với giá trị
   *   không phải số → khớp đúng chuỗi thô (tìm ô sai kiểu).
   * - Cột `boolean`: khớp cả `true` lẫn `"true"`/`"True"`/`1`.
   * - Cột `date`: ép về `Date` rồi so sánh.
   * - Cột `string`: so sánh chuỗi.
   * - So sánh thứ tự / `between` với số/ngày không đọc được → `ValidationError`.
   * - Toán tử lạ → `null` (bỏ qua; DTO đã chặn bằng Zod enum).
   */
  private buildOneCondition(
    path: string,
    operator: string,
    value: unknown,
    dataType: ColumnDataType = 'string',
    column: string = path,
  ): Record<string, unknown> | null {
    // ── Chung: trống / không trống / so khớp chuỗi ─────────────────────
    if (operator === 'isEmpty') {
      return { $or: [{ [path]: null }, { [path]: { $regex: BLANK_REGEX } }] };
    }
    if (operator === 'isNotEmpty') {
      return { $and: [{ [path]: { $ne: null } }, { [path]: { $not: BLANK_REGEX } }] };
    }
    const regex = textRegex(operator, String(value));
    if (regex !== null) {
      const cond = this.textCondition(path, regex, dataType);
      if (operator !== 'notContains') return cond;
      if (dataType === 'string') return { [path]: { $not: { $regex: regex, $options: 'i' } } };
      return { $expr: { $not: [(cond.$expr as Record<string, unknown>)] } };
    }
    const cmp = COMPARE_OPERATORS[operator];

    // ── Cột số ─────────────────────────────────────────────────────────
    if (dataType === 'number') {
      if (operator === 'equals') return { [path]: { $in: numericCandidates(value) } };
      if (operator === 'notEquals') return { [path]: { $nin: numericCandidates(value) } };
      if (operator === 'in') {
        const candidates = asArray(value).flatMap(numericCandidates);
        return candidates.length > 0 ? { [path]: { $in: candidates } } : null;
      }
      if (cmp) return { $expr: { [cmp]: [numberExpr(path), requireNumber(column, value)] } };
      if (operator === 'between') {
        const arr = asArray(value);
        const lo = requireNumber(column, arr[0]);
        const hi = requireNumber(column, arr[1]);
        return {
          $expr: { $and: [{ $gte: [numberExpr(path), lo] }, { $lte: [numberExpr(path), hi] }] },
        };
      }
      return null;
    }

    // ── Cột boolean ────────────────────────────────────────────────────
    if (dataType === 'boolean') {
      if (operator === 'equals') return { [path]: { $in: booleanCandidates(value) } };
      if (operator === 'notEquals') return { [path]: { $nin: booleanCandidates(value) } };
      if (operator === 'in') {
        const candidates = asArray(value).flatMap(booleanCandidates);
        return candidates.length > 0 ? { [path]: { $in: candidates } } : null;
      }
    }

    // ── Cột ngày ───────────────────────────────────────────────────────
    // `$expr` + `$convert` để khớp **cả** Date native lẫn chuỗi ngày legacy.
    if (dataType === 'date') {
      if (cmp) return { $expr: { [cmp]: [dateExpr(path), requireDate(column, value)] } };
      if (operator === 'between') {
        const arr = asArray(value);
        const lo = requireDate(column, arr[0]);
        const hi = requireDate(column, arr[1]);
        return {
          $expr: { $and: [{ $gte: [dateExpr(path), lo] }, { $lte: [dateExpr(path), hi] }] },
        };
      }
      if (operator === 'equals' || operator === 'notEquals' || operator === 'in') {
        const raw = operator === 'in' ? asArray(value) : [value];
        const dates = raw.map(toValidDate).filter((d): d is Date => d !== null);
        const others = raw.filter((v) => toValidDate(v) === null);
        const parts: Record<string, unknown>[] = [];
        if (dates.length > 0) parts.push({ $expr: { $in: [dateExpr(path), dates] } });
        if (others.length > 0) parts.push({ [path]: { $in: others } });
        if (parts.length === 0) return null;
        const matchAny = parts.length === 1 ? (parts[0] as Record<string, unknown>) : { $or: parts };
        return operator === 'notEquals' ? { $nor: [matchAny] } : matchAny;
      }
    }

    // ── Cột chuỗi (và phần còn lại) ────────────────────────────────────
    switch (operator) {
      case 'equals': return { [path]: value };
      case 'notEquals': return { [path]: { $ne: value } };
      case 'greaterThan':
      case 'greaterThanOrEqual':
      case 'lessThan':
      case 'lessThanOrEqual':
        return cmp ? { [path]: { [cmp]: value } } : null;
      case 'between': {
        const arr = asArray(value);
        return { [path]: { $gte: arr[0], $lte: arr[1] } };
      }
      case 'in': return { [path]: { $in: asArray(value) } };
      default: return null;
    }
  }
}
