import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../shared/database/base-mongo.repository';

export interface IDatasetRecord extends Document, BaseEntity {
  _id: Types.ObjectId;
  dataset_id: Types.ObjectId;
  row_index: number;
  data: Record<string, unknown>;
  version_number: number;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const DatasetRecordSchema = new Schema<IDatasetRecord>(
  {
    dataset_id: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
    row_index: { type: Number, required: true, index: true },
    data: { type: Schema.Types.Mixed, required: true },
    version_number: { type: Number, required: true, default: 1 },
    deleted_at: { type: Date, default: null, index: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

DatasetRecordSchema.index({ dataset_id: 1, row_index: 1, deleted_at: 1 });
DatasetRecordSchema.index({ dataset_id: 1, deleted_at: 1 });
