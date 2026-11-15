/**
 * Public contract của module WORKSPACES.
 *
 * Các module khác chỉ được import qua file này (quy tắc CA8 — cross-module
 * import phải đi qua public contract), không import sâu vào
 * `domain/ports/...` hay `application/...`.
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
  type WorkspaceRecord,
  type WorkspaceRepositoryPort,
  type CreateWorkspaceRecord,
} from './domain/ports/workspace.repository.port';
