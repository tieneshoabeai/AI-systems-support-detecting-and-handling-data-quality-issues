import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../shared/database/base-mongo.repository';

export interface IChangeSummary {
  description: string;
  rule_ids: string[];
}

export interface IDatasetVersion extends Document, BaseEntity {
  _id: Types.ObjectId;
  dataset_id: Types.ObjectId;
  version_number: number;
  parent_hash: string;
  parent_version_id: Types.ObjectId | null;
  rules_hash: string;
  data_checksum: string;
  version_hash: string;
  snapshot_storage_key: string;
  record_count: number;
  change_summary: IChangeSummary;
  created_by: Types.ObjectId;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const DatasetVersionSchema = new Schema<IDatasetVersion>(
  {
    dataset_id: {
      type: Schema.Types.ObjectId,
      ref: 'Dataset',
      required: true,
      index: true,
    },
    version_number: {
      type: Number,
      required: true,
    },
    parent_hash: {
      type: String,
      required: true,
      maxlength: 64,
    },
    parent_version_id: {
      type: Schema.Types.ObjectId,
      ref: 'DatasetVersion',
      default: null,
    },
    rules_hash: {
      type: String,
      required: true,
      default: '0'.repeat(64),
      maxlength: 64,
    },
    data_checksum: {
      type: String,
      required: true,
      maxlength: 64,
    },
    version_hash: {
      type: String,
      required: true,
      index: true,
      maxlength: 64,
    },
    snapshot_storage_key: {
      type: String,
      required: true,
    },
    record_count: {
      type: Number,
      required: true,
      default: 0,
    },
    change_summary: {
      description: { type: String, required: true, default: 'Initial commit' },
      rule_ids: { type: [String], default: [] },
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

DatasetVersionSchema.index(
  { dataset_id: 1, version_number: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } }
);
