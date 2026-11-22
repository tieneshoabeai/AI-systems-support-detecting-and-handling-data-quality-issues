/**
 * Public contract của module DATA-VIEW (Virtual Grid).
 *
 * Các module khác chỉ được import qua file này (quy tắc CA8 — cross-module
 * import phải đi qua public contract), không import sâu vào
 * `domain/ports/...` hay `application/...`.
 *
 * Lưu ý L2 (R3/CA6): module này KHÔNG sở hữu schema Mongoose `DatasetRecord`.
 * Việc đọc bản ghi đi qua `RECORD_QUERY_PORT` thuộc module `datasets`
 * (xem `modules/datasets/index.ts`).
 */


export {
  DEFAULT_RECORD_LIMIT,
  MAX_RECORD_LIMIT,
  normalizeRecordLimit,
} from './domain/value-objects/record-query.vo';

export {
  RECORD_FILTER_OPERATORS,
  isValidOperator,
  propsPath,
  resolveColumnKeyPure,
  type RecordFilterOperator,
} from './domain/value-objects/record-filter.vo';

export { GetRecordsHandler } from './application/queries/get-records.handler';
export { GetColumnStatsHandler } from './application/queries/get-column-stats.handler';

// ── Handlers (Command/Query) ──────────────────────────
// ── Queries (đọc) ──────────────────────────────────────────────
export { QueryRecordsHandler } from './application/queries/query-records.handler';
