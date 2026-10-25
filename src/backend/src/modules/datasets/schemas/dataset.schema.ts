import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../shared/database/base-mongo.repository';

export type ColumnDataType = 'string' | 'number' | 'boolean' | 'date';

export interface IColumnDefinition {
  name: string;
  data_type: ColumnDataType;
  original_name: string;
  missing_count: number;
}

export interface IDataset extends Document, BaseEntity {
  _id: Types.ObjectId;
  project_id: Types.ObjectId;
  workspace_id: Types.ObjectId;
  name: string;
  original_file_name: string;
  file_format: 'csv' | 'xlsx' | 'json';
  file_size_bytes: number;
  file_checksum: string;
  storage_key: string;
  row_count: number;
  column_count: number;
  columns: IColumnDefinition[];
  current_version: number;
  status: 'INGESTING' | 'READY' | 'FAILED';
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const ColumnDefinitionSchema = new Schema<IColumnDefinition>(
  {
    name: { type: String, required: true },
    data_type: {
      type: String,
      enum: ['string', 'number', 'boolean', 'date'],
      required: true,
      default: 'string',
    },
    original_name: { type: String, required: true },
    missing_count: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

export const DatasetSchema = new Schema<IDataset>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    original_file_name: { type: String, required: true },
    file_format: { type: String, enum: ['csv', 'xlsx', 'json'], required: true },
    file_size_bytes: { type: Number, required: true, default: 0 },
    file_checksum: { type: String, required: true, index: true },
    storage_key: { type: String, required: true },
    row_count: { type: Number, required: true, default: 0 },
    column_count: { type: Number, required: true, default: 0 },
    columns: { type: [ColumnDefinitionSchema], default: [] },
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
