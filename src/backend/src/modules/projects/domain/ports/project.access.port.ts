/**
 * PROJECTS — Facade port (driving port) cho module khác.
 *
 * Vì sao cần (L3a — quy tắc R2):
 * Module khác KHÔNG được import trực tiếp `ProjectsService` (application của
 * module khác) — đó là phụ thuộc trực tiếp giữa các bounded context, khiến
 * module không thể thay thế/test độc lập.
 *
 * Thay vào đó, module `projects` **sở hữu** hợp đồng này, export qua
 * `modules/projects/index.ts` (public contract — L4/R6), và bind token tới
 * `ProjectsService` trong `ProjectsModule`.
 *
 * Chỉ những thao tác thực sự cần từ bên ngoài mới được mở ở đây — không
 * expose cả repository, không expose CRUD nội bộ.
 */
import type { ProjectRecord } from './project.repository.port';

export const PROJECT_ACCESS_PORT = Symbol('ProjectAccessPort');

export type ProjectAccessRole = 'owner' | 'member' | 'viewer';

export interface ProjectAccessPort {
  /** Đọc một project theo id (không tự động "touch" last-accessed). */
  getProjectById(id: string): Promise<ProjectRecord>;
  /**
   * Vai trò của user trong project.
   * @param workspaceRole vai trò user trong workspace chứa project (nếu biết) — dùng
   *                     để suy luận `viewer` khi user chỉ là thành viên workspace.
   */
  resolveUserProjectRole(
    projectId: string,
    userId: string,
    workspaceRole?: 'owner' | 'member' | null,
  ): Promise<ProjectAccessRole | null>;
  /** Cập nhật cờ "project đã có dataset" (datasets module gọi khi ingest/xóa). */
  setHasDataset(projectId: string, hasDataset: boolean): Promise<boolean>;
}
