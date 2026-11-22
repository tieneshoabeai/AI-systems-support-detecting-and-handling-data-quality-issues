/**
 * ProjectContextAdapter — Hiện thực `PROJECT_CONTEXT_PORT` (shared/application/ports).
 *
 * Suy ra vai trò project của user theo mô hình 3 tầng (Phần 6 v7 §3.1):
 *   1. User có mặt trong `project.members` → lấy đúng vai trò ghi trong DB
 *      ('owner' | 'member' | 'viewer').
 *   2. User KHÔNG có mặt trong `project.members` nhưng là WS-OWNER của
 *      workspace chứa project → 'owner' (quy tắc 3: WS-OWNER giữ toàn quyền
 *      quản trị với mọi project trong workspace, kể cả sau khi đã giao
 *      Project Owner khác).
 *   3. User là WS-MEMBER của workspace chứa project → 'viewer'
 *      (quy tắc 2: WS-MEMBER mặc định là PROJ-VIEWER trong *mọi* project).
 *
 * Fail-safe: lỗi truy vấn → trả context rỗng + log cảnh báo (không ném).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../../workspaces';
import {
  PROJECT_CONTEXT_PORT,
  type ProjectAccessRole,
  type ProjectContext,
  type ProjectContextPort,
} from '../../../../shared/application/ports/project-context.port';

@Injectable()
export class ProjectContextAdapter implements ProjectContextPort {
  private readonly logger = new Logger(ProjectContextAdapter.name);

  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
  ) {}

  async resolve(userId: string): Promise<ProjectContext> {
    try {
      const [projectList, workspaceList] = await Promise.all([
        this.projects.findAllByUser(userId),
        this.workspaces.findByUser(userId),
      ]);

      // Workspace user làm chủ → được PROJ-OWNER trên mọi project của ws đó.
      const ownedWorkspaceIds = new Set(
        workspaceList.filter((w) => w.ownerId === userId).map((w) => w.id),
      );
      // Workspace user là thành viên → PROJ-VIEWER mặc định trong ws đó.
      const memberWorkspaceIds = new Set(
        workspaceList
          .filter((w) => w.ownerId !== userId)
          .map((w) => w.id),
      );

      const roles: Record<string, ProjectAccessRole> = {};
      const workspaceIds: Record<string, string> = {};

      for (const p of projectList) {
        const explicit = (p.members ?? []).find((m) => m.userId === userId);
        let role: ProjectAccessRole;
        if (explicit) {
          role = explicit.role;
        } else if (ownedWorkspaceIds.has(p.workspaceId)) {
          role = 'owner';
        } else if (memberWorkspaceIds.has(p.workspaceId)) {
          role = 'viewer';
        } else {
          // Không có quan hệ nào với workspace → không có quyền.
          continue;
        }
        roles[p.id] = role;
        workspaceIds[p.id] = p.workspaceId;
      }

      return { projectIds: Object.keys(roles), roles, workspaceIds };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Không resolve được project context cho user ${userId}: ${msg}`);
      return { projectIds: [], roles: {}, workspaceIds: {} };
    }
  }
}

/** Token để bind adapter vào `PROJECT_CONTEXT_PORT`. */
export const PROJECT_CONTEXT_ADAPTER = PROJECT_CONTEXT_PORT;
