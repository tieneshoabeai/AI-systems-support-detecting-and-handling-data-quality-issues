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

// ── Domain entity (Bước 3 — Rich Domain Model) ────────────────────────────
export {
  Dataset,
  type DatasetColumn,
  type DatasetColumnIssue,
  type DatasetColumnIssueType,
  type DatasetDelimiter,
  type DatasetFinding,
  type DatasetProps,
  type DatasetStatus,
} from './domain/entities/dataset.entity';

// ── Mục "Phát hiện" (OPEN-03/04/05) ─────────────────────────────────────
export {
  makeFinding,
  type DatasetFindingSeverity,
  type DatasetFindingType,
} from './domain/services/finding.util';

export {
  DATASET_REPOSITORY_PORT,
  type CreateDatasetInput,
  type DatasetRepositoryPort,
  type RecordInsertDoc,
} from './domain/ports/dataset.repository.port';

export {
  RECORD_QUERY_PORT,
  type ColumnStatsResult,
  type ColumnValuesResult,
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

// ── Policy loader (dùng cho `@PolicyResource` — tầng động chống IDOR) ─────
export { DatasetPolicyLoader } from './application/policy-loaders/dataset-policy.loader';

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