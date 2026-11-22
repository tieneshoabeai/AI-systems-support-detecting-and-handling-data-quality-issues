/**
 * WORKSPACES — Facade port (driving port) cho module khác.
 *
 * Vì sao cần (L3a — quy tắc R2):
 * Module khác KHÔNG được import trực tiếp `WorkspacesService`. Thay vào đó,
 * module `workspaces` **sở hữu** hợp đồng này, export qua
 * `modules/workspaces/index.ts` (public contract — L4/R6) và bind token tới
 * `WorkspacesService` trong `WorkspacesModule`.
 *
 * Chỉ những thao tác thực sự cần từ bên ngoài mới được mở ở đây.
 */
export const WORKSPACE_ACCESS_PORT = Symbol('WorkspaceAccessPort');

export type WorkspaceAccessRole = 'owner' | 'member';

export interface WorkspaceAccessPort {
  /** Vai trò của user trong workspace (`owner` | `member` | null nếu không phải thành viên). */
  resolveUserWorkspaceRole(workspaceId: string, userId: string): Promise<WorkspaceAccessRole | null>;
  /** Cộng/trừ dung lượng đã dùng (datasets module gọi sau khi upload/xóa file). */
  incrementStorageUsed(workspaceId: string, deltaBytes: number): Promise<void>;
  /** Kiểm tra quota upload — ném lỗi 429 nếu vượt. */
  checkWorkspaceUploadQuota(
    workspaceId: string,
    incomingBytes: number,
    quotaBytes: number,
  ): Promise<void>;
}
