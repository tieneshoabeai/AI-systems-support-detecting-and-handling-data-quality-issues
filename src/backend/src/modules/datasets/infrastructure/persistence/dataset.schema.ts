import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';

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
  has_header: boolean;
  delimiter: ',' | ';' | '\t' | '|';
  current_version: number;
  status: 'INGESTING' | 'READY' | 'FAILED';
  deleted_at: Date | null;
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
    has_header: { type: Boolean, default: true },
    delimiter: { type: String, enum: [',', ';', '\t', '|'], default: ',' },
    current_version: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: ['INGESTING', 'READY', 'FAILED'],
      required: true,
      default: 'INGESTING',
      index: true,
    },
    deleted_at: { type: Date, default: null, index: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

DatasetSchema.index({ project_id: 1, deleted_at: 1 });
DatasetSchema.index({ workspace_id: 1, deleted_at: 1 });
