import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../shared/database/base-mongo.repository';

export interface IProject extends Document, BaseEntity {
  _id: Types.ObjectId;
  workspace_id: Types.ObjectId;
  name: string;
  description?: string;
  has_dataset: boolean;
  created_by: Types.ObjectId;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const ProjectSchema = new Schema<IProject>(
  {
    workspace_id: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    has_dataset: { type: Boolean, required: true, default: false, index: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deleted_at: { type: Date, default: null, index: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

ProjectSchema.index({ workspace_id: 1, deleted_at: 1 });
ProjectSchema.index({ workspace_id: 1, name: 1, deleted_at: 1 });
