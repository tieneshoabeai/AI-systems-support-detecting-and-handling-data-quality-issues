/** DATA-VIEW — Service (Template Simple). Gop 4 query handler thanh DataViewService. */
import { Inject, Injectable } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  RECORD_QUERY_PORT,
  coerceBoolean,
  isBlankValue,
  type DatasetColumn,
  type DatasetRepositoryPort,
  type RecordQueryInput,
  type RecordQueryPort,
  type RecordRow,
} from '../datasets';
import { CursorCodec } from '../../shared/domain/pagination/cursor-codec';
import {
  bindRecordCursor,
  computeRecordQueryHash,
  decodeRecordCursor,
  unbindRecordCursor,
  type RecordCursorBinding,
} from '../../shared/domain/pagination/record-keyset-cursor';
import type { CursorPaginatedResponse } from '../../shared/domain/pagination/cursor-paginated.response';
import { normalizeRecordLimit } from './data-view.types';
import type { GetRecordsInput, QueryRecordsBodyInput, ColumnStatsResult, ChartDataResult } from './data-view.types';
import { isObjectIdHex, toSnakeStats, resolveColumnKey } from './data-view.utils';
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

/** So cot doc song song khi dung bieu do (gioi han tai len MongoDB). */
const CHART_CONCURRENCY = 4;

type DatasetColumns = readonly DatasetColumn[];

function columnMaps(columns: DatasetColumns): { byKey: Map<string, string>; byName: Map<string, string> } {
  const byKey = new Map(columns.map((c) => [c.key, c.key]));
  const byName = new Map<string, string>();
  for (const c of columns) {
    if (!byName.has(c.name)) byName.set(c.name, c.key);
    if (!byName.has(c.originalName)) byName.set(c.originalName, c.key);
  }
  return { byKey, byName };
}

function columnRefs(columns: DatasetColumns): Parameters<RecordQueryPort['queryRecords']>[2] {
  return columns.map((c) => ({
    key: c.key,
    name: c.name,
    originalName: c.originalName,
    dataType: c.dataType,
  }));
}

function page(
  items: RecordRow[],
  hasMore: boolean,
  nextCursor: string | null,
  limit: number,
): CursorPaginatedResponse<RecordRow> {
  const cursor = hasMore ? nextCursor : null;
  return { items, meta: { nextCursor: cursor, hasMore, limit }, next_cursor: cursor, has_more: hasMore };
}

@Injectable()
export class DataViewService {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
    @Inject(RECORD_QUERY_PORT)
    private readonly records: RecordQueryPort,
  ) {}

  private async loadDataset(datasetId: string): Promise<{ columns: DatasetColumns }> {
    if (!isObjectIdHex(datasetId)) {
      throw new ValidationError('ID Tap du lieu khong hop le');
    }
    const dataset = await this.datasets.findById(datasetId);
    if (!dataset) {
      throw new NotFoundError(`Khong tim thay tap du lieu ${datasetId}`);
    }
    return dataset;
  }

  async getRecords(
    datasetId: string,
    query: GetRecordsInput,
  ): Promise<CursorPaginatedResponse<RecordRow>> {
    const dataset = await this.loadDataset(datasetId);
    const limit = normalizeRecordLimit(query.limit);
    // GET không có bộ lọc/tìm kiếm → mã băm của truy vấn rỗng (v16 DL-1). Gỡ lớp bọc
    // trước: cursor quá hạn / của truy vấn khác → VALIDATION_ERROR (v16 DL-2, DL-4).
    const binding: RecordCursorBinding = { queryHash: computeRecordQueryHash([]), now: Date.now() };
    const inner = unbindRecordCursor(query.cursor, binding);
    // GET /records hỗ trợ sort đơn cột (sort_field/sort_order) → uỷ thác
    // `queryRecords` của port (Mongo sort phía server + keyset theo giá trị sort).
    if (query.sort_field) {
      const { byKey, byName } = columnMaps(dataset.columns);
      const sortKey = resolveColumnKey(query.sort_field, byKey, byName);
      const order = query.sort_order ?? 'asc';
      // Validate sớm: cursor hỏng / sinh từ sort khác → VALIDATION_ERROR (v13 DV-3).
      decodeRecordCursor(inner, [[sortKey, order]]);
      const { items, hasMore, nextCursor } = await this.records.queryRecords(
        datasetId,
        { filters: [], sort: [{ column: sortKey, order }], cursor: inner, limit },
        columnRefs(dataset.columns),
      );
      return page(items, hasMore, bindRecordCursor(nextCursor, binding), limit);
    }
    const lastRowIndex = decodeRecordCursor(inner, [])?.rowIndex;
    const cursorForPort =
      lastRowIndex !== undefined ? CursorCodec.encode({ row_index: lastRowIndex }) : undefined;
    const { items, hasMore } = await this.records.listRecords(datasetId, cursorForPort, limit);
    const last = items[items.length - 1];
    const nextCursor = last
      ? bindRecordCursor(CursorCodec.encode({ row_index: last.rowIndex }), binding)
      : null;
    return page(items, hasMore, nextCursor, limit);
  }

  async queryRecords(
    datasetId: string,
    body: QueryRecordsBodyInput,
  ): Promise<CursorPaginatedResponse<RecordRow>> {
    const dataset = await this.loadDataset(datasetId);
    const { byKey, byName } = columnMaps(dataset.columns);
    const resolveKey = (col: string): string => resolveColumnKey(col, byKey, byName);
    // Quy đổi mọi cột sang key `cN` TRƯỚC khi gọi port: `c0` và tên hiển thị của
    // c0 phải được coi là cùng một cột (OR trong cùng cột — v13 DV-8).
    const limit = normalizeRecordLimit(body.limit);
    const sort = (body.sort ?? []).map((s) => ({ column: resolveKey(s.column), order: s.order }));
    const queryInput: RecordQueryInput = {
      filters: (body.filters ?? []).map((f) => ({
        column: resolveKey(f.column),
        operator: f.operator,
        value: f.value,
      })),
      sort,
      search: body.search
        ? { columns: body.search.columns.map(resolveKey), value: body.search.value }
        : undefined,
      limit,
    };
    // Cursor gắn bộ lọc + tìm kiếm (sau khi quy về `cN`) và hết hạn sau 24 giờ (v16 DL-1…DL-4).
    const binding: RecordCursorBinding = {
      queryHash: computeRecordQueryHash(queryInput.filters, queryInput.search),
      now: Date.now(),
    };
    const inner = unbindRecordCursor(body.cursor, binding);
    queryInput.cursor = inner;
    // Validate sớm: không để cursor hỏng âm thầm quay về trang 1 (v13 DV-3, VIEW-005).
    decodeRecordCursor(
      inner,
      sort.map((s) => [s.column, s.order] as const),
    );
    const { items, hasMore, nextCursor } = await this.records.queryRecords(
      datasetId,
      queryInput,
      columnRefs(dataset.columns),
    );
    let cursor = nextCursor ?? null;
    if (cursor === null && hasMore && sort.length === 0) {
      // Adapter cũ không trả nextCursor: khi không sort, `{ row_index }` vẫn đúng.
      const last = items[items.length - 1];
      if (last) cursor = CursorCodec.encode({ row_index: last.rowIndex });
    }
    return page(items, hasMore, bindRecordCursor(cursor, binding), limit);
  }

  async getColumnStats(datasetId: string, columnRef: string): Promise<ColumnStatsResult> {
    const dataset = await this.loadDataset(datasetId);
    const targetColumn =
      dataset.columns.find((c) => c.key === columnRef) ??
      dataset.columns.find((c) => c.name === columnRef) ??
      dataset.columns.find((c) => c.originalName === columnRef);
    if (!targetColumn) {
      throw new NotFoundError(`Khong tim thay cot ${columnRef} trong dataset ${datasetId}`);
    }
    // Truyền kiểu cột: cột không phải `number` không chạy thống kê số (v13 DV-14).
    const domain = await this.records.getColumnStats(datasetId, targetColumn.key, targetColumn.dataType);
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
    const dataset = await this.loadDataset(datasetId);

    const topN = clampChartTopN(input.topN);
    const maxRows =
      Number.isFinite(input.maxRows) && (input.maxRows as number) > 0
        ? Math.min(Math.floor(input.maxRows as number), MAX_CHART_SAMPLE_ROWS)
        : MAX_CHART_SAMPLE_ROWS;

    // ── Chọn cột cần vẽ ─────────────────────────────────────────────────
    const requested = input.columns;
    let selected = [...dataset.columns];
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
    if (selected.length === 0) return [];

    // ── Đọc giá trị: cột đầu lấy tổng số bản ghi, các cột sau dùng lại (không
    //    `countDocuments` lặp theo cột) và đọc song song có giới hạn. ─────────
    const [firstCol, ...restCols] = selected as [DatasetColumn, ...DatasetColumn[]];
    const first = await this.records.getColumnValues(datasetId, firstCol.key, firstCol.dataType, maxRows);
    const results: ChartDataResult[] = [this.buildChart(firstCol, first, topN)];
    for (let i = 0; i < restCols.length; i += CHART_CONCURRENCY) {
      const batch = restCols.slice(i, i + CHART_CONCURRENCY);
      const values = await Promise.all(
        batch.map((col) =>
          this.records.getColumnValues(datasetId, col.key, col.dataType, maxRows, first.totalRecords),
        ),
      );
      batch.forEach((col, j) => {
        const v = values[j];
        if (v) results.push(this.buildChart(col, v, topN));
      });
    }
    return results;
  }

  private buildChart(
    col: DatasetColumn,
    data: { values: unknown[]; totalRecords: number; sampledRecords: number; truncated: boolean },
    topN: number,
  ): ChartDataResult {
    const { values, totalRecords, sampledRecords, truncated } = data;
    // Trống = null / thiếu / chuỗi toàn khoảng trắng — cùng định nghĩa với
    // `isEmpty` và `stats.null_count` (Phần 7 §3.7, v13 DV-11).
    const missingCount = values.filter(isBlankValue).length;
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
      return {
        ...base,
        ...(h
          ? { histogram: { column_key: col.key, column_name: col.name, method: h.method, bins: h.bins } }
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
      };
    }

    if (col.dataType === 'string' || col.dataType === 'boolean') {
      // Chuỗi trống / null = thiếu → không tính vào tần suất. Cột boolean dữ liệu
      // cũ ('True', '1', true) gộp về 'true' / 'false' (v13 DV-15).
      const strings = values
        .filter((v) => !isBlankValue(v))
        .map((v) => {
          const normalized = col.dataType === 'boolean' ? coerceBoolean(v) : v;
          return typeof normalized === 'string' ? normalized : String(normalized);
        });
      // PII: cột đánh dấu PII không trả giá trị thô — chỉ trả distinct_count
      // + missing để không rò rỉ qua GET /charts (đồng bộ với run-analysis
      // vốn loại cột PII khỏi charts.categories).
      if (col.isPii) {
        return {
          ...base,
          category: {
            column_key: col.key,
            column_name: col.name,
            top_n: topN,
            items: [],
            other: null,
            distinct_count: new Set(strings.map((s) => s.trim())).size,
            masked: true,
          },
        };
      }
      const cat = categoryTopN(col.key, strings, topN);
      return {
        ...base,
        ...(cat
          ? {
              category: {
                column_key: col.key,
                column_name: col.name,
                top_n: cat.topN,
                items: cat.items.map((i) => ({ value: i.value, count: i.count, rate: i.rate })),
                other: cat.other ? { count: cat.other.count, rate: cat.other.rate } : null,
                distinct_count: cat.distinctCount,
              },
            }
          : {}),
      };
    }

    // Cột `date`: chỉ báo tỷ lệ thiếu — biểu đồ thời gian cần cột thời gian
    // được chọn trong cấu hình phân tích (mục 3.15), chưa thuộc endpoint này.
    return base;
  }
}
