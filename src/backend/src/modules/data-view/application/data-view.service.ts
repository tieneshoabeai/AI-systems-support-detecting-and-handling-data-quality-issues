import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../datasets/domain/ports/dataset.repository.port';
import {
  RECORD_QUERY_PORT,
  type RecordQueryPort,
  type RecordRow,
  type ColumnStatsResult as DomainColumnStats,
} from '../domain/ports/record-query.port';
import type { RecordFilterOperator, RecordQueryInput } from '../domain/ports/record-query.port';

/**
 * Application inputs — controller map DTO http (zod) sang, application khong import infrastructure.
 * Giu shape tuong thich de DTO hien tai truyen thang van type-check.
 */
export interface GetRecordsInput {
  cursor?: string;
  limit?: number;
  sort_order?: 'asc' | 'desc';
  sort_field?: string;
}

export interface QueryRecordsBodyInput {
  filters?: Array<{ column: string; operator: RecordFilterOperator; value?: unknown }>;
  sort?: Array<{ column: string; order: 'asc' | 'desc' }>;
  search?: { columns: string[]; value: string };
  cursor?: string;
  limit?: number;
}
import { CursorCodec } from '../../../shared/pagination/cursor-codec';
import { normalizeRecordLimit } from '../domain/value-objects/record-query.vo';
import {
  createCursorPaginatedResponse,
  type CursorPaginatedResponse,
} from '../../../shared/pagination/cursor-paginated.response';

/** Ket qua tra ve cho HTTP giu snake_case de tuong thich API cu (controller pass-through). */
export interface ColumnStatsResult {
  column_key: string;
  column_name: string;
  total_records: number;
  null_count: number;
  missing_ratio: number;
  min?: number;
  max?: number;
  average?: number;
  histogram: { bucket_start: number; bucket_end: number; count: number }[];
}

function validationError(message: string): BadRequestException {
  return new BadRequestException({
    message,
    error: 'VALIDATION_ERROR',
  } as never);
}

function isObjectIdHex(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(id);
}

function decodeRowCursor(cursor: string | undefined): number | undefined {
  if (!cursor) return undefined;
  const decoded = CursorCodec.decode<{ row_index: number }>(cursor);
  if (
    !decoded ||
    typeof decoded.row_index !== 'number' ||
    !Number.isInteger(decoded.row_index) ||
    decoded.row_index < 0
  ) {
    throw validationError('Cursor khong hop le (opaque cursor sai dinh dang)');
  }
  return decoded.row_index;
}

function toSnakeStats(domain: DomainColumnStats): ColumnStatsResult {
  return {
    column_key: domain.columnKey,
    column_name: domain.columnName,
    total_records: domain.totalRecords,
    null_count: domain.nullCount,
    missing_ratio: domain.missingRatio,
    min: domain.min,
    max: domain.max,
    average: domain.average,
    histogram: (domain.histogram ?? []).map((b) => ({
      bucket_start: b.bucketStart,
      bucket_end: b.bucketEnd,
      count: b.count,
    })),
  };
}

/** Giai key cot tu client: chap nhan ca key c{i} va ten hien thi / ten goc. Pure. */
function resolveColumnKey(
  input: string,
  byKey: Map<string, string>,
  byName: Map<string, string>,
): string {
  const hitKey = byKey.get(input);
  if (hitKey) return hitKey;
  const hitName = byName.get(input);
  if (hitName) return hitName;
  throw validationError(`Cot khong ton tai trong dataset: ${input}`);
}

@Injectable()
export class DataViewService {
  private readonly logger = new Logger(DataViewService.name);

  constructor(
    @Inject(RECORD_QUERY_PORT)
    private readonly records: RecordQueryPort,
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
  ) {}

  /**
   * F5.1 Wave 4: keyset pagination theo (row_index, _id), khong total/offset/skip.
   * Cursor la opaque base64url { row_index }; sai dinh dang -> VALIDATION_ERROR (C10).
   * Application chi goi ports — khong Mongoose/Model/Types.
   */
  async getRecords(
    datasetId: string,
    query: GetRecordsInput,
  ): Promise<CursorPaginatedResponse<RecordRow>> {
    if (!isObjectIdHex(datasetId)) {
      throw new BadRequestException('ID Tap du lieu khong hop le');
    }
    const dataset = await this.datasets.findById(datasetId);
    if (!dataset) {
      throw new NotFoundException(`Khong tim thay tap du lieu ${datasetId}`);
    }
    const lastRowIndex = decodeRowCursor(query.cursor);
    const limit = normalizeRecordLimit(query.limit);
    const cursorForPort = lastRowIndex !== undefined
      ? CursorCodec.encode({ row_index: lastRowIndex })
      : undefined;
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
      nextCursor = CursorCodec.encode({ row_index: last.rowIndex });
    }
    return {
      items: resultItems,
      meta: { nextCursor, hasMore },
      next_cursor: nextCursor,
      has_more: hasMore,
    };
  }

  /**
   * F5.4 Wave 4: loc/sap xep/tim kiem tren props.cN + keyset pagination.
   */
  async queryRecords(
    datasetId: string,
    body: QueryRecordsBodyInput,
  ): Promise<CursorPaginatedResponse<RecordRow>> {
    if (!isObjectIdHex(datasetId)) {
      throw new BadRequestException('ID Tap du lieu khong hop le');
    }
    const dataset = await this.datasets.findById(datasetId);
    if (!dataset) {
      throw new NotFoundException(`Khong tim thay tap du lieu ${datasetId}`);
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
      filters: (body.filters ?? []).map((f) => ({ column: f.column, operator: f.operator, value: f.value })),
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
      nextCursor = CursorCodec.encode({ row_index: items[items.length - 1].rowIndex });
    }
    return {
      items,
      meta: { nextCursor, hasMore },
      next_cursor: nextCursor,
      has_more: hasMore,
    };
  }

  /**
   * F5.3 Wave 4: thong ke theo column key (chap nhan ca ten hien thi de tuong thich).
   */
  async getColumnStats(datasetId: string, columnRef: string): Promise<ColumnStatsResult> {
    if (!isObjectIdHex(datasetId)) {
      throw new BadRequestException('ID Tap du lieu khong hop le');
    }
    const dataset = await this.datasets.findById(datasetId);
    if (!dataset) {
      throw new NotFoundException(`Khong tim thay tap du lieu ${datasetId}`);
    }
    const targetColumn =
      dataset.columns.find((c) => c.key === columnRef) ??
      dataset.columns.find((c) => c.name === columnRef) ??
      dataset.columns.find((c) => c.originalName === columnRef);
    if (!targetColumn) {
      throw new NotFoundException(`Khong tim thay cot ${columnRef} trong dataset ${datasetId}`);
    }
    const domain = await this.records.getColumnStats(datasetId, targetColumn.key);
    const snake = toSnakeStats({ ...domain, columnName: targetColumn.name });
    // Chi tra histogram so khi cot la number; neu cot khong phai number thi tra rong (giua API cu).
    if (targetColumn.dataType !== 'number') {
      return { ...snake, min: undefined, max: undefined, average: undefined, histogram: [] };
    }
    return snake;
  }
}
