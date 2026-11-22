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
import type { DatasetFinding } from '../services/finding.util';

export const DATASET_REPOSITORY_PORT = Symbol('DatasetRepositoryPort');

/** Loại lỗi tên cột — re-export từ entity để tầng ngoài không import sâu. */
export type { DatasetColumnIssue, DatasetColumnIssueType } from '../entities/dataset.entity';
export type { DatasetColumn, DatasetStatus, DatasetDelimiter } from '../entities/dataset.entity';
export type { DatasetFinding } from '../services/finding.util';

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
  /** Mục "Phát hiện" (OPEN-03/04/05). */
  findings?: DatasetFinding[];
  hasHeader: boolean;
  delimiter: ',';
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
  /**
   * Xóa **cứng** toàn bộ bản ghi của một dataset (không đánh dấu dataset).
   *
   * Dùng trong luồng cleanup khi ingestion thất bại: bản ghi đã ghi ngoài
   * transaction (vượt trần 16 MB) nên phải xóa tay, còn dataset được giữ lại
   * ở trạng thái `FAILED` để tra cứu.
   */
  deleteRecordsByDataset(datasetId: string): Promise<number>;
  softDeleteDatasetWithRecords(datasetId: string): Promise<boolean>;
  /**
   * Cascade — soft-delete dataset **thuộc project** đã xóa, kèm xóa bản ghi.
   *
   * Dùng bởi consumer của event `PROJECT_DELETED` (module `datasets` sở hữu
   * collection `datasets` + `dataset_records`).
   *
   * Trả về danh sách dataset đã bị xóa (kèm `fileSizeBytes` để trừ dung lượng
   * đã dùng của workspace).
   */
  softDeleteByProject(projectId: string): Promise<Array<{ id: string; fileSizeBytes: number }>>;
}
