/**
 * Public contract của module PROJECTS.
 *
 * Các module khác chỉ được import qua file này (quy tắc CA8 — cross-module
 * import phải đi qua public contract), không import sâu vào
 * `domain/ports/...` hay `application/...`.
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
