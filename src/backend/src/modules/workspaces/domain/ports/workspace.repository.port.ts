/**
 * WORKSPACE — Domain repository port (hexagonal chuẩn).
 * Application chỉ gọi qua port này. Không mongoose, không NestJS.
 * Mọi id là string (hex ObjectId).
 */

export const WORKSPACE_REPOSITORY_PORT = Symbol('WorkspaceRepositoryPort');

export interface WorkspaceMemberRecord {
  userId: string;
  role: 'owner' | 'member';
  joinedAt: Date;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: WorkspaceMemberRecord[];
  storageUsedBytes: number;
  lastAccessedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceListQuery {
  search?: string;
  role?: 'owner' | 'member';
  sort?: 'last_accessed' | 'updated' | 'name_asc' | 'name_desc' | 'joined';
  page?: number;
  limit?: number;
}

export interface CreateWorkspaceRecord {
  name: string;
  description: string;
  ownerId: string;
}

export interface WorkspaceRepositoryPort {
  create(data: CreateWorkspaceRecord): Promise<WorkspaceRecord>;
  findById(id: string): Promise<WorkspaceRecord | null>;
  findByUser(userId: string): Promise<WorkspaceRecord[]>;
  findAllActive(): Promise<WorkspaceRecord[]>;
  findByUserPaged(
    userId: string,
    opts?: WorkspaceListQuery,
  ): Promise<{ items: WorkspaceRecord[]; total: number }>;
  updateById(id: string, update: { name?: string; description?: string }): Promise<WorkspaceRecord | null>;
  softDelete(id: string): Promise<boolean>;
  addMember(workspaceId: string, member: WorkspaceMemberRecord): Promise<boolean>;
  removeMember(workspaceId: string, userId: string): Promise<boolean>;
  updateMemberRole(workspaceId: string, userId: string, role: 'owner' | 'member'): Promise<boolean>;
  touchLastAccessed(workspaceId: string): Promise<void>;
  addStorageUsed(workspaceId: string, deltaBytes: number): Promise<void>;
  transferOwner(workspaceId: string, newOwnerId: string): Promise<boolean>;
}
