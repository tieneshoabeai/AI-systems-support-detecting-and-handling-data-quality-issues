/**
 * ProjectScopePolicyLoader — Loader "phạm vi" cho các endpoint định tuyến
 * theo `:projectId` nhưng kiểm tra quyền trên subject con (Dataset /
 * DataRecord / Analysis).
 *
 * Vì sao cần loader riêng?
 *   - `ProjectPolicyLoader` trả về **project** → dùng khi `@CheckPolicies`
 *     kiểm tra subject `'Project'` với param `:id`.
 *   - Các endpoint `projects/:projectId/...` lại kiểm tra subject con
 *     (`'Dataset'`, `'Analysis'`…) mà rule CASL của chúng dùng điều kiện
 *     `project_id`. `ProjectRecord` không có trường `projectId` (chính nó là
 *     project) → `buildSubject()` không tạo được `project_id`.
 *
 * Loader này trả về một **đối tượng phạm vi** chứa đúng các trường mà rule
 * CASL cần:
 *   - `project_id`  → khớp với rule tầng project (PROJ-OWNER/MEMBER/VIEWER).
 *   - `workspace_id`→ khớp với rule tầng workspace (WS-OWNER/WS-MEMBER).
 *
 * Nhờ đó instance check chống được IDOR: user có quyền ở project A không
 * thể dùng id của project B.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';

@Injectable()
export class ProjectScopePolicyLoader {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async load(id: string): Promise<unknown> {
    const project = await this.projects.findById(id);
    if (!project) return null;
    return {
      id: project.id,
      project_id: project.id,
      workspace_id: project.workspaceId,
    };
  }
}
