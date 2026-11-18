/**
 * WorkspaceContextAdapter — Hiện thực `WORKSPACE_CONTEXT_PORT` (shared/application/ports).
 *
 * Đọc danh sách workspace user tham gia từ `WORKSPACE_REPOSITORY_PORT` rồi
 * suy ra vai trò ('owner' | 'member') cho từng workspace.
 *
 * Fail-safe: lỗi truy vấn → trả context rỗng + log cảnh báo (không ném), để
 * một sự cố hạ tầng tạm thời không chặn oan toàn bộ request của user.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import {
  WORKSPACE_CONTEXT_PORT,
  type WorkspaceContext,
  type WorkspaceContextPort,
} from '../../../../shared/application/ports/workspace-context.port';

@Injectable()
export class WorkspaceContextAdapter implements WorkspaceContextPort {
  private readonly logger = new Logger(WorkspaceContextAdapter.name);

  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
  ) {}

  async resolve(userId: string): Promise<WorkspaceContext> {
    try {
      const list = await this.workspaces.findByUser(userId);
      const roles: Record<string, 'owner' | 'member'> = {};
      const ownedWorkspaceIds: string[] = [];

      for (const ws of list) {
        if (ws.ownerId === userId) {
          roles[ws.id] = 'owner';
          ownedWorkspaceIds.push(ws.id);
          continue;
        }
        const member = ws.members.find((m) => m.userId === userId);
        if (!member) continue;
        const role = member.role === 'owner' ? 'owner' : 'member';
        roles[ws.id] = role;
        if (role === 'owner') ownedWorkspaceIds.push(ws.id);
      }

      return {
        workspaceIds: Object.keys(roles),
        roles,
        ownedWorkspaceIds,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Không resolve được workspace context cho user ${userId}: ${msg}`);
      return { workspaceIds: [], roles: {}, ownedWorkspaceIds: [] };
    }
  }
}

/** Token để bind adapter vào `WORKSPACE_CONTEXT_PORT`. */
export const WORKSPACE_CONTEXT_ADAPTER = WORKSPACE_CONTEXT_PORT;
