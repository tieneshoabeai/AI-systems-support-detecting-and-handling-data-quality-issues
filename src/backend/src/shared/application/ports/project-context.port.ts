/**
 * PROJECT CONTEXT — Port để resolve vai trò project của user theo request.
 *
 * Đặt trong `shared/ports/` vì `shared/` là lớp cross-cutting và **không được**
 * biết module nghiệp vụ (quy tắc CA5). Module `projects` hiện thực port này.
 *
 * Bối cảnh:
 *   Mô hình quyền có 3 tầng (Phần 6 v7 §3.1):
 *     - WS-OWNER  → toàn quyền trên mọi project của workspace
 *     - PROJ-OWNER / PROJ-MEMBER → quyền ghi trong project
 *     - PROJ-VIEWER / WS-MEMBER → chỉ đọc
 *   `CaslAbilityFactory` cần biết user đang ở project nào, vai trò gì để cấp
 *   quyền. Trước đây `CurrentUser` không mang thông tin này → phân quyền theo
 *   workspace/project là code chết.
 *
 * Quy tắc suy ra vai trò project (theo đặc tả):
 *   1. User là WS-OWNER của workspace → PROJ-OWNER trên mọi project của ws đó.
 *   2. User có mặt trong `project.members` → lấy đúng vai trò ghi trong DB.
 *   3. User là WS-MEMBER (không có mặt trong `project.members`) → PROJ-VIEWER
 *      (quy tắc 2 của Phần 6 v7 §3.1: WS-MEMBER mặc định là PROJ-VIEWER trong
 *      *mọi* project của workspace).
 */
export const PROJECT_CONTEXT_PORT = Symbol('ProjectContextPort');

export type ProjectAccessRole = 'owner' | 'member' | 'viewer';

export interface ProjectContext {
  /** Tất cả project user có quyền truy cập (bằng bất kỳ vai trò nào). */
  projectIds: string[];
  /** Map `projectId -> vai trò` ('owner' | 'member' | 'viewer'). */
  roles: Record<string, ProjectAccessRole>;
  /** Map `projectId -> workspaceId` chứa project đó. */
  workspaceIds: Record<string, string>;
}

export interface ProjectContextPort {
  resolve(userId: string): Promise<ProjectContext>;
}
