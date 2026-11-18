/**
 * WORKSPACE CONTEXT — Port để resolve vai trò workspace của user theo request.
 *
 * Đặt trong `shared/ports/` vì `shared/` là lớp cross-cutting và **không được**
 * biết module nghiệp vụ (quy tắc CA5 — shared không import từ `modules/`).
 * Module `workspaces` hiện thực port này và bind vào `SharedModule`.
 *
 * Bối cảnh:
 *   `CaslAbilityFactory` cần biết user đang ở workspace nào, với vai trò gì,
 *   để cấp quyền theo tầng workspace (WS-OWNER / WS-MEMBER). Trước đây interface
 *   `CurrentUser` khai báo `workspaceId`/`workspaceRole` nhưng **không nơi nào
 *   gán được** → phân quyền theo workspace là code chết và mọi endpoint
 *   Workspace/Project/Dataset đều trả 403 cho user thường.
 *
 * Hợp đồng:
 *   - `resolve(userId)` → tập workspace user tham gia + map vai trò.
 *   - Adapter **phải fail-safe**: lỗi truy vấn → trả về tập rỗng (không ném),
 *     để endpoint không bị chặn oan bởi sự cố hạ tầng.
 */
export const WORKSPACE_CONTEXT_PORT = Symbol('WorkspaceContextPort');

export interface WorkspaceContext {
  /** Tất cả workspace user đang tham gia (owner hoặc member). */
  workspaceIds: string[];
  /** Map `workspaceId -> vai trò` ('owner' | 'member'). */
  roles: Record<string, 'owner' | 'member'>;
  /** Các workspace user là chủ sở hữu. */
  ownedWorkspaceIds: string[];
}

export interface WorkspaceContextPort {
  resolve(userId: string): Promise<WorkspaceContext>;
}
