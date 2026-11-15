import { Schema, Document, Types } from 'mongoose';

/**
 * Wave 4 (S19/A13): dataset_record la INSERT-ONLY.
 * - Chi duoc ghi 1 lan luc import (bulk insert).
 * - Khong co deleted_at, khong co version_number, khong update/delete.
 * - Gia tri o luu trong props theo key cot on dinh c0, c1, ... (M14).
 */
export interface IDatasetRecord extends Document {
  _id: Types.ObjectId;
  dataset_id: Types.ObjectId;
  /** Vi tri dong trong file CSV goc */
  row_index: number;
  /** Gia tri o theo key cot on dinh: { c0: "abc", c1: 42 } */
  props: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export const DatasetRecordSchema = new Schema<IDatasetRecord>(
  {
    dataset_id: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
    row_index: { type: Number, required: true, index: true },
    props: { type: Schema.Types.Mixed, required: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Unique moi dong file goc co dung 1 record + phuc vu keyset pagination (row_index, _id)
DatasetRecordSchema.index({ dataset_id: 1, row_index: 1 }, { unique: true });
