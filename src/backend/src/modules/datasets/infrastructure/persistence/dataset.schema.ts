import type { Document, Types } from 'mongoose';
import { Schema } from 'mongoose';
import type { BaseEntity } from '../../../../shared/infrastructure/database/base-mongo.repository';

export type ColumnDataType = 'string' | 'number' | 'boolean' | 'date';

export interface IColumnDefinition {
  /** Khoa on dinh bat bien theo vi tri: c0, c1, ... (S21) */
  key: string;
  /** Vi tri cot trong file goc, >= 0 */
  index: number;
  /** Ten hien thi (sua duoc, mac dinh = ten goc) */
  name: string;
  data_type: ColumnDataType;
  /** Ten goc tu file CSV - dung cho Reset Dataset (M15) */
  original_name: string;
  missing_count: number;
  /** Cot duoc danh dau PII -> luon che truoc khi dua vao prompt AI */
  is_pii: boolean;
}

export interface IColumnIssue {
  column_key: string | null;
  issue: 'empty_name' | 'duplicate_name' | 'whitespace_only';
  message: string;
}

/**
 * Mục "Phát hiện" (OPEN-03/04/05) — vấn đề dữ liệu kèm vị trí lỗi cụ thể.
 */
export interface IFinding {
  type: string;
  severity: string;
  column_key: string | null;
  column_name: string | null;
  row_index: number | null;
  message: string;
  details?: Record<string, unknown>;
}

export interface IDataset extends Document, BaseEntity {
  _id: Types.ObjectId;
  project_id: Types.ObjectId;
  workspace_id: Types.ObjectId;
  name: string;
  original_file_name: string;
  /** Wave 4: chi nhan .csv (M28, O34) */
  file_format: 'csv';
  file_size_bytes: number;
  file_checksum: string;
  storage_key: string;
  row_count: number;
  column_count: number;
  columns: IColumnDefinition[];
  column_issues: IColumnIssue[];
  /** Mục "Phát hiện" (OPEN-03/04/05). */
  findings: IFinding[];
  has_header: boolean;
  delimiter: ',';
  current_version: number;
  status: 'INGESTING' | 'READY' | 'FAILED';
  deleted_at: Date | null;
  /**
   * Đã giải phóng dung lượng của workspace cho dataset này hay chưa.
   *
   * Cờ **idempotent** ⇒ việc trừ `storage_used` của workspace chỉ xảy ra đúng
   * một lần, kể cả khi event cascade bị retry nhiều lần (R2 down ⇒ ném lỗi
   * ⇒ Inbox retry). Không có cờ này, lần retry sẽ trừ `storage_used` lần nữa
   * ⇒ `storage_used` âm ⇒ quota sai.
   */
  storage_released: boolean;
  created_at: Date;
  updated_at: Date;
}

export const ColumnDefinitionSchema = new Schema<IColumnDefinition>(
  {
    key: { type: String, required: true },
    index: { type: Number, required: true },
    name: { type: String, required: true },
    data_type: {
      type: String,
      enum: ['string', 'number', 'boolean', 'date'],
      required: true,
      default: 'string',
    },
    original_name: { type: String, required: true },
    missing_count: { type: Number, required: true, default: 0 },
    is_pii: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

export const ColumnIssueSchema = new Schema<IColumnIssue>(
  {
    column_key: { type: String, default: null },
    issue: {
      type: String,
      enum: ['empty_name', 'duplicate_name', 'whitespace_only'],
      required: true,
    },
    message: { type: String, required: true },
  },
  { _id: false }
);

export const FindingSchema = new Schema<IFinding>(
  {
    type: { type: String, required: true },
    severity: { type: String, required: true },
    column_key: { type: String, default: null },
    column_name: { type: String, default: null },
    row_index: { type: Number, default: null },
    message: { type: String, required: true },
    details: { type: Schema.Types.Mixed, default: undefined },
  },
  { _id: false }
);

export const DatasetSchema = new Schema<IDataset>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    original_file_name: { type: String, required: true },
    file_format: { type: String, enum: ['csv'], required: true, default: 'csv' },
    file_size_bytes: { type: Number, required: true, default: 0 },
    file_checksum: { type: String, required: true, index: true },
    storage_key: { type: String, required: true },
    row_count: { type: Number, required: true, default: 0 },
    column_count: { type: Number, required: true, default: 0 },
    columns: { type: [ColumnDefinitionSchema], default: [] },
    column_issues: { type: [ColumnIssueSchema], default: [] },
    findings: { type: [FindingSchema], default: [] },
    has_header: { type: Boolean, default: true },
    delimiter: { type: String, enum: [','], default: ',' },
    current_version: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: ['INGESTING', 'READY', 'FAILED'],
      required: true,
      default: 'INGESTING',
      index: true,
    },
    deleted_at: { type: Date, default: null, index: true },
    storage_released: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

DatasetSchema.index({ project_id: 1, deleted_at: 1 });
DatasetSchema.index({ workspace_id: 1, deleted_at: 1 });
