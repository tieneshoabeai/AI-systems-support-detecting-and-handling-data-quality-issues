/**
 * Public contract của module WORKSPACES.
 *
 * Các module khác chỉ được import qua file này (quy tắc CA8 — cross-module
 * import phải đi qua public contract), không import sâu vào
 * `domain/ports/...` hay `application/...`.
 *
 * Gồm 2 nhóm:
 *  1. Repository port (dành cho module đọc dữ liệu thô, ví dụ `overview`).
 *  2. Facade port `WORKSPACE_ACCESS_PORT` (thao tác nghiệp vụ trên workspace
 *     mà không cần biết cấu trúc lưu trữ — L3a/R2).
 */

export {
  WORKSPACE_REPOSITORY_PORT,
  WORKSPACE_SORT_OPTIONS,
  WORKSPACE_MEMBER_SORT_OPTIONS,
  type WorkspaceListQuery,
  type WorkspaceListInput,
  type WorkspaceMembersListInput,
  type WorkspaceMemberSort,
  type WorkspaceMemberRecord,
  type WorkspaceMemberView,
  type WorkspaceRepositoryPort,
  type CreateWorkspaceRecord,
} from './domain/ports/workspace.repository.port';

// ── Entity domain (Rich Domain Model — Bước 3) ─────────────────────────────
export { Workspace, type WorkspaceProps, type WorkspaceMember } from './domain/entities/workspace.entity';

export {
  WORKSPACE_ACCESS_PORT,
  type WorkspaceAccessRole,
  type WorkspaceAccessPort,
} from './domain/ports/workspace.access.port';

export {
  WORKSPACE_ROLES,
  isWorkspaceMember,
  isWorkspaceOwner,
  resolveWorkspaceRole,
  type WorkspaceRole,
} from './domain/value-objects/workspace-role.vo';

// ── Policy loader (dùng cho `@PolicyResource` — tầng động chống IDOR) ─────
export { WorkspacePolicyLoader } from './application/policy-loaders/workspace-policy.loader';

// ── Handlers (Command/Query) ──────────────────────────
// ── Queries (đọc) ──────────────────────────────────────────────
export { CheckWorkspaceUploadQuotaHandler } from './application/queries/check-workspace-upload-quota.handler';
export { GetWorkspaceByIdHandler } from './application/queries/get-workspace-by-id.handler';
export { GetWorkspacesHandler } from './application/queries/get-workspaces.handler';
export { ListMembersHandler } from './application/queries/list-members.handler';
export { ListWorkspacesHandler } from './application/queries/list-workspaces.handler';
export { ResolveUserWorkspaceRoleHandler } from './application/queries/resolve-user-workspace-role.handler';

// ── Commands (ghi) ─────────────────────────────────────────────
export { AddMemberHandler } from './application/commands/add-member.handler';
export { CreateWorkspaceHandler } from './application/commands/create-workspace.handler';
export { DeleteWorkspaceHandler } from './application/commands/delete-workspace.handler';
export { IncrementStorageUsedHandler } from './application/commands/increment-storage-used.handler';
export { LeaveWorkspaceHandler } from './application/commands/leave-workspace.handler';
export { RemoveMemberHandler } from './application/commands/remove-member.handler';
export { TransferOwnerHandler } from './application/commands/transfer-owner.handler';
export { UpdateWorkspaceHandler } from './application/commands/update-workspace.handler';
