/**
 * WORKSPACE — Domain repository port (hexagonal chuẩn).
 * Application chỉ gọi qua port này. Không mongoose, không NestJS.
 * Mọi id là string (hex ObjectId).
 *
 * **Bước 3 — Rich Domain Model:** port trả **entity** `Workspace`, không trả
 * interface trần. Adapter có nhiệm vụ map document → entity qua
 * `Workspace.reconstitute()` (Phần 5 §3.7 quy tắc 1).
 */
import type { ListCursor } from '../../../../shared/domain/utils/list-cursor';
import type { Workspace } from '../entities/workspace.entity';

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

/** Các kiểu sắp xếp được hỗ trợ cho danh sách thành viên workspace. */
export const WORKSPACE_MEMBER_SORT_OPTIONS = [
  'name_asc',
  'name_desc',
  'joined',
  'role',
] as const;

export type WorkspaceMemberSort = (typeof WORKSPACE_MEMBER_SORT_OPTIONS)[number];

export interface WorkspaceMemberRecord {
  userId: string;
  role: 'owner' | 'member';
  joinedAt: Date;
}

/**
 * Thành viên workspace kèm thông tin hồ sơ (đã populate tên/email — E6).
 * Được dùng cho endpoint WS-06 (danh sách + tìm kiếm thành viên).
 */
export interface WorkspaceMemberView extends WorkspaceMemberRecord {
  /** Khóa duy nhất của dòng (dùng làm tiebreaker cho keyset cursor). */
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
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

/**
 * Input của use-case WS-06 — danh sách thành viên workspace.
 * `cursor` ở đây là chuỗi opaque do client gửi lên, chưa giải mã.
 */
export interface WorkspaceMembersListInput {
  search?: string;
  role?: 'owner' | 'member';
  sort?: WorkspaceMemberSort;
  cursor?: string;
  limit?: number;
}

export interface CreateWorkspaceRecord {
  name: string;
  description: string;
  ownerId: string;
}

export interface WorkspaceRepositoryPort {
  create(data: CreateWorkspaceRecord): Promise<Workspace>;
  findById(id: string): Promise<Workspace | null>;
  findByUser(userId: string): Promise<Workspace[]>;
  findAllActive(): Promise<Workspace[]>;
  /** E3 — đếm workspace theo các tiêu chí khác nhau (tổng quan người dùng). */
  countActive(): Promise<number>;
  /** E3 — số workspace mà user làm chủ sở hữu. */
  countOwnedByUser(userId: string): Promise<number>;
  /** E3 — số workspace mà user được chia sẻ (là thành viên, không phải owner). */
  countSharedByUser(userId: string): Promise<number>;
  findByUserPaged(
    userId: string,
    opts?: WorkspaceListQuery,
  ): Promise<{ items: Workspace[]; nextCursor: string | null; hasMore: boolean }>;
  updateById(
    id: string,
    update: { name?: string; description?: string },
    expectedVersion?: number,
  ): Promise<Workspace | null>;
  softDelete(id: string): Promise<boolean>;
  /**
   * Danh sách id workspace **đã bị xóa mềm**.
   *
   * Dùng để lọc phòng thủ ở tầng query: project thuộc workspace đã xóa không
   * được hiển thị (kể cả khi cascade event chưa được xử lý).
   */
  findDeletedIds(): Promise<string[]>;
  addMember(workspaceId: string, member: WorkspaceMemberRecord): Promise<boolean>;
  removeMember(workspaceId: string, userId: string): Promise<boolean>;
  updateMemberRole(
    workspaceId: string,
    userId: string,
    role: 'owner' | 'member',
    expectedVersion?: number,
  ): Promise<boolean | null>;
  touchLastAccessed(workspaceId: string): Promise<void>;
  addStorageUsed(workspaceId: string, deltaBytes: number): Promise<void>;
  transferOwner(
    workspaceId: string,
    newOwnerId: string,
    expectedVersion: number,
  ): Promise<boolean | null>;
}
