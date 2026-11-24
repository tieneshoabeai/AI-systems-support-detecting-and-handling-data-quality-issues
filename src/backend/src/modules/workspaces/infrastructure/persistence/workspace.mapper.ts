import { Types } from 'mongoose';
import type { IWorkspace, IWorkspaceMember } from './workspace.schema';
import type { WorkspaceMemberRecord } from '../../domain/ports/workspace.repository.port';
import { Workspace } from '../../domain/entities/workspace.entity';

/**
 * WORKSPACES — Mapper giữa tài liệu Mongoose và entity domain.
 *
 * **Trách nhiệm (Phần 5 §3.7 quy tắc 1):** adapter có nhiệm vụ map
 * document → entity qua `reconstitute()`. Domain **không** biết Mongoose.
 */
export function toMemberRecord(m: IWorkspaceMember): WorkspaceMemberRecord {
  return {
    userId: m.user_id.toString(),
    role: m.role,
    joinedAt: m.joined_at,
  };
}

/** Document Mongoose → entity `Workspace` (dựng lại, không phát event). */
export function toWorkspaceEntity(doc: IWorkspace): Workspace {
  return Workspace.reconstitute({
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description ?? '',
    ownerId: doc.owner_id.toString(),
    members: (doc.members ?? []).map(toMemberRecord),
    storageUsedBytes: doc.storage_used_bytes ?? 0,
    lastAccessedAt: doc.last_accessed_at ?? null,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    deletedAt: doc.deleted_at ?? null,
    version: (doc as unknown as { version?: number }).version ?? 1,
  });
}

/** Thành viên entity → shape lưu trữ. */
export function toMemberPersistence(m: WorkspaceMemberRecord): IWorkspaceMember {
  return {
    user_id: new Types.ObjectId(m.userId),
    role: m.role,
    joined_at: m.joinedAt,
  } as IWorkspaceMember;
}
