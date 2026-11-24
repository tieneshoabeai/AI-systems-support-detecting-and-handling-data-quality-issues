/**
 * `SubjectName` — tập tên thực thể mà hệ thống phân quyền được (thuần domain).
 *
 * Vì sao ở `shared/domain/security/`?
 *   `@PolicyResource(...)` (decorator, tầng Interfaces) và policy loader
 *   (tầng Application) đều cần biết tên subject → hợp đồng phải nằm ở
 *   tầng Domain để cả hai cùng import được mà không vi phạm chiều phụ thuộc.
 *
 * Dependency Rule: `shared/domain` không import framework (CA13) và không
 * import `shared/interfaces` (CA14).
 */
export type SubjectName =
  | 'all'
  | 'Workspace'
  | 'Project'
  | 'Dataset'
  | 'DataRecord'
  | 'Analysis'
  | 'User'
  | 'Session'
  | 'Notification'
  | 'IssueReport'
  | 'FindingFeedback';

export type AppSubjects = SubjectName | Record<string, unknown>;
