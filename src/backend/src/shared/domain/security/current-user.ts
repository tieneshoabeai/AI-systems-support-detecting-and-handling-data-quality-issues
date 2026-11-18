/**
 * `CurrentUser` — ngữ cảnh người dùng đang xác thực (thuần domain).
 *
 * Lý do tồn tại ở `shared/domain/security/`:
 *   Tầng Application của module (ví dụ `workspaces`) cần biết user hiện tại
 *   để áp dụng quyền — nhưng **không được** phụ thuộc vào `shared/interfaces/casl`
 *   (nơi chứa `CaslAbilityFactory` gắn framework NestJS). Đây là hợp đồng
 *   ngữ cảnh thuần TypeScript → thuộc tầng Domain.
 *
 * Dependency Rule: `shared/domain` không import framework (CA13) và không
 * import `shared/interfaces` (CA14).
 */
import type { CurrentUserPayload } from './current-user-payload';

/**
 * `CurrentUser` = `CurrentUserPayload` (đã xác thực) **+** ngữ cảnh
 * workspace/project do `PoliciesGuard` resolve sau khi xác thực.
 *
 * Kế thừa `CurrentUserPayload` để hai kiểu không trôi lệch nhau: mọi trường
 * đã xác thực đều nằm trong payload.
 */
export interface CurrentUser extends CurrentUserPayload {
  /**
   * Danh sách workspace user đang tham gia (đã resolve từ DB theo request).
   *
   * QUAN TRỌNG — lịch sử:
   *   Trước đây interface này chỉ có `workspaceId`/`workspaceRole` (một workspace
   * duy nhất) nhưng **không nơi nào gán được** → nhánh phân quyền theo
   * workspace là code chết và mọi endpoint Workspace/Project/Dataset đều trả
   * 403 cho user thường. Nay dùng tập workspace + map vai trò để phản ánh
   * đúng thực tế: một user có thể ở nhiều workspace với vai trò khác nhau.
   */
  workspaceIds?: string[];
  /** Map `workspaceId -> vai trò` ('owner' | 'member'). */
  workspaceRoles?: Record<string, 'owner' | 'member'>;
  /** Các workspace user là chủ sở hữu. */
  ownedWorkspaceIds?: string[];
  /**
   * Map `projectId -> vai trò` ('owner' | 'member' | 'viewer').
   * Dùng để phân quyền tầng project (PROJ-OWNER / PROJ-MEMBER / PROJ-VIEWER).
   */
  projectRoles?: Record<string, 'owner' | 'member' | 'viewer'>;
}
