/**
 * PROJECT — Domain repository port (hexagonal chuẩn).
 * Application chỉ gọi qua port này. Không mongoose, không NestJS.
 *
 * **Bước 3 — Rich Domain Model:** port trả **entity** `Project`, không trả
 * interface trần. Adapter map document → entity qua `Project.reconstitute()`.
 */
import type { ListCursor } from '../../../../shared/domain/utils/list-cursor';
import type { Project } from '../entities/project.entity';

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
  create(data: CreateProjectRecord): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findOneByWorkspaceAndName(workspaceId: string, name: string): Promise<Project | null>;
  findByWorkspace(workspaceId: string): Promise<Project[]>;
  /** E3/E4 — đếm project theo workspace (và theo trạng thái nếu có). */
  countByWorkspace(workspaceId: string, status?: ProjectStatus): Promise<number>;
  /** E3 — đếm project mà user là thành viên/owner. */
  countByUser(userId: string): Promise<number>;
  /**
   * Tất cả project user có quyền truy cập (là thành viên `project.members` hoặc
   * thuộc workspace user làm chủ) — dùng để resolve project context cho CASL.
   */
  findAllByUser(userId: string): Promise<Project[]>;
  findByWorkspacePaged(
    workspaceId: string,
    opts?: ProjectListQuery,
  ): Promise<{ items: Project[]; nextCursor: string | null; hasMore: boolean }>;
  /**
   * PROJ-02b — danh sách project **toàn hệ thống** (không giới hạn theo workspace),
   * phân trang keyset giống `findByWorkspacePaged`.
   *
   * Dùng cho màn hình "Danh sách dự án" của người dùng — gom project từ mọi
   * workspace mà họ có quyền. Quyền được lọc ở tầng application (CASL), không
   * lọc workspace trong query.
   */
  findAllPaged(
    userId: string,
    workspaceIds: string[],
    opts?: ProjectListQuery,
    /** `true` = quản trị viên hệ thống → xem toàn bộ project, không lọc quyền. */
    isAdmin?: boolean,
    /**
     * Id workspace **đã bị xóa** → project thuộc các workspace này bị loại khỏi
     * kết quả (lớp phòng thủ: cascade event có thể chưa được xử lý).
     */
    excludedWorkspaceIds?: string[],
  ): Promise<{ items: Project[]; nextCursor: string | null; hasMore: boolean }>;
  updateById(
    id: string,
    update: { name?: string; description?: string },
    expectedVersion?: number,
  ): Promise<Project | null>;
  softDelete(id: string): Promise<boolean>;
  /**
   * Cascade — soft-delete **toàn bộ** project thuộc workspace đã xóa.
   *
   * Gọi bởi consumer của event `WORKSPACE_DELETED` (module `projects` là chủ
   * sở hữu collection `projects`, nên chỉ nó mới được ghi vào đây).
   *
   * Trả về số project thực sự bị đánh dấu xóa (để log + kiểm thử).
   */
  softDeleteByWorkspace(workspaceId: string): Promise<number>;
  /**
   * Lấy danh sách id project **còn sống** thuộc workspace (dùng để cascade
   * xuống dataset — module `datasets` cần biết project nào còn dữ liệu).
   */
  findAliveIdsByWorkspace(workspaceId: string): Promise<string[]>;
  setHasDataset(projectId: string, hasDataset: boolean): Promise<boolean>;
  setStatus(projectId: string, status: ProjectStatus): Promise<boolean>;
  touchLastAccessed(projectId: string): Promise<void>;
  addMember(projectId: string, member: AddProjectMemberRecord): Promise<boolean>;
  removeMember(projectId: string, userId: string): Promise<boolean>;
  updateMemberRole(
    projectId: string,
    userId: string,
    role: ProjectMemberRole,
    expectedVersion?: number,
  ): Promise<boolean | null>;
  transferOwner(
    projectId: string,
    newOwnerId: string,
    expectedVersion?: number,
  ): Promise<boolean | null>;
  markCompleted(projectId: string, expectedVersion: number): Promise<boolean | null>;
}
