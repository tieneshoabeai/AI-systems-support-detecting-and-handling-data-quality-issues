/**
 * Public contract của module DATASETS.
 *
 * Các module khác chỉ được import qua file này (quy tắc CA8 — cross-module
 * import phải đi qua public contract), không import sâu vào
 * `domain/ports/...` hay `application/...`.
 *
 * Module `datasets` SỞ HỮU collection `dataset_records` và schema Mongoose
 * tương ứng — vì vậy `RECORD_QUERY_PORT` (đọc bản ghi cho Virtual Grid)
 * cũng nằm ở đây, không nằm ở `data-view` (L2 — quy tắc R3/CA6).
 */

export {
  DATASET_REPOSITORY_PORT,
  type CreateDatasetRecord,
  type DatasetColumnIssueRecord,
  type DatasetColumnRecord,
  type DatasetRecord,
  type DatasetRepositoryPort,
  type RecordInsertDoc,
} from './domain/ports/dataset.repository.port';

export {
  RECORD_QUERY_PORT,
  type ColumnStatsResult,
  type DatasetColumnRef,
  type RecordFilter,
  type RecordFilterOperator,
  type RecordQueryInput,
  type RecordQueryPort,
  type RecordRow,
  type RecordSort,
} from './domain/ports/record-query.port';

export {
  COLUMN_DATA_TYPES,
  stableColumnKey,
  type ColumnDataType,
} from './domain/value-objects/column-type.vo';

export {
  IMPORT_BATCH_SIZE,
  MAX_COLUMNS,
  MAX_FILE_BYTES,
  SAMPLE_ROWS_CAP,
  assertColumnLimit,
  assertCsvFile,
  assertFileSize,
  datasetNameFromFile,
  isCsvFile,
  storageKeyForDataset,
} from './domain/value-objects/dataset-limits.vo';

// ── Handlers (Command/Query) ──────────────────────────
// ── Queries (đọc) ──────────────────────────────────────────────
export { DownloadDatasetFileHandler } from './application/queries/download-dataset-file.handler';
export { GetDatasetByIdHandler } from './application/queries/get-dataset-by-id.handler';
export { GetDatasetByProjectIdHandler } from './application/queries/get-dataset-by-project-id.handler';
export { GetDatasetSchemaHandler } from './application/queries/get-dataset-schema.handler';

// ── Commands (ghi) ─────────────────────────────────────────────
export { DeleteDatasetHandler } from './application/commands/delete-dataset.handler';
export { IngestDatasetStreamHandler } from './application/commands/ingest-dataset-stream.handler';
export { MapPropsToOriginalNamesHandler } from './application/commands/map-props-to-original-names.handler';
export { RenameColumnsHandler } from './application/commands/rename-columns.handler';
export { ResetColumnNamesHandler } from './application/commands/reset-column-names.handler';
export { UpdateDatasetHandler } from './application/commands/update-dataset.handler';
