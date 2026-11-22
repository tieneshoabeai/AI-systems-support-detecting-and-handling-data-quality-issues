/**
 * QueryRecordsHandler — Use case: `queryRecords()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import { DATASET_REPOSITORY_PORT, type DatasetRepositoryPort } from '../../../datasets';
import { RECORD_QUERY_PORT, type RecordQueryPort, type RecordRow } from '../../../datasets';
import type { RecordQueryInput } from '../../../datasets';
import { CursorCodec } from '../../../../shared/domain/pagination/cursor-codec';
import { normalizeRecordLimit } from '../../domain/value-objects/record-query.vo';
import {
  createCursorPaginatedResponse,
  type CursorPaginatedResponse,
} from '../../../../shared/domain/pagination/cursor-paginated.response';
import { QueryRecordsBodyInput } from '../data-view.types';
import { isObjectIdHex, resolveColumnKey } from '../data-view.utils';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class QueryRecordsHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
    @Inject(RECORD_QUERY_PORT)
    private readonly records: RecordQueryPort,
  ) {}

  async execute(
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
}
