/**
 * GetRecordsHandler — Use case: `getRecords()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import { DATASET_REPOSITORY_PORT, type DatasetRepositoryPort } from '../../../datasets';
import { RECORD_QUERY_PORT, type RecordQueryPort, type RecordRow } from '../../../datasets';
import { CursorCodec } from '../../../../shared/domain/pagination/cursor-codec';
import { normalizeRecordLimit } from '../../domain/value-objects/record-query.vo';
import { type CursorPaginatedResponse } from '../../../../shared/domain/pagination/cursor-paginated.response';
import { GetRecordsInput } from '../data-view.types';
import { isObjectIdHex, decodeRowCursor } from '../data-view.utils';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class GetRecordsHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
    @Inject(RECORD_QUERY_PORT)
    private readonly records: RecordQueryPort,
  ) {}

  async execute(
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
}
