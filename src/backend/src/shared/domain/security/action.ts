/**
 * `Action` — tập hành động phân quyền (thuần domain).
 *
 * Vì sao ở `shared/domain/security/`?
 *   Enum này là ngữ nghĩa nghiệp vụ ("đọc", "ghi", "thực thi"), không phải
 *   khái niệm của framework. Tầng Application (`@CheckPolicies` handler) và
 *   tầng Interfaces (guard) đều dùng → đặt ở Domain để import được từ cả hai.
 */
export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  Execute = 'execute',
  Export = 'export',
}
