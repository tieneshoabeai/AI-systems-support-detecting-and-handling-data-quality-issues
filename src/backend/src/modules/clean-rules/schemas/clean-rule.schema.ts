import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../shared/database/base-mongo.repository';

export type RuleCategory =
  | 'null_handling'
  | 'standardization'
  | 'deduplication'
  | 'regex';

export interface ICleanRule extends Document, BaseEntity {
  _id: Types.ObjectId;
  dataset_id: Types.ObjectId;
  workspace_id: Types.ObjectId;
  name: string;
  category: RuleCategory;
  action: string;
  target_column: string | null;
  target_columns: string[];
  parameters: Record<string, unknown>;
  is_active: boolean;
  created_by: Types.ObjectId;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const CleanRuleSchema = new Schema<ICleanRule>(
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
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    category: {
      type: String,
      enum: ['null_handling', 'standardization', 'deduplication', 'regex'],
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    target_column: {
      type: String,
      default: null,
      trim: true,
    },
    target_columns: {
      type: [String],
      default: [],
    },
    parameters: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    is_active: {
      type: Boolean,
      default: true,
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

CleanRuleSchema.index({ dataset_id: 1, deleted_at: 1 });
CleanRuleSchema.index({ workspace_id: 1, deleted_at: 1 });
