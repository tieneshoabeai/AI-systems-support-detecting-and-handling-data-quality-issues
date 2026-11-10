import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { IDatasetRecord } from '../../../datasets/infrastructure/persistence/dataset-record.schema';
import type {
  ColumnStatsResult,
  DatasetColumnRef,
  RecordQueryInput,
  RecordQueryPort,
  RecordRow,
} from '../../domain/ports/record-query.port';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    const resolveKey = (col: string): string => {
      const hk = byKey.get(col);
      if (hk) return hk;
      const hn = byName.get(col);
      if (hn) return hn;
      throw new Error(`Cot khong ton tai trong dataset: ${col}`);
    };
    for (const f of input.filters) resolveKey(f.column);
    for (const s of input.sort) resolveKey(s.column);
    if (input.search) for (const c of input.search.columns) resolveKey(c);
    const lastRowIndex = decodeRowIndex(input.cursor);
    const base: Record<string, unknown> = { dataset_id: new Types.ObjectId(datasetId) };
    const conditions = this.buildFilterConditions(input.filters, input.search, resolveKey);
    const filter: Record<string, unknown> = conditions.length > 0 ? { $and: [base, ...conditions] } : base;
    if (lastRowIndex !== undefined) {
      (filter as Record<string, unknown>).row_index = { $gt: lastRowIndex };
    }
    const safeLimit = Number.isFinite(input.limit) && (input.limit as number) > 0
      ? Math.min(Math.floor(input.limit as number), 500)
      : 50;
    const sortSpec: Record<string, 1 | -1> = {};
    for (const s of input.sort) sortSpec[`props.${resolveKey(s.column)}`] = s.order === 'desc' ? -1 : 1;
    sortSpec.row_index = 1;
    const docs = await this.recordModel.find(filter).sort(sortSpec).limit(safeLimit + 1).lean().exec();
    const hasMore = docs.length > safeLimit;
    const page = hasMore ? docs.slice(0, safeLimit) : docs;
    return { items: page.map(toRow), hasMore };
  }

  async getColumnStats(datasetId: string, columnKey: string): Promise<ColumnStatsResult> {
    const objectDatasetId = new Types.ObjectId(datasetId);
    const fieldPath = `props.${columnKey}`;
    const res = await this.recordModel.aggregate<{
      total: number;
      null_count: number;
      numeric_values: number[];
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
            $push: { $cond: [{ $isNumber: `$${fieldPath}` }, `$${fieldPath}`, '$$REMOVE'] },
          },
        },
      },
    ]);
    const stats = res[0];
    const totalRecords = stats?.total ?? 0;
    const nullCount = stats?.null_count ?? 0;
    const missingRatio = totalRecords > 0 ? nullCount / totalRecords : 0;
    const numericValues = stats?.numeric_values ?? [];
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
      if (index >= 0 && index < bucketCount) histogram[index].count++;
    }
    return { columnKey, columnName: columnKey, totalRecords, nullCount, missingRatio, min, max, average: Number(average.toFixed(2)), histogram };
  }

  private buildFilterConditions(
    filters: { column: string; operator: string; value?: unknown }[],
    search: { columns: string[]; value: string } | undefined,
    resolveKey: (col: string) => string,
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
      const orParts: Record<string, unknown>[] = [];
      for (const f of columnFilters) {
        const part = this.buildOneCondition(path, f.operator, f.value);
        if (part) orParts.push(part);
      }
      if (orParts.length > 0) conditions.push(orParts.length === 1 ? orParts[0] : { $or: orParts });
    }
    if (search && search.value.length > 0) {
      const needle = search.value;
      const orParts = search.columns.map((column) => {
        const key = resolveKey(column);
        return { [`props.${key}`]: { $regex: escapeRegExp(needle), $options: 'i' } };
      });
      conditions.push(orParts.length === 1 ? orParts[0] : { $or: orParts });
    }
    return conditions;
  }

  private buildOneCondition(path: string, operator: string, value: unknown): Record<string, unknown> | null {
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
        const arr = Array.isArray(value) ? value : [];
        return { [path]: { $gte: arr[0], $lte: arr[1] } };
      }
      case 'in': return { [path]: { $in: Array.isArray(value) ? value : [] } };
      case 'isEmpty':
        return { $or: [{ [path]: null }, { [path]: { $exists: false } }, { [path]: '' }] };
      case 'isNotEmpty':
        return { $and: [{ [path]: { $ne: null } }, { [path]: { $exists: true } }, { [path]: { $nin: ['', null] } }] };
      default: return null;
    }
  }
}
