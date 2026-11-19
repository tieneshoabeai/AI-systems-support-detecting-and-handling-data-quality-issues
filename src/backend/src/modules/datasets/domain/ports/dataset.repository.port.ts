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
  /**
   * GĐ4 — cập nhật **chỉ cờ PII** của các cột.
   *
   * Tách khỏi `updateById` vì `updateById` chỉ chạy được khi dataset còn
   * `INGESTING` (bất biến nội dung), còn cờ PII là *metadata phân loại cột* —
   * được phép cập nhật trên dataset đã `READY`.
   *
   * Method này **không** chạm vào tên cột, số dòng, số cột hay bất kì thuộc
   * tính nội dung nào — chỉ `columns[].is_pii`.
   */
  updateColumnPii(
    id: string,
    updates: Array<{ columnKey: string; isPii: boolean }>,
  ): Promise<Dataset | null>;
  /**
   * Đổi **tên hiển thị** của dataset — metadata, không phải nội dung dữ liệu.
   *
   * Tách khỏi `updateById` vì `updateById` chỉ chạy được khi dataset còn
   * `INGESTING`, còn tên dataset là *metadata nhãn* được phép sửa trên dataset
   * đã `READY`.
   */
  updateName(id: string, name: string): Promise<Dataset | null>;
  /**
   * Đổi **tên hiển thị** của các cột — metadata, không phải nội dung dữ liệu.
   *
   * Chỉ ghi `columns.N.name` (dot-notation) → không đụng `key`, `data_type`,
   * `missing_count`, `is_pii` hay bất kỳ bản ghi nào.
   *
   * `columnIssues` do **domain** tính (entity `renameColumns()`) và truyền vào —
   * adapter không được tự suy luận lại (logic thuộc tầng domain).
   */
  updateColumnNames(
    id: string,
    updates: Array<{ columnKey: string; name: string }>,
    columnIssues: DatasetColumnIssue[],
  ): Promise<Dataset | null>;
  /**
   * Khôi phục tên hiển thị của các cột về **tên gốc** trong file CSV.
   *
   * `POST /datasets/{id}/columns/reset` — hành vi duy nhất còn lại của
   * "Reset Dataset" sau khi thu hẹp (mục 3.12 / 3.40.5).
   */
  resetColumnNames(id: string, columnIssues: DatasetColumnIssue[]): Promise<Dataset | null>;
  bulkInsertRecords(records: RecordInsertDoc[]): Promise<number>;
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
