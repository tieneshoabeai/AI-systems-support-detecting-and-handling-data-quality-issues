import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../shared/database/base-mongo.repository';

export interface IWorkspaceMember {
  user_id: Types.ObjectId;
  role: 'owner' | 'editor' | 'viewer';
  joined_at: Date;
}

export interface IWorkspace extends Document, BaseEntity {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  owner_id: Types.ObjectId;
  members: IWorkspaceMember[];
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const WorkspaceMemberSchema = new Schema<IWorkspaceMember>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'editor', 'viewer'], required: true, default: 'viewer' },
    joined_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

export const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    owner_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: { type: [WorkspaceMemberSchema], default: [] },
    deleted_at: { type: Date, default: null, index: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

WorkspaceSchema.index({ owner_id: 1, deleted_at: 1 });
WorkspaceSchema.index({ 'members.user_id': 1, deleted_at: 1 });
