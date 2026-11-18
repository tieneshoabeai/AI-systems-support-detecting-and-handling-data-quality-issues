/**
 * `CurrentUserPayload` — danh tính người dùng đã xác thực (thuần domain).
 *
 * Lý do tồn tại ở `shared/domain/security/`:
 *   Kiểu này được **cả hai nhánh** ngoài cùng cần đến:
 *     - `shared/interfaces/` — decorator `@CurrentUser()` và `RolesGuard` đọc
 *       nó từ `request.user`.
 *     - `modules/auth/infrastructure/` — `JwtStrategy.validate()` **trả về**
 *       chính kiểu này để NestJS gắn vào `request.user`.
 *
 *   Trước đây nó nằm trong `shared/interfaces/decorators/current-user.decorator.ts`
 *   → buộc `infrastructure` (tầng ngoài trong cùng) phải import ngược từ
 *   `interfaces` (tầng giao diện framework) — vi phạm chiều phụ thuộc.
 *   Đây là kiểu dữ liệu thuần, không mang framework → thuộc tầng Domain.
 *
 * Quan hệ với `CurrentUser` (cùng thư mục):
 *   `CurrentUser` = `CurrentUserPayload` **+** ngữ cảnh workspace/project
 *   do `PoliciesGuard` resolve sau khi xác thực. Xem `current-user.ts`.
 *
 * Dependency Rule: `shared/domain` không import framework (CA13) và không
 * import `shared/interfaces` (CA14).
 */
export interface CurrentUserPayload {
  userId: string;
  email: string;
  role: 'admin' | 'analyst';
  sessionId?: string;
}
