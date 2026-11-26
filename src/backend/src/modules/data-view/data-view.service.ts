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

/**
 * Đọc số nguyên từ biến môi trường, fallback về `fallback` khi thiếu/không hợp lệ.
 */
function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** So cot toi da tra ve trong mot lan goi. */
export const MAX_CHART_COLUMNS = 50;

/**
 * GĐ6-PERF — cache số liệu biểu đồ trong bộ nhớ (LRU + TTL ngắn).
 *
 * Vì sao: dataset là **bất biến** sau khi ingest (có `file_checksum` làm định
 * danh) ⇒ số liệu biểu đồ của một dataset + bộ cột + topN **không đổi** giữa
 * các request. Nhiều client (dashboard) gọi lại cùng một biểu đồ ⇒ mỗi lần
 * lại quét 50k dòng `dataset_records` là tài nguyên.
 *
 * Key: `datasetId | checksum | columns | topN | maxRows` ⇒ tự động vô hiệu
 * hoá khi dataset bị thay thế (checksum đổi).
 */
interface ChartCacheEntry {
  at: number;
  data: ChartDataResult[];
}

/**
 * TTL cache biểu đồ (ms). Mặc định 60 giây; đặt `CHART_CACHE_TTL_MS=0` để tắt cache
 * (hữu ích khi đo baseline hiệu năng và khi cần dữ liệu luôn tươi).
 */
const CHART_CACHE_TTL_MS = readIntEnv('CHART_CACHE_TTL_MS', 60_000);

/** Số phần tử tối đa giữ trong cache. */
const CHART_CACHE_MAX = 64;

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
  /** Cache biểu đồ (LRU theo phong tới + TTL). */
  private readonly chartCache = new Map<string, ChartCacheEntry>();

  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
    @Inject(RECORD_QUERY_PORT)
    private readonly records: RecordQueryPort,
  ) {}

  /**
   * Đọc từ cache biểu đồ (GĐ6-PERF). Trả `null` khi hết hạn hoặc không có.
   */
  private readChartCache(key: string): ChartDataResult[] | null {
    const hit = this.chartCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > CHART_CACHE_TTL_MS) {
      this.chartCache.delete(key);
      return null;
    }
    // LRU: đưa key lên đầu khi bị truy cập.
    this.chartCache.delete(key);
    this.chartCache.set(key, hit);
    return hit.data;
  }

  /** Ghi vào cache biểu đồ (GĐ6-PERF), có cắt LRU. */
  private writeChartCache(key: string, data: ChartDataResult[]): void {
    this.chartCache.set(key, { at: Date.now(), data });
    while (this.chartCache.size > CHART_CACHE_MAX) {
      const oldest = this.chartCache.keys().next();
      if (oldest.done) break;
      this.chartCache.delete(oldest.value);
    }
  }

  private async loadDataset(
    datasetId: string,
  ): Promise<{ columns: DatasetColumns; fileChecksum?: string }> {
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

    // GĐ6-PERF: cache theo (dataset, checksum, cột, topN, maxRows) ⇒ tự vô hiệu
    // hoá khi dataset bị thay thế (checksum đổi).
    const cacheKey = [
      datasetId,
      dataset.fileChecksum ?? '',
      selected.map((c) => c.key).join(','),
      topN,
      maxRows,
    ].join('|');
    const cached = this.readChartCache(cacheKey);
    if (cached) return cached;

    // ── Đọc giá trị: GĐ6-PERF — đọc **mọi cột trong một lần quét** thay vì N
    //    aggregation (N × full scan 50k dòng ⇒ p95 ~40 s, đo bằng k6 tầng 8).
    const batch = await this.records.getColumnValuesBatch(
      datasetId,
      selected.map((c) => ({ columnKey: c.key, dataType: c.dataType })),
      maxRows,
    );
    const batchByKey = new Map(batch.map((b) => [b.columnKey, b]));
    const totalRecords = batch[0]?.totalRecords ?? 0;

    const results: ChartDataResult[] = [];
    for (const col of selected) {
      const values = batchByKey.get(col.key)?.values ?? [];
      const sampledRecords = values.length;
      const truncated = totalRecords > sampledRecords;
      results.push(this.buildChart(col, { values, totalRecords, sampledRecords, truncated }, topN));
    }
    this.writeChartCache(cacheKey, results);
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
