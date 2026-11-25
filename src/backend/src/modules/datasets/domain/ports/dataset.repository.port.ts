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
  /**
   * Lấy dataset **đã bị xóa mềm** của một project — dùng để **hoàn tất**
   * việc dọn file R2 khi lần cascade trước đã soft-delete nhưng xóa file
   * thất bại (R2 down) ⇒ event được retry.
   *
   * Vì sao cần method riêng:
   * `softDeleteByProject()` chỉ trả về dataset **còn sống**. Sau khi
   * soft-delete thành công, lần retry tiếp theo sẽ trả về mảng rỗng ⇒
   * không bao giờ xóa lại file R2 ⇒ **rò rỉ dung lượng vĩnh viễn**.
   * Method này trả về cả dataset đã xóa mềm (mọi trạng thái) để lần retry
   * biết chính xác file nào cần dọn.
   */
  listAllByProjectIncludingDeleted(
    projectId: string,
  ): Promise<
    Array<{
      id: string;
      fileSizeBytes: number;
      storageKey: string;
      deleted: boolean;
      /** Đã giải phóng dung lượng workspace hay chưa (cờ idempotent). */
      storageReleased: boolean;
    }>
  >;
  /**
   * Đánh dấu dataset **đã giải phóng dung lượng** của workspace — cờ
   * idempotent để việc trừ `storage_used` chỉ xảy ra đúng một lần.
   *
   * Trả về `true` nếu lần gọi này là lần **đầu tiên** đánh dấu (⇒ caller
   * được phép trừ `storage_used`), `false` nếu đã đánh dấu rồi (⇒ caller
   * **không** được trừ lần nữa).
   */
  markStorageReleased(datasetId: string): Promise<boolean>;
}
