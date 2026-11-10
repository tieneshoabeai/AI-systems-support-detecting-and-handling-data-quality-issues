import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';

import type { IssueType } from '../../domain/value-objects/issue-type.vo';
export type { IssueType };
export const IssueTypes = ['function_error','display_error','data_error','feature_feedback','other'] as const;

import type { IssueStatus } from '../../domain/value-objects/issue-status.vo';
export type { IssueStatus };
export const IssueStatuses = ['new', 'in_progress', 'resolved', 'closed'] as const;

export interface IIssueAttachment {
  id: Types.ObjectId;
  filename: string;
  storage_key: string;
  size_bytes: number;
  content_type: string;
}

export interface IIssueContext {
  api_path?: string | null;
  error_message?: string | null;
  occurred_at?: Date | null;
}

export interface IIssueReport extends Document, BaseEntity {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  workspace_id?: Types.ObjectId | null;
  issue_type: IssueType;
  title: string;
  description: string;
  status: IssueStatus;
  attachments: IIssueAttachment[];
  context?: IIssueContext;
  version: number;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const IssueAttachmentSchema = new Schema<IIssueAttachment>(
  {
    id: { type: Schema.Types.ObjectId, required: true },
    filename: { type: String, required: true, maxlength: 255 },
    storage_key: { type: String, required: true },
    size_bytes: { type: Number, required: true, max: 10 * 1024 * 1024 },
    content_type: { type: String, required: true },
  },
  { _id: false },
);

const IssueContextSchema = new Schema<IIssueContext>(
  {
    api_path: { type: String, default: null, maxlength: 200 },
    error_message: { type: String, default: null, maxlength: 1000 },
    occurred_at: { type: Date, default: null },
  },
  { _id: false },
);

export const IssueReportSchema = new Schema<IIssueReport>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'Workspace', default: null, index: true },
    issue_type: { type: String, enum: [...IssueTypes], required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },
    status: { type: String, enum: [...IssueStatuses], required: true, default: 'new', index: true },
    attachments: { type: [IssueAttachmentSchema], default: [] },
    context: { type: IssueContextSchema, default: undefined },
    version: { type: Number, required: true, default: 1 },
    deleted_at: { type: Date, default: null, index: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

IssueReportSchema.index({ user_id: 1, status: 1, created_at: -1 });
IssueReportSchema.index({ status: 1, created_at: -1 });
IssueReportSchema.index({ workspace_id: 1, created_at: -1 });
