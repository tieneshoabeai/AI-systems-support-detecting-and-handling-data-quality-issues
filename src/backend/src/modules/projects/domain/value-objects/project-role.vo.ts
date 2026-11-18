/**
 * Value object — vai trò & quyền trong project.
 *
 * **Nguồn sự thật cho quyền project:**
 *   - Ma trận quyền Phần 6 v7 §3.5.
 *   - Đặc tả Phần 2 v11: `WS-07` (thành viên workspace mặc định là
 *     `PROJ-VIEWER` trong mọi project của workspace), `PROJ-03`
 *     (xem project — "có quyền xem"), `PROJ-04`/`PROJ-05`/`PROJ-10`/`PROJ-11`.
 *   - CASL ability factory (`casl-ability.factory.ts`) mục 3c/4c: `WS-MEMBER`
 *     và `PROJ-VIEWER` đều được `Action.Read` trên `Project`.
 *
 * **Vì sao VO này quan trọng:** ma trận quyền được viết lại ở nhiều nơi
 * (guard CASL, handler, query). VO là bản "trung tâm" để entity tự bảo vệ —
 * handler gọi `project.assertCanModerate()` / `project.assertCanAccess()`,
 * không tự viết lại điều kiện.
 */

/** Vai trò thành viên project. */
export const PROJECT_MEMBER_ROLES = ['owner', 'member', 'viewer'] as const;

export type ProjectMemberRole = (typeof PROJECT_MEMBER_ROLES)[number];

/**
 * Quyền **điều hành** project (đổi vai trò thành viên, nhượng quyền Owner,
 * cập nhật thông tin project — PROJ-04/PROJ-10/PROJ-11).
 *
 * Chỉ `PROJ-OWNER` và `WS-OWNER` (Workspace Owner có toàn quyền quản trị với
 * mọi project trong workspace — WS-09).
 *
 * `PROJ-MEMBER` và `PROJ-VIEWER` **không** được điều hành.
 */
export function canModerateProject(
  projectRole: string | null,
  workspaceRole: string | null,
): boolean {
  return projectRole === 'owner' || workspaceRole === 'owner';
}

/**
 * Quyền **đọc** nội dung project (PROJ-03 — "có quyền xem").
 *
 * Được đọc khi:
 *   - `PROJ-OWNER` / `PROJ-MEMBER` / `PROJ-VIEWER` — thành viên project.
 *   - `WS-OWNER` — toàn quyền với mọi project trong workspace.
 *   - `WS-MEMBER` — theo đặc tả `WS-07`, thành viên workspace **mặc định là
 *     `PROJ-VIEWER`** trong mọi project của workspace, nên có quyền đọc.
 *     Khớp với CASL mục 3c (`can(Action.Read, 'Project', { workspace_id: ... })`).
 *
 * Không có quan hệ nào → `false` (entity ném `ForbiddenError`).
 */
export function canAccessProject(
  projectRole: string | null,
  workspaceRole: string | null,
): boolean {
  if (workspaceRole === 'owner' || workspaceRole === 'member') return true;
  return (
    projectRole === 'owner' || projectRole === 'member' || projectRole === 'viewer'
  );
}
