/**
 * DATASET — Domain repository port (hexagonal chuẩn).
 * Application chỉ gọi qua port này. Không mongoose, không schema.
 *
 * **Bước 3 — Rich Domain Model:** port trả **entity** `Dataset` (không phải
 * record trần) → handler có thể gọi hành vi của entity để kiểm tra invariant
 * trước khi ghi.
 */

import type {
  Dataset,
  DatasetColumn,
  DatasetColumnIssue,
} from '../entities/dataset.entity';

export const DATASET_REPOSITORY_PORT = Symbol('DatasetRepositoryPort');

/** Loại lỗi tên cột — re-export từ entity để tầng ngoài không import sâu. */
export type { DatasetColumnIssue, DatasetColumnIssueType } from '../entities/dataset.entity';
export type { DatasetColumn, DatasetStatus, DatasetDelimiter } from '../entities/dataset.entity';

/** Dữ liệu tạo dataset mới — repository map sang document. */
export interface CreateDatasetInput {
  id: string;
  projectId: string;
  workspaceId: string;
  name: string;
  originalFileName: string;
  fileFormat: 'csv';
  fileSizeBytes: number;
  fileChecksum: string;
  storageKey: string;
  rowCount: number;
  columnCount: number;
  columns: DatasetColumn[];
  columnIssues: DatasetColumnIssue[];
  hasHeader: boolean;
  delimiter: ',' | ';' | '\t' | '|';
  currentVersion: number;
  status: 'INGESTING' | 'READY' | 'FAILED';
}

export interface RecordInsertDoc {
  datasetId: string;
  rowIndex: number;
  props: Record<string, unknown>;
}

export interface DatasetRepositoryPort {
  create(data: CreateDatasetInput): Promise<Dataset>;
  findById(id: string): Promise<Dataset | null>;
  findByProject(projectId: string): Promise<Dataset | null>;
  updateById(
    id: string,
    update: Partial<CreateDatasetInput> & Record<string, unknown>,
  ): Promise<Dataset | null>;
  bulkInsertRecords(records: RecordInsertDoc[]): Promise<number>;
  softDeleteDatasetWithRecords(datasetId: string): Promise<boolean>;
}
