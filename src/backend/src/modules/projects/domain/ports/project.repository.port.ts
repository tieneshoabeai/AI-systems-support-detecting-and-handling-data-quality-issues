/**
 * PROJECT — Domain repository port (hexagonal chuẩn).
 * Application chỉ gọi qua port này. Không mongoose, không NestJS.
 */
import type { ListCursor } from '../../../../shared/utils/list-cursor';

export const PROJECT_REPOSITORY_PORT = Symbol('ProjectRepositoryPort');

/** Các kiểu sắp xếp được hỗ trợ cho danh sách project. */
export const PROJECT_SORT_OPTIONS = [
  'last_accessed',
  'updated',
  'name_asc',
  'name_desc',
  'joined',
] as const;

export type ProjectSort = (typeof PROJECT_SORT_OPTIONS)[number];

/** Các kiểu sắp xếp được hỗ trợ cho danh sách thành viên project. */
export const PROJECT_MEMBER_SORT_OPTIONS = [
  'name_asc',
  'name_desc',
  'joined',
  'role',
] as const;

export type ProjectMemberSort = (typeof PROJECT_MEMBER_SORT_OPTIONS)[number];

export type ProjectMemberRole = 'owner' | 'member' | 'viewer';
export type ProjectStatus = 'not_started' | 'in_progress' | 'completed';

export interface ProjectMemberRecord {
  userId: string;
  role: ProjectMemberRole;
  joinedAt: Date;
}

/**
 * Thành viên project kèm thông tin hồ sơ (đã populate tên/email — E6).
 * Được dùng cho endpoint PROJ-09 (danh sách + tìm kiếm thành viên).
 */
export interface ProjectMemberView extends ProjectMemberRecord {
  /** Khóa duy nhất của dòng (dùng làm tiebreaker cho keyset cursor). */
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

export interface ProjectRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  hasDataset: boolean;
  status: ProjectStatus;
  members: ProjectMemberRecord[];
  lastAccessedAt: Date | null;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectListQuery {
  search?: string;
  status?: ProjectStatus;
  sort?: ProjectSort;
  /** Con trỏ keyset đã giải mã — `undefined` khi lấy trang đầu tiên. */
  cursor?: ListCursor;
  limit?: number;
}

/**
 * Input của use-case list project (tầng application → HTTP).
 * `cursor` ở đây là chuỗi opaque do client gửi lên, chưa giải mã.
 */
export interface ProjectListInput {
  search?: string;
  status?: ProjectStatus;
  sort?: ProjectSort;
  cursor?: string;
  limit?: number;
}

/**
 * Input của use-case PROJ-09 — danh sách thành viên project.
 * `cursor` ở đây là chuỗi opaque do client gửi lên, chưa giải mã.
 */
export interface ProjectMembersListInput {
  search?: string;
  role?: ProjectMemberRole;
  sort?: ProjectMemberSort;
  cursor?: string;
  limit?: number;
}

export interface CreateProjectRecord {
  workspaceId: string;
  name: string;
  description: string;
  createdBy: string;
  /** Project Owner được chỉ định (F1). Mặc định = `createdBy`. */
  ownerId?: string;
}

export interface AddProjectMemberRecord {
  userId: string;
  role: ProjectMemberRole;
}

export interface ProjectRepositoryPort {
  create(data: CreateProjectRecord): Promise<ProjectRecord>;
  findById(id: string): Promise<ProjectRecord | null>;
  findOneByWorkspaceAndName(workspaceId: string, name: string): Promise<ProjectRecord | null>;
  findByWorkspace(workspaceId: string): Promise<ProjectRecord[]>;
  /** E3/E4 — đếm project theo workspace (và theo trạng thái nếu có). */
  countByWorkspace(workspaceId: string, status?: ProjectStatus): Promise<number>;
  /** E3 — đếm project mà user là thành viên/owner. */
  countByUser(userId: string): Promise<number>;
  findByWorkspacePaged(
    workspaceId: string,
    opts?: ProjectListQuery,
  ): Promise<{ items: ProjectRecord[]; nextCursor: string | null; hasMore: boolean }>;
  updateById(id: string, update: { name?: string; description?: string }, expectedVersion?: number): Promise<ProjectRecord | null>;
  softDelete(id: string): Promise<boolean>;
  setHasDataset(projectId: string, hasDataset: boolean): Promise<boolean>;
  setStatus(projectId: string, status: ProjectStatus): Promise<boolean>;
  touchLastAccessed(projectId: string): Promise<void>;
  addMember(projectId: string, member: AddProjectMemberRecord): Promise<boolean>;
  removeMember(projectId: string, userId: string): Promise<boolean>;
  updateMemberRole(projectId: string, userId: string, role: ProjectMemberRole, expectedVersion?: number): Promise<boolean | null>;
  transferOwner(projectId: string, newOwnerId: string, expectedVersion?: number): Promise<boolean | null>;
  markCompleted(projectId: string, expectedVersion: number): Promise<boolean | null>;
}
