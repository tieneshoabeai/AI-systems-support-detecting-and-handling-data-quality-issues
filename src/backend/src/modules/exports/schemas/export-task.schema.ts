import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../shared/database/base-mongo.repository';

export type ExportType = 'csv' | 'aes256_gcm';

export interface IExportTask extends Document, BaseEntity {
  _id: Types.ObjectId;
  dataset_id: Types.ObjectId;
  workspace_id: Types.ObjectId;
  export_type: ExportType;
  file_name: string;
  storage_key: string;
  file_size_bytes: number;
  record_count: number;
  checksum_sha256: string;
  is_encrypted: boolean;
  created_by: Types.ObjectId;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const ExportTaskSchema = new Schema<IExportTask>(
  {
    dataset_id: {
      type: Schema.Types.ObjectId,
      ref: 'Dataset',
      required: true,
      index: true,
    },
    workspace_id: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    export_type: {
      type: String,
      enum: ['csv', 'aes256_gcm'],
      required: true,
    },
    file_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    storage_key: {
      type: String,
      required: true,
    },
    file_size_bytes: {
      type: Number,
      required: true,
      default: 0,
    },
    record_count: {
      type: Number,
      required: true,
      default: 0,
    },
    checksum_sha256: {
      type: String,
      required: true,
      maxlength: 64,
    },
    is_encrypted: {
      type: Boolean,
      default: false,
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deleted_at: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

ExportTaskSchema.index({ dataset_id: 1, deleted_at: 1 });
ExportTaskSchema.index({ workspace_id: 1, deleted_at: 1 });
