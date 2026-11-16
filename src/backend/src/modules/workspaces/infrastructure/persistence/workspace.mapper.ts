import { Types } from 'mongoose';
import type { IWorkspace, IWorkspaceMember } from './workspace.schema';
import type {
  WorkspaceMemberRecord,
  WorkspaceRecord,
} from '../../domain/ports/workspace.repository.port';

export function toMemberRecord(m: IWorkspaceMember): WorkspaceMemberRecord {
  return {
    userId: m.user_id.toString(),
    role: m.role,
    joinedAt: m.joined_at,
  };
}

export function toWorkspaceRecord(doc: IWorkspace): WorkspaceRecord {
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description ?? '',
    ownerId: doc.owner_id.toString(),
    members: (doc.members ?? []).map(toMemberRecord),
    storageUsedBytes: doc.storage_used_bytes ?? 0,
    lastAccessedAt: doc.last_accessed_at ?? null,
    version: (doc as unknown as { version?: number }).version ?? 1,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

export function toMemberPersistence(m: WorkspaceMemberRecord): IWorkspaceMember {
  return {
    user_id: new Types.ObjectId(m.userId),
    role: m.role,
    joined_at: m.joinedAt,
  } as IWorkspaceMember;
}
