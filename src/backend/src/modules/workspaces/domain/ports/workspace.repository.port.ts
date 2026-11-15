/**
 * WORKSPACE — Domain repository port (hexagonal chuẩn).
 * Application chỉ gọi qua port này. Không mongoose, không NestJS.
 * Mọi id là string (hex ObjectId).
 */
import type { ListCursor } from '../../../../shared/utils/list-cursor';

export const WORKSPACE_REPOSITORY_PORT = Symbol('WorkspaceRepositoryPort');

/** Các kiểu sắp xếp được hỗ trợ cho danh sách workspace. */
export const WORKSPACE_SORT_OPTIONS = [
  'last_accessed',
  'updated',
  'name_asc',
  'name_desc',
  'joined',
] as const;

export type WorkspaceSort = (typeof WORKSPACE_SORT_OPTIONS)[number];

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
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceListQuery {
  search?: string;
  role?: 'owner' | 'member';
  sort?: WorkspaceSort;
  /** Con trỏ keyset đã giải mã — `undefined` khi lấy trang đầu tiên. */
  cursor?: ListCursor;
  limit?: number;
}

/**
 * Input của use-case list workspace (tầng application → HTTP).
 * `cursor` ở đây là chuỗi opaque do client gửi lên, chưa giải mã.
 */
export interface WorkspaceListInput {
  search?: string;
  role?: 'owner' | 'member';
  sort?: WorkspaceSort;
  cursor?: string;
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
  ): Promise<{ items: WorkspaceRecord[]; nextCursor: string | null; hasMore: boolean }>;
  updateById(id: string, update: { name?: string; description?: string }, expectedVersion?: number): Promise<WorkspaceRecord | null>;
  softDelete(id: string): Promise<boolean>;
  addMember(workspaceId: string, member: WorkspaceMemberRecord): Promise<boolean>;
  removeMember(workspaceId: string, userId: string): Promise<boolean>;
  updateMemberRole(workspaceId: string, userId: string, role: 'owner' | 'member', expectedVersion?: number): Promise<boolean | null>;
  touchLastAccessed(workspaceId: string): Promise<void>;
  addStorageUsed(workspaceId: string, deltaBytes: number): Promise<void>;
  transferOwner(workspaceId: string, newOwnerId: string, expectedVersion: number): Promise<boolean | null>;
}
