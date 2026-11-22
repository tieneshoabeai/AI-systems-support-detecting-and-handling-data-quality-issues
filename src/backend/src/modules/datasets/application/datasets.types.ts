/**
 * DATASETS — Kiểu dữ liệu tầng application (input/output contract).
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 * Không import HTTP, không import infrastructure.
 */

export interface UpdateDatasetInput {
  name?: string;
}

export interface RenameColumnItemInput {
  key: string;
  name: string;
}

export interface RenameColumnsInput {
  columns: RenameColumnItemInput[];
}
