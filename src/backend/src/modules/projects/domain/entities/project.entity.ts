/**
 * PROJECT — Aggregate root.
 *
 * **Vì sao cần entity thay vì `ProjectRecord` (interface trần)?**
 * Trước Bước 3, các invariant của project nằm rải rác trong handler:
 *   - `remove-project-member.handler.ts`: không xoá được Project Owner.
 *   - `update-project-member-role.handler.ts`: không đổi vai trò Owner tại đây.
 *   - `transfer-project-owner.handler.ts`: chỉ Owner được nhượng, mục tiêu phải là thành viên.
 *   - `mark-completed.handler.ts`: chỉ `in_progress` mới lưu hoàn tất.
 *   - `set-has-dataset.handler.ts`: `status` suy ra từ `hasDataset`.
 *
 * Entity gom hết vào **một chỗ**, tự bảo vệ (Phần 5 §3.3).
 *
 * **Quy tắc bất di bất dịch:**
 *   1. State riêng tư + getter công khai — không có setter tự do.
 *   2. `static create()` (tạo mới) và `static reconstitute()` (dựng lại từ DB).
 *   3. Invariant kiểm tra trong entity, ném `DomainError` — **không** ném
 *      `HttpException` (Bước 2) và **không** ném `Error` trần.
 */
import {
  BaseEntity,
  type BaseEntityProps,
} from '../../../../shared/domain/entities';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors';
import {
  canAccessProject,
  canModerateProject,
  type ProjectMemberRole,
} from '../value-objects/project-role.vo';
import type { ProjectStatus } from '../value-objects/project-status.vo';
import { PROJECT_EVENTS } from '../events/project-events';

/** Thành viên project — thuộc về aggregate. */
export interface ProjectMember {
  userId: string;
  role: ProjectMemberRole;
  joinedAt: Date;
}

/** Props đầy đủ của aggregate project. */
export interface ProjectProps extends BaseEntityProps {
  workspaceId: string;
  name: string;
  description: string;
  hasDataset: boolean;
  status: ProjectStatus;
  members: ProjectMember[];
  lastAccessedAt: Date | null;
  createdBy: string;
}

/**
 * Aggregate root `Project`.
 *
 * Đặc tính:
 *   - **Đúng 1 Owner** — luôn có đúng một thành viên role `owner`.
 *   - **`status` suy ra từ `hasDataset`** — `not_started` ↔ `in_progress`,
 *     `completed` là trạng thái chốt (PROJ-12).
 *   - **Phát domain event** — `project.created`, `project.member_added`.
 */
export class Project extends BaseEntity<ProjectProps> {
  private constructor(props: ProjectProps) {
    super(props);
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get workspaceId(): string {
    return this.props.workspaceId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string {
    return this.props.description;
  }

  get hasDataset(): boolean {
    return this.props.hasDataset;
  }

  get status(): ProjectStatus {
    return this.props.status;
  }

  get members(): ReadonlyArray<ProjectMember> {
    return this.props.members;
  }

  get lastAccessedAt(): Date | null {
    return this.props.lastAccessedAt;
  }

  get createdBy(): string {
    return this.props.createdBy;
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  /**
   * Tạo project mới — `ownerId` là Project Owner (mặc định = người tạo).
   *
   * Phát domain event `project.created`.
   */
  static create(props: {
    id: string;
    workspaceId: string;
    name: string;
    description?: string;
    createdBy: string;
    ownerId?: string;
    now?: Date;
  }): Project {
    const now = props.now ?? new Date();
    const ownerId = props.ownerId ?? props.createdBy;
    const project = new Project({
      id: props.id,
      workspaceId: props.workspaceId,
      name: props.name,
      description: props.description ?? '',
      hasDataset: false,
      status: 'not_started',
      members: [{ userId: ownerId, role: 'owner', joinedAt: now }],
      lastAccessedAt: now,
      createdBy: props.createdBy,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
    });
    project.addDomainEvent({
      eventType: PROJECT_EVENTS.CREATED,
      aggregateId: props.id,
      payload: { name: props.name, workspaceId: props.workspaceId, ownerId },
      occurredAt: now,
    });
    return project;
  }

  /**
   * Dựng lại project từ dữ liệu đã lưu — **không** phát event.
   */
  static reconstitute(props: ProjectProps): Project {
    return new Project({
      ...props,
      members: props.members.map((m) => ({ ...m })),
    });
  }

  // ── Truy vấn ─────────────────────────────────────────────────────────────

  /** Thành viên có role `owner` — luôn tồn tại (invariant). */
  get owner(): ProjectMember | undefined {
    return this.props.members.find((m) => m.role === 'owner');
  }

  /** Vai trò của user trong project — `null` nếu không phải thành viên. */
  roleOf(userId: string): ProjectMemberRole | null {
    return this.props.members.find((m) => m.userId === userId)?.role ?? null;
  }

  isMember(userId: string): boolean {
    return this.props.members.some((m) => m.userId === userId);
  }

  // ── Hành vi ──────────────────────────────────────────────────────────────

  /**
   * Đổi tên / mô tả project.
   *
   * Invariant: tên rỗng hoặc quá dài → `ValidationError`.
   */
  rename(name?: string, description?: string): void {
    if (name !== undefined) {
      const trimmed = name.trim();
      if (trimmed.length === 0) {
        throw new ValidationError('Tên dự án không được để trống');
      }
      if (trimmed.length > 100) {
        throw new ValidationError('Tên dự án không được vượt quá 100 ký tự');
      }
      this.props.name = trimmed;
    }
    if (description !== undefined) {
      if (description.length > 500) {
        throw new ValidationError('Mô tả dự án không được vượt quá 500 ký tự');
      }
      this.props.description = description;
    }
    this.props.updatedAt = new Date();
  }

  /**
   * Đánh dấu project có/không có dataset — `status` tự suy ra theo quy tắc
   * "dữ liệu bất biến" (Phần 2 v11 §3.36.1).
   *
   * Quy tắc suy ra trạng thái:
   *   - Có dataset + chưa `completed` → `in_progress`.
   *   - Không có dataset → `not_started` (kể cả từ `completed` — đặc tả §3.36.1
   *     quy tắc 2: "Xoá dataset → trở về `not_started`").
   *   - Giữ nguyên `completed` khi vẫn còn dataset (kết quả phân tích đã lưu
   *     vẫn còn hiệu lực).
   */
  setHasDataset(hasDataset: boolean): void {
    this.props.hasDataset = hasDataset;
    if (hasDataset) {
      if (this.props.status === 'not_started') this.props.status = 'in_progress';
    } else if (this.props.status !== 'not_started') {
      this.props.status = 'not_started';
    }
    this.props.updatedAt = new Date();
  }

  /**
   * Đặt trạng thái `completed` (PROJ-12).
   *
   * Invariant: chỉ project `in_progress` mới được hoàn tất → `ValidationError`.
   */
  markCompleted(): void {
    if (this.props.status !== 'in_progress') {
      throw new ValidationError(
        'Chỉ project in_progress mới được lưu hoàn tất (completed)',
      );
    }
    this.props.status = 'completed';
    this.props.updatedAt = new Date();
  }

  /**
   * Thêm thành viên.
   *
   * Invariant:
   *   - Đã là thành viên → `ConflictError`.
   *   - Thêm Owner mới → phải qua `transferOwnershipTo()`.
   *
   * Phát domain event `project.member_added`.
   */
  addMember(userId: string, role: Exclude<ProjectMemberRole, 'owner'> = 'viewer'): void {
    if (this.isMember(userId)) {
      throw new ConflictError('Người dùng đã là thành viên project');
    }
    const now = new Date();
    this.props.members.push({ userId, role, joinedAt: now });
    this.props.updatedAt = now;
    this.addDomainEvent({
      eventType: PROJECT_EVENTS.MEMBER_ADDED,
      aggregateId: this.props.id,
      payload: { userId, role },
      occurredAt: now,
    });
  }

  /**
   * Xoá thành viên.
   *
   * Invariant:
   *   - Không xoá được Project Owner → `ValidationError`.
   *   - User không phải thành viên → `NotFoundError`.
   */
  removeMember(userId: string): void {
    const member = this.props.members.find((m) => m.userId === userId);
    if (!member) throw new NotFoundError('Người dùng không thuộc project này');
    if (member.role === 'owner') {
      throw new ValidationError(
        'Không thể xóa Project Owner — hãy nhượng quyền trước (PROJ-11)',
      );
    }
    this.props.members = this.props.members.filter((m) => m.userId !== userId);
    this.props.updatedAt = new Date();
  }

  /**
   * Đổi vai trò thành viên.
   *
   * Invariant: không đổi vai trò Owner tại đây → `ValidationError`.
   */
  changeMemberRole(userId: string, role: Exclude<ProjectMemberRole, 'owner'>): void {
    const member = this.props.members.find((m) => m.userId === userId);
    if (!member) throw new NotFoundError('Người dùng không thuộc project này');
    if (member.role === 'owner') {
      throw new ValidationError(
        'Không đổi vai trò Owner tại đây — dùng nhượng quyền (PROJ-11)',
      );
    }
    this.props.members = this.props.members.map((m) =>
      m.userId === userId ? { ...m, role } : m,
    );
    this.props.updatedAt = new Date();
  }

  /**
   * Nhượng quyền Project Owner.
   *
   * Invariant:
   *   - Chỉ Owner hiện tại được nhượng → `ForbiddenError`.
   *   - Không nhượng cho chính mình → `ValidationError`.
   *   - Mục tiêu phải là thành viên → `ValidationError`.
   */
  transferOwnershipTo(actorUserId: string, targetUserId: string): void {
    const owner = this.owner;
    if (!owner || owner.userId !== actorUserId) {
      throw new ForbiddenError('Chỉ Project Owner mới được nhượng quyền');
    }
    if (actorUserId === targetUserId) {
      throw new ValidationError('Không thể nhượng cho chính mình');
    }
    if (!this.isMember(targetUserId)) {
      throw new ValidationError('Chỉ nhượng cho thành viên project');
    }

    const now = new Date();
    this.props.members = this.props.members.map((m) => {
      if (m.userId === actorUserId) return { ...m, role: 'member' as ProjectMemberRole };
      if (m.userId === targetUserId) return { ...m, role: 'owner' as ProjectMemberRole };
      return { ...m };
    });
    this.props.updatedAt = now;
  }

  /**
   * Kiểm tra quyền điều hành project (đổi vai trò, xoá, nhượng quyền…).
   *
   * `workspaceRole` cho phép Workspace Owner điều hành mọi project trong workspace.
   */
  assertCanModerate(projectRole: string | null, workspaceRole: string | null): void {
    if (!canModerateProject(projectRole, workspaceRole)) {
      throw new ForbiddenError('Không có quyền điều hành project');
    }
  }

  /** Kiểm tra quyền truy cập project (đọc). */
  assertCanAccess(projectRole: string | null, workspaceRole: string | null): void {
    if (!canAccessProject(projectRole, workspaceRole)) {
      throw new ForbiddenError('Không có quyền truy cập project');
    }
  }

  /** Đánh dấu đã truy cập (dùng cho sắp xếp `last_accessed`). */
  touchLastAccessed(at: Date = new Date()): void {
    this.props.lastAccessedAt = at;
  }

  /** Bản chụp props — dùng cho mapper chuyển entity → persistence. */
  toProps(): ProjectProps {
    return {
      id: this.props.id,
      workspaceId: this.props.workspaceId,
      name: this.props.name,
      description: this.props.description,
      hasDataset: this.props.hasDataset,
      status: this.props.status,
      members: this.props.members.map((m) => ({ ...m })),
      lastAccessedAt: this.props.lastAccessedAt,
      createdBy: this.props.createdBy,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      deletedAt: this.props.deletedAt ?? null,
      version: this.props.version,
    };
  }
}
