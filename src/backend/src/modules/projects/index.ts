/**
 * Public contract của module PROJECTS.
 *
 * Các module khác chỉ được import qua file này (quy tắc CA8 — cross-module
 * import phải đi qua public contract), không import sâu vào
 * `domain/ports/...` hay `application/...`.
 *
 * Gồm 2 nhóm:
 *  1. Repository port (dành cho module đọc dữ liệu thô, ví dụ `overview`).
 *  2. Facade port `PROJECT_ACCESS_PORT` (dành cho module cần thao tác nghiệp vụ
 *     trên project mà không cần biết cấu trúc lưu trữ — L3a/R2).
 */

export {
  PROJECT_REPOSITORY_PORT,
  PROJECT_SORT_OPTIONS,
  PROJECT_MEMBER_SORT_OPTIONS,
  type ProjectListQuery,
  type ProjectListInput,
  type ProjectMembersListInput,
  type ProjectMemberSort,
  type ProjectMemberRole,
  type ProjectMemberRecord,
  type ProjectStatus,
  type ProjectRecord,
  type ProjectRepositoryPort,
  type CreateProjectRecord,
} from './domain/ports/project.repository.port';

export {
  PROJECT_ACCESS_PORT,
  type ProjectAccessRole,
  type ProjectAccessPort,
} from './domain/ports/project.access.port';

export {
  PROJECT_MEMBER_ROLES,
  canAccessProject,
  canModerateProject,
} from './domain/value-objects/project-role.vo';

// ── Handlers (Command/Query) ──────────────────────────
// ── Queries (đọc) ──────────────────────────────────────────────
export { GetProjectByIdHandler } from './application/queries/get-project-by-id.handler';
export { GetProjectsByWorkspaceHandler } from './application/queries/get-projects-by-workspace.handler';
export { GetWorkspaceNameHandler } from './application/queries/get-workspace-name.handler';
export { ListMembersHandler } from './application/queries/list-members.handler';
export { ListProjectsByWorkspaceHandler } from './application/queries/list-projects-by-workspace.handler';
export { ResolveUserProjectRoleHandler } from './application/queries/resolve-user-project-role.handler';

// ── Commands (ghi) ─────────────────────────────────────────────
export { AddProjectMemberHandler } from './application/commands/add-project-member.handler';
export { CreateProjectHandler } from './application/commands/create-project.handler';
export { DeleteProjectHandler } from './application/commands/delete-project.handler';
export { MarkCompletedHandler } from './application/commands/mark-completed.handler';
export { RemoveProjectMemberHandler } from './application/commands/remove-project-member.handler';
export { SetHasDatasetHandler } from './application/commands/set-has-dataset.handler';
export { TransferProjectOwnerHandler } from './application/commands/transfer-project-owner.handler';
export { UpdateProjectHandler } from './application/commands/update-project.handler';
export { UpdateProjectMemberRoleHandler } from './application/commands/update-project-member-role.handler';
