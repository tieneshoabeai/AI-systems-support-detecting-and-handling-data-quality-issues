import { Types } from 'mongoose';
import type { IProject } from './project.schema';
import type { ProjectMemberRecord, ProjectRecord } from '../../domain/ports/project.repository.port';

export function toProjectRecord(doc: IProject): ProjectRecord {
  return {
    id: doc._id.toString(),
    workspaceId: doc.workspace_id.toString(),
    name: doc.name,
    description: doc.description ?? '',
    hasDataset: doc.has_dataset ?? false,
    status: doc.status,
    members: (doc.members ?? []).map(
      (m): ProjectMemberRecord => ({
        userId: m.user_id.toString(),
        role: m.role,
        joinedAt: m.joined_at,
      }),
    ),
    lastAccessedAt: doc.last_accessed_at ?? null,
    createdBy: doc.created_by.toString(),
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

export function toMemberPersistence(m: ProjectMemberRecord): { user_id: Types.ObjectId; role: ProjectMemberRecord['role']; joined_at: Date } {
  return { user_id: new Types.ObjectId(m.userId), role: m.role, joined_at: m.joinedAt };
}
