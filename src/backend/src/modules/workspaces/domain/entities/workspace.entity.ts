/**
 * WORKSPACE — Aggregate root.
 *
 * **Vì sao cần entity thay vì `WorkspaceRecord` (interface trần)?**
 * Trước Bước 3, mọi invariant của workspace nằm rải rác trong handler:
 *   - `leave-workspace.handler.ts`: kiểm tra Owner phải nhượng quyền trước.
 *   - `remove-member.handler.ts`: không xoá được Owner.
 *   - `transfer-owner.handler.ts`: nhượng quyền phải là thành viên, không tự nhượng.
 *
 * Rủi ro: thêm use-case mới → dễ quên một trong các quy tắc trên.
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
  isWorkspaceMember,
  isWorkspaceOwner,
  type WorkspaceRole,
} from '../value-objects/workspace-role.vo';
import { WORKSPACE_EVENTS } from '../events/workspace-events';

/** Thành viên workspace — thuộc về aggregate (nhúng trong document). */
export interface WorkspaceMember {
  userId: string;
  role: WorkspaceRole;
  joinedAt: Date;
}

/** Props đầy đủ của aggregate workspace. */
export interface WorkspaceProps extends BaseEntityProps {
  name: string;
  description: string;
  ownerId: string;
  members: WorkspaceMember[];
  storageUsedBytes: number;
  lastAccessedAt: Date | null;
}

/**
 * Aggregate root `Workspace`.
 *
 * Đặc tính:
 *   - **Đúng 1 Owner** — `ownerId` luôn là thành viên có role `owner`.
 *   - **Chuyển quyền là hành vi của entity** — `transferOwnershipTo()` kiểm tra
 *     đầy đủ rồi mới cập nhật state, không phân tán ở handler.
 *   - **Phát domain event** — `workspace.created`, `workspace.member_added`,
 *     `workspace.member_removed`, `workspace.owner_transferred`.
 */
export class Workspace extends BaseEntity<WorkspaceProps> {
  private constructor(props: WorkspaceProps) {
    super(props);
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get name(): string {
    return this.props.name;
  }

  get description(): string {
    return this.props.description;
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get members(): ReadonlyArray<WorkspaceMember> {
    return this.props.members;
  }

  get storageUsedBytes(): number {
    return this.props.storageUsedBytes;
  }

  get lastAccessedAt(): Date | null {
    return this.props.lastAccessedAt;
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  /**
   * Tạo workspace mới — người tạo là Owner.
   *
   * Phát domain event `workspace.created`.
   */
  static create(props: {
    id: string;
    name: string;
    description?: string;
    ownerId: string;
    now?: Date;
  }): Workspace {
    const now = props.now ?? new Date();
    const workspace = new Workspace({
      id: props.id,
      name: props.name,
      description: props.description ?? '',
      ownerId: props.ownerId,
      members: [{ userId: props.ownerId, role: 'owner', joinedAt: now }],
      storageUsedBytes: 0,
      lastAccessedAt: now,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
    });
    workspace.addDomainEvent({
      eventType: WORKSPACE_EVENTS.CREATED,
      aggregateId: props.id,
      payload: { name: props.name, ownerId: props.ownerId },
      occurredAt: now,
    });
    return workspace;
  }

  /**
   * Dựng lại workspace từ dữ liệu đã lưu — **không** phát event.
   *
   * Đây là điểm khác biệt quan trọng so với `create()`: đọc từ DB không phải
   * là một sự kiện nghiệp vụ mới (Phần 5 §3.3).
   */
  static reconstitute(props: WorkspaceProps): Workspace {
    return new Workspace({
      ...props,
      members: props.members.map((m) => ({ ...m })),
    });
  }

  // ── Truy vấn ─────────────────────────────────────────────────────────────

  /** `true` nếu user là Owner của workspace. */
  isOwner(userId: string): boolean {
    return isWorkspaceOwner(this.props.ownerId, userId);
  }

  /** `true` nếu user là thành viên (bao gồm Owner). */
  isMember(userId: string): boolean {
    return isWorkspaceMember(
      this.props.members.map((m) => m.userId),
      userId,
    );
  }

  /** Vai trò của user trong workspace — `null` nếu không phải thành viên. */
  roleOf(userId: string): WorkspaceRole | null {
    if (this.props.ownerId === userId) return 'owner';
    const hit = this.props.members.find((m) => m.userId === userId);
    if (!hit) return null;
    return hit.role === 'owner' ? 'owner' : 'member';
  }

  // ── Hành vi ──────────────────────────────────────────────────────────────

  /**
   * Đổi tên / mô tả workspace.
   *
   * Tên rỗng hoặc quá dài → `ValidationError` (invariant nghiệp vụ).
   */
  rename(name?: string, description?: string): void {
    if (name !== undefined) {
      const trimmed = name.trim();
      if (trimmed.length === 0) {
        throw new ValidationError('Tên không gian làm việc không được để trống');
      }
      if (trimmed.length > 100) {
        throw new ValidationError('Tên không gian làm việc không được vượt quá 100 ký tự');
      }
      this.props.name = trimmed;
    }
    if (description !== undefined) {
      if (description.length > 500) {
        throw new ValidationError('Mô tả không gian làm việc không được vượt quá 500 ký tự');
      }
      this.props.description = description;
    }
    this.props.updatedAt = new Date();
  }

  /**
   * Thêm thành viên.
   *
   * Invariant:
   *   - Thành viên đã có trong workspace → `ConflictError`.
   *   - Thêm Owner mới → phải qua `transferOwnershipTo()` (đổi `ownerId`).
   *
   * Phát domain event `workspace.member_added`.
   */
  addMember(userId: string, role: Exclude<WorkspaceRole, 'owner'> = 'member'): void {
    if (this.props.ownerId === userId) {
      throw new ConflictError('Người dùng này đã là thành viên của không gian làm việc');
    }
    if (this.isMember(userId)) {
      throw new ConflictError('Người dùng này đã là thành viên của không gian làm việc');
    }
    const now = new Date();
    this.props.members.push({ userId, role, joinedAt: now });
    this.props.updatedAt = now;
    this.addDomainEvent({
      eventType: WORKSPACE_EVENTS.MEMBER_ADDED,
      aggregateId: this.props.id,
      payload: { userId, role },
      occurredAt: now,
    });
  }

  /**
   * Xoá thành viên.
   *
   * Invariant:
   *   - Không xoá được Owner → `ValidationError`.
   *   - User không phải thành viên → `NotFoundError`.
   *
   * Phát domain event `workspace.member_removed`.
   */
  removeMember(userId: string): void {
    if (this.props.ownerId === userId) {
      throw new ValidationError('Không thể xóa chủ sở hữu chính của không gian làm việc');
    }
    if (!this.isMember(userId)) {
      throw new NotFoundError('Người dùng không thuộc danh sách thành viên của không gian này');
    }
    this.props.members = this.props.members.filter((m) => m.userId !== userId);
    this.props.updatedAt = new Date();
    this.addDomainEvent({
      eventType: WORKSPACE_EVENTS.MEMBER_REMOVED,
      aggregateId: this.props.id,
      payload: { userId },
      occurredAt: new Date(),
    });
  }

  /**
   * Rời workspace.
   *
   * Invariant: Owner phải nhượng quyền trước → `ValidationError`.
   */
  leave(userId: string): void {
    if (this.props.ownerId === userId) {
      throw new ValidationError('Workspace Owner phải nhượng quyền trước khi rời (WS-09)');
    }
    if (!this.isMember(userId)) {
      throw new NotFoundError('Bạn không phải thành viên workspace này');
    }
    this.removeMember(userId);
  }

  /**
   * Nhượng quyền Owner cho thành viên khác.
   *
   * Invariant:
   *   - Chỉ Owner hiện tại được nhượng → `ForbiddenError`.
   *   - Không nhượng cho chính mình → `ValidationError`.
   *   - Mục tiêu phải là thành viên → `ValidationError`.
   *
   * Phát domain event `workspace.owner_transferred`.
   */
  transferOwnershipTo(actorUserId: string, targetUserId: string): void {
    if (!this.isOwner(actorUserId)) {
      throw new ForbiddenError('Chỉ Workspace Owner mới được nhượng quyền');
    }
    if (actorUserId === targetUserId) {
      throw new ValidationError('Không thể nhượng quyền cho chính mình');
    }
    if (!this.isMember(targetUserId)) {
      throw new ValidationError('Chỉ nhượng quyền cho thành viên workspace');
    }

    const previousOwnerId = this.props.ownerId;
    const now = new Date();

    // Hạ vai trò Owner cũ xuống `member` (nếu họ vẫn là thành viên).
    this.props.members = this.props.members.map((m) =>
      m.userId === previousOwnerId ? { ...m, role: 'member' as WorkspaceRole } : { ...m },
    );

    // Nâng vai trò Owner mới.
    this.props.members = this.props.members.map((m) =>
      m.userId === targetUserId ? { ...m, role: 'owner' as WorkspaceRole } : m,
    );

    this.props.ownerId = targetUserId;
    this.props.updatedAt = now;
    this.addDomainEvent({
      eventType: WORKSPACE_EVENTS.OWNER_TRANSFERRED,
      aggregateId: this.props.id,
      payload: { previousOwnerId, newOwnerId: targetUserId },
      occurredAt: now,
    });
  }

  /**
   * Cộng/trừ dung lượng đã dùng.
   *
   * Invariant: dung lượng không được âm → `ValidationError`.
   */
  adjustStorageUsed(deltaBytes: number): void {
    const next = this.props.storageUsedBytes + deltaBytes;
    if (next < 0) {
      throw new ValidationError('Dung lượng đã dùng không thể âm');
    }
    this.props.storageUsedBytes = next;
    this.props.updatedAt = new Date();
  }

  /** Đánh dấu đã truy cập (dùng cho sắp xếp `last_accessed`). */
  touchLastAccessed(at: Date = new Date()): void {
    this.props.lastAccessedAt = at;
  }

  /** Bản chụp props — dùng cho mapper chuyển entity → persistence. */
  toProps(): WorkspaceProps {
    return {
      id: this.props.id,
      name: this.props.name,
      description: this.props.description,
      ownerId: this.props.ownerId,
      members: this.props.members.map((m) => ({ ...m })),
      storageUsedBytes: this.props.storageUsedBytes,
      lastAccessedAt: this.props.lastAccessedAt,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      deletedAt: this.props.deletedAt ?? null,
      version: this.props.version,
    };
  }
}
