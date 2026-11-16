/**
 * GetWorkspaceOverviewHandler — Use case: `getWorkspaceOverview()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WORKSPACE_REPOSITORY_PORT, type WorkspaceRepositoryPort } from '../../../workspaces';
import { PROJECT_REPOSITORY_PORT, type ProjectRepositoryPort } from '../../../projects';

@Injectable()
export class GetWorkspaceOverviewHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async execute(workspaceId: string): Promise<{
    workspaceId: string;
    projectCount: number;
    notStartedCount: number;
    inProgressCount: number;
    completedCount: number;
    memberCount: number;
    storageUsedBytes: number;
    lastAccessedAt: string | null;
  }> {
    const ws = await this.workspaces.findById(workspaceId);
    if (!ws) throw new NotFoundException('Không tìm thấy không gian làm việc hoặc đã bị xóa');
    const [projectCount, notStartedCount, inProgressCount, completedCount] = await Promise.all([
      this.projects.countByWorkspace(workspaceId),
      this.projects.countByWorkspace(workspaceId, 'not_started'),
      this.projects.countByWorkspace(workspaceId, 'in_progress'),
      this.projects.countByWorkspace(workspaceId, 'completed'),
    ]);
    return {
      workspaceId: ws.id,
      projectCount,
      notStartedCount,
      inProgressCount,
      completedCount,
      memberCount: ws.members.length,
      storageUsedBytes: ws.storageUsedBytes ?? 0,
      lastAccessedAt: ws.lastAccessedAt ? ws.lastAccessedAt.toISOString() : null,
    };
  }
}
