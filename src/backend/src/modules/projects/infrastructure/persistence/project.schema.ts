import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';

import type { ProjectStatus } from '../../domain/value-objects/project-status.vo';
import type { ProjectMemberRole } from '../../domain/value-objects/project-role.vo';
export type { ProjectStatus, ProjectMemberRole };

export interface IProjectMember {
  user_id: Types.ObjectId;
  role: ProjectMemberRole;
  joined_at: Date;
}

export interface IProject extends Document, BaseEntity {
  _id: Types.ObjectId;
  workspace_id: Types.ObjectId;
  name: string;
  description?: string;
  has_dataset: boolean;
  status: ProjectStatus;
  members: IProjectMember[];
  last_accessed_at: Date | null;
  created_by: Types.ObjectId;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const ProjectMemberSchema = new Schema<IProjectMember>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'member', 'viewer'], required: true, default: 'viewer' },
    joined_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

export const ProjectSchema = new Schema<IProject>(
  {
    workspace_id: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    has_dataset: { type: Boolean, required: true, default: false, index: true },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed'],
      required: true,
      default: 'not_started',
      index: true,
    },
    members: { type: [ProjectMemberSchema], default: [] },
    last_accessed_at: { type: Date, default: null, index: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deleted_at: { type: Date, default: null, index: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

ProjectSchema.index({ workspace_id: 1, deleted_at: 1 });
ProjectSchema.index({ workspace_id: 1, name: 1, deleted_at: 1 });
ProjectSchema.index({ workspace_id: 1, deleted_at: 1, last_accessed_at: -1 });
ProjectSchema.index({ status: 1, deleted_at: 1 });
