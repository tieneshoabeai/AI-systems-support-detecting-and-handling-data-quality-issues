/** DATA-VIEW — Service (Template Simple). Gop 4 query handler thanh DataViewService. Giu nguyen logic + thu tu tham so. */
import { Inject, Injectable } from '@nestjs/common';
import { DATASET_REPOSITORY_PORT, type DatasetRepositoryPort } from '../datasets';
import { RECORD_QUERY_PORT, type RecordQueryPort, type RecordRow, type RecordQueryInput } from '../datasets';
import { CursorCodec } from '../../shared/domain/pagination/cursor-codec';
import { normalizeRecordLimit } from './data-view.types';
import {
  createCursorPaginatedResponse,
  type CursorPaginatedResponse,
} from '../../shared/domain/pagination/cursor-paginated.response';
import type { GetRecordsInput, QueryRecordsBodyInput, ColumnStatsResult, ChartDataResult } from './data-view.types';
import { isObjectIdHex, decodeRowCursor, toSnakeStats, resolveColumnKey } from './data-view.utils';
import { NotFoundError, ValidationError } from '../../shared/domain/errors';
import {
  boxPlot,
  categoryTopN,
  clampChartTopN,
  histogram,
} from '../../shared/domain/utils/chart-data.util';

/** So ban ghi toi da doc cho moi cot khi dung bieu do. */
export const MAX_CHART_SAMPLE_ROWS = 50_000;

/** So cot toi da tra ve trong mot lan goi. */
export const MAX_CHART_COLUMNS = 50;

@Injectable()
export class DataViewService {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
    @Inject(RECORD_QUERY_PORT)
    private readonly records: RecordQueryPort,
  ) {}

async getRecords(
    datasetId: string,
    query: GetRecordsInput,
  ): Promise<CursorPaginatedResponse<RecordRow>> {
    if (!isObjectIdHex(datasetId)) {
      throw new ValidationError('ID Tap du lieu khong hop le');
    }
    const dataset = await this.datasets.findById(datasetId);
    if (!dataset) {
      throw new NotFoundError(`Khong tim thay tap du lieu ${datasetId}`);
    }
    const lastRowIndex = decodeRowCursor(query.cursor);
    const limit = normalizeRecordLimit(query.limit);
    // GET /records hỗ trợ sort đơn cột (sort_field/sort_order). Khi có sort,
    // ủy thác sang `queryRecords` (Mongo sort phía server) thay vì lặng lẽ
    // bỏ qua — trước đây handler chỉ đọc cursor/limit nên sort bị nuốt.
    if (query.sort_field) {
      const byKey = new Map(dataset.columns.map((c) => [c.key, c.key]));
      const byName = new Map<string, string>();
      for (const c of dataset.columns) {
        if (!byName.has(c.name)) byName.set(c.name, c.key);
        if (!byName.has(c.originalName)) byName.set(c.originalName, c.key);
      }
      const hitKey = byKey.get(query.sort_field);
      const hitName = byName.get(query.sort_field);
      const sortKey = hitKey ?? hitName;
      if (!sortKey) {
        throw new ValidationError(`Cot khong ton tai trong dataset: ${query.sort_field}`);
      }
      const cursorForPort =
        lastRowIndex !== undefined ? CursorCodec.encode({ row_index: lastRowIndex }) : undefined;
      const { items, hasMore } = await this.records.queryRecords(
        datasetId,
        {
          filters: [],
          sort: [{ column: sortKey, order: query.sort_order ?? 'asc' }],
          cursor: cursorForPort,
          limit,
        },
        dataset.columns.map((c) => ({
          key: c.key,
          name: c.name,
          originalName: c.originalName,
          dataType: c.dataType,
        })),
      );
      let nextCursor: string | null = null;
      if (hasMore && items.length > 0) {
        const last = items[items.length - 1];
        if (last) nextCursor = CursorCodec.encode({ row_index: last.rowIndex });
      }
      return {
        items,
        meta: { nextCursor, hasMore, limit },
        next_cursor: nextCursor,
        has_more: hasMore,
      };
    }
    const cursorForPort =
      lastRowIndex !== undefined ? CursorCodec.encode({ row_index: lastRowIndex }) : undefined;
    const { items, hasMore } = await this.records.listRecords(datasetId, cursorForPort, limit);
    const withOverflow = hasMore ? [...items, ...items.slice(0, 0)] : items;
    // Dung helper san co de sinh nextCursor opaque { row_index } tu rowIndex cuoi.
    void withOverflow;
    const page = hasMore ? items : items;
    // Tao response thu cong de tranh phu thuoc kieu persistence: lay limit + hasMore tu port.
    const resultItems = page;
    let nextCursor: string | null = null;
    if (hasMore && resultItems.length > 0) {
      const last = resultItems[resultItems.length - 1];
      if (last) nextCursor = CursorCodec.encode({ row_index: last.rowIndex });
    }
    return {
      items: resultItems,
      meta: { nextCursor, hasMore, limit },
      next_cursor: nextCursor,
      has_more: hasMore,
    };
  }

async queryRecords(
    datasetId: string,
    body: QueryRecordsBodyInput,
  ): Promise<CursorPaginatedResponse<RecordRow>> {
    if (!isObjectIdHex(datasetId)) {
      throw new ValidationError('ID Tap du lieu khong hop le');
    }
    const dataset = await this.datasets.findById(datasetId);
    if (!dataset) {
      throw new NotFoundError(`Khong tim thay tap du lieu ${datasetId}`);
    }
    const byKey = new Map(dataset.columns.map((c) => [c.key, c.key]));
    const byName = new Map<string, string>();
    for (const c of dataset.columns) {
      if (!byName.has(c.name)) byName.set(c.name, c.key);
      if (!byName.has(c.originalName)) byName.set(c.originalName, c.key);
    }
    const resolveKey = (col: string): string => resolveColumnKey(col, byKey, byName);
    for (const f of body.filters ?? []) resolveKey(f.column);
    for (const s of body.sort ?? []) resolveKey(s.column);
    if (body.search) {
      for (const c of body.search.columns) resolveKey(c);
    }
    const limit = normalizeRecordLimit(body.limit);
    const queryInput: RecordQueryInput = {
      filters: (body.filters ?? []).map((f) => ({
        column: f.column,
        operator: f.operator,
        value: f.value,
      })),
      sort: (body.sort ?? []).map((s) => ({ column: s.column, order: s.order })),
      search: body.search,
      cursor: body.cursor,
      limit,
    };
    const { items, hasMore } = await this.records.queryRecords(
      datasetId,
      queryInput,
      dataset.columns.map((c) => ({
        key: c.key,
        name: c.name,
        originalName: c.originalName,
        dataType: c.dataType,
      })),
    );
    void createCursorPaginatedResponse;
    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      if (lastItem) nextCursor = CursorCodec.encode({ row_index: lastItem.rowIndex });
    }
    return {
      items,
      meta: { nextCursor, hasMore, limit },
      next_cursor: nextCursor,
      has_more: hasMore,
    };
  }

async getColumnStats(datasetId: string, columnRef: string): Promise<ColumnStatsResult> {
    if (!isObjectIdHex(datasetId)) {
      throw new ValidationError('ID Tap du lieu khong hop le');
    }
    const dataset = await this.datasets.findById(datasetId);
    if (!dataset) {
      throw new NotFoundError(`Khong tim thay tap du lieu ${datasetId}`);
    }
    const targetColumn =
      dataset.columns.find((c) => c.key === columnRef) ??
      dataset.columns.find((c) => c.name === columnRef) ??
      dataset.columns.find((c) => c.originalName === columnRef);
    if (!targetColumn) {
      throw new NotFoundError(`Khong tim thay cot ${columnRef} trong dataset ${datasetId}`);
    }
    const domain = await this.records.getColumnStats(datasetId, targetColumn.key);
    const snake = toSnakeStats({ ...domain, columnName: targetColumn.name });
    // Chi tra histogram so khi cot la number; neu cot khong phai number thi tra rong (giua API cu).
    if (targetColumn.dataType !== 'number') {
      return { ...snake, min: undefined, max: undefined, average: undefined, histogram: [] };
    }
    return snake;
  }

async getChartData(
    datasetId: string,
    input: { columns?: string[]; topN?: number; maxRows?: number } = {},
  ): Promise<ChartDataResult[]> {
    if (!isObjectIdHex(datasetId)) {
      throw new ValidationError('ID Tap du lieu khong hop le');
    }
    const dataset = await this.datasets.findById(datasetId);
    if (!dataset) {
      throw new NotFoundError(`Khong tim thay tap du lieu ${datasetId}`);
    }

    const topN = clampChartTopN(input.topN);
    const maxRows =
      Number.isFinite(input.maxRows) && (input.maxRows as number) > 0
        ? Math.min(Math.floor(input.maxRows as number), MAX_CHART_SAMPLE_ROWS)
        : MAX_CHART_SAMPLE_ROWS;

    // ── Chọn cột cần vẽ ─────────────────────────────────────────────────
    const requested = input.columns;
    let selected = dataset.columns;
    if (requested && requested.length > 0) {
      const wanted = new Set(requested.map((c) => c.trim()).filter((c) => c.length > 0));
      selected = dataset.columns.filter(
        (c) => wanted.has(c.key) || wanted.has(c.name) || wanted.has(c.originalName),
      );
      if (selected.length === 0) {
        throw new NotFoundError(
          `Khong tim thay cot nao trong dataset ${datasetId}: ${[...wanted].join(', ')}`,
        );
      }
    }
    if (selected.length > MAX_CHART_COLUMNS) {
      selected = selected.slice(0, MAX_CHART_COLUMNS);
    }

    // ── Dựng số liệu từng cột ──────────────────────────────────────────
    const results: ChartDataResult[] = [];
    for (const col of selected) {
      const { values, totalRecords, sampledRecords, truncated } = await this.records.getColumnValues(
        datasetId,
        col.key,
        col.dataType,
        maxRows,
      );

      const missingCount = values.filter((v) => v === null || v === undefined).length;
      const missingRatio = sampledRecords > 0 ? missingCount / sampledRecords : 0;

      const base: ChartDataResult = {
        column_key: col.key,
        column_name: col.name,
        data_type: col.dataType,
        total_records: totalRecords,
        sampled_records: sampledRecords,
        truncated,
        missing_count: missingCount,
        missing_ratio: missingRatio,
      };

      if (col.dataType === 'number') {
        const numeric = values.filter(
          (v): v is number => typeof v === 'number' && Number.isFinite(v),
        );
        const h = histogram(col.key, numeric);
        const bp = boxPlot(col.key, numeric);
        results.push({
          ...base,
          ...(h
            ? {
                histogram: {
                  column_key: col.key,
                  column_name: col.name,
                  method: h.method,
                  bins: h.bins,
                },
              }
            : {}),
          ...(bp
            ? {
                box_plot: {
                  column_key: col.key,
                  column_name: col.name,
                  q1: bp.q1,
                  median: bp.median,
                  q3: bp.q3,
                  whisker_low: bp.whiskerLow,
                  whisker_high: bp.whiskerHigh,
                  outside_count: bp.outsideCount,
                  n: bp.n,
                },
              }
            : {}),
        });
        continue;
      }

      if (col.dataType === 'string' || col.dataType === 'boolean') {
        // PII: cột đánh dấu PII không trả giá trị thô — chỉ trả distinct_count
        // + missing để không rò rỉ qua GET /charts (đồng bộ với run-analysis
        // vốn loại cột PII khỏi charts.categories).
        if (col.isPii) {
          results.push({
            ...base,
            category: {
              column_key: col.key,
              column_name: col.name,
              top_n: topN,
              items: [],
              other: null,
              distinct_count: new Set(
                values
                  .filter((v) => v !== null && v !== undefined)
                  .map((v) => (typeof v === 'string' ? v : String(v)).trim())
                  .filter((v) => v.length > 0),
              ).size,
              masked: true,
            },
          });
          continue;
        }
        // Chuỗi rỗng / null = thiếu → không tính vào tần suất.
        const strings = values
          .filter((v) => v !== null && v !== undefined)
          .map((v) => (typeof v === 'string' ? v : String(v)))
          .filter((v) => v.trim().length > 0);
        const cat = categoryTopN(col.key, strings, topN);
        results.push({
          ...base,
          ...(cat
            ? {
                category: {
                  column_key: col.key,
                  column_name: col.name,
                  top_n: cat.topN,
                  items: cat.items.map((i) => ({
                    value: i.value,
                    count: i.count,
                    rate: i.rate,
                  })),
                  other: cat.other ? { count: cat.other.count, rate: cat.other.rate } : null,
                  distinct_count: cat.distinctCount,
                },
              }
            : {}),
        });
        continue;
      }

      // Cột `date`: chỉ báo tỷ lệ thiếu — biểu đồ thời gian cần cột thời gian
      // được chọn trong cấu hình phân tích (mục 3.15), chưa thuộc endpoint này.
      results.push(base);
    }

    return results;
  }
}
