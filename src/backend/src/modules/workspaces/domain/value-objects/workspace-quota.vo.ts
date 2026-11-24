/**
 * WORKSPACE — Value object giới hạn số lượng workspace tối đa mỗi người dùng.
 *
 * Bối cảnh (phương án B — chống lạm dụng/spam lời mời):
 *   Nếu không giới hạn, một tài khoản có thể tạo hàng loạt workspace và gửi
 *   lời mời (email) tới hàng loạt địa chỉ → biến hệ thống thành công cụ spam.
 *
 * Quy tắc:
 *   - Giới hạn áp dụng cho **tài khoản thường** (analyst).
 *   - Quản trị viên hệ thống (admin) **không** bị giới hạn (vận hành hệ thống).
 *   - Giới hạn tính trên số workspace **user là chủ sở hữu** (owner), không tính
 *     workspace user chỉ là thành viên.
 */

/** Số workspace tối đa một tài khoản thường được phép sở hữu. */
export const MAX_WORKSPACES_PER_USER = 20;

export function assertWorkspaceQuota(
  currentOwnedCount: number,
  max: number = MAX_WORKSPACES_PER_USER,
): void {
  if (currentOwnedCount >= max) {
    throw new WorkspaceQuotaExceededError(currentOwnedCount, max);
  }
}

/** Lỗi nghiệp vụ: vượt giới hạn số workspace. */
export class WorkspaceQuotaExceededError extends Error {
  readonly currentCount: number;
  readonly max: number;

  constructor(currentCount: number, max: number) {
    super(
      `Bạn đã đạt giới hạn ${max} không gian làm việc (hiện có ${currentCount}). ` +
        'Hãy xoá bớt workspace không dùng hoặc liên hệ quản trị viên.',
    );
    this.name = 'WorkspaceQuotaExceededError';
    this.currentCount = currentCount;
    this.max = max;
  }
}
