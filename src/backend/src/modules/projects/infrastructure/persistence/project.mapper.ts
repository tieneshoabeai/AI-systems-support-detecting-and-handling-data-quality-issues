import { Types } from 'mongoose';
import type { IProject } from './project.schema';
import type { ProjectMemberRecord } from '../../domain/ports/project.repository.port';
import { Project } from '../../domain/entities/project.entity';

/**
 * PROJECTS — Mapper giữa tài liệu Mongoose và entity domain.
 *
 * **Trách nhiệm (Phần 5 §3.7 quy tắc 1):** adapter có nhiệm vụ map
 * document → entity qua `reconstitute()`. Domain **không** biết Mongoose.
 */
export function toProjectEntity(doc: IProject): Project {
  return Project.reconstitute({
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
    version: (doc as unknown as { version?: number }).version ?? 1,
    createdBy: doc.created_by.toString(),
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    deletedAt: doc.deleted_at ?? null,
  });
}

/** Thành viên entity → shape lưu trữ. */
export function toMemberPersistence(m: ProjectMemberRecord): {
  user_id: Types.ObjectId;
  role: ProjectMemberRecord['role'];
  joined_at: Date;
} {
  return { user_id: new Types.ObjectId(m.userId), role: m.role, joined_at: m.joinedAt };
}
