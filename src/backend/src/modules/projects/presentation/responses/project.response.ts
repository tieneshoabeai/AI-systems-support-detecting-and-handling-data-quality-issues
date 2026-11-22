import type { Project } from '../../domain/entities/project.entity';
import type { ProjectStatus } from '../../domain/value-objects/project-status.vo';
import type { ProjectMemberRole } from '../../domain/value-objects/project-role.vo';

/**
 * PROJECTS — Mapper entity domain → HTTP response.
 *
 * **Vì sao cần tầng này?**
 * Entity `Project` có state riêng tư + getter, không thể serialize thẳng
 * (`JSON.stringify(entity)` sẽ ra `{}` vì mọi thuộc tính nằm trong `props`
 * riêng tư). Tầng presentation phải **chủ động** ánh xạ từng trường — nhờ vậy
 * hợp đồng HTTP không vỡ khi entity thêm/bớt trường nội bộ.
 *
 * **Hợp đồng giữ nguyên:** các trường trả về giống hệt `ProjectRecord` cũ
 * (Phần 7 §3.2 — camelCase, response thẳng dữ liệu) → không vỡ frontend.
 */

/** Thành viên project trong response (khớp `ProjectMemberRecord` cũ). */
export interface ProjectMemberResponse {
  userId: string;
  role: ProjectMemberRole;
  joinedAt: Date;
}

/** DTO trả về cho client — shape giống hệt `ProjectRecord` cũ. */
export interface ProjectResponse {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  hasDataset: boolean;
  status: ProjectStatus;
  members: ProjectMemberResponse[];
  lastAccessedAt: Date | null;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Entity → response DTO. */
export function toProjectResponse(project: Project): ProjectResponse {
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    description: project.description,
    hasDataset: project.hasDataset,
    status: project.status,
    members: project.members.map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
    lastAccessedAt: project.lastAccessedAt,
    version: project.version,
    createdBy: project.createdBy,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

/** Danh sách entity → danh sách response DTO. */
export function toProjectResponses(projects: Project[]): ProjectResponse[] {
  return projects.map(toProjectResponse);
}
