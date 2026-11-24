/**
 * OVERVIEW — Service (Template Simple).
 * Gop GetUserOverviewHandler + GetWorkspaceOverviewHandler thanh OverviewService.
 * Giu nguyen Promise.all, 2 port WORKSPACE/PROJECT_REPOSITORY_PORT, NotFoundError.
 */
import { Inject, Injectable } from '@nestjs/common';
import { WORKSPACE_REPOSITORY_PORT, type WorkspaceRepositoryPort } from '../workspaces';
import { PROJECT_REPOSITORY_PORT, type ProjectRepositoryPort } from '../projects';
import { NotFoundError } from '../../shared/domain/errors';
import type { UserOverview, WorkspaceOverview } from './overview.types';

@Injectable()
export class OverviewService {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async getUserOverview(userId: string): Promise<UserOverview> {
    const [ownedWorkspaces, sharedWorkspaces, myProjects] = await Promise.all([
      this.workspaces.countOwnedByUser(userId),
      this.workspaces.countSharedByUser(userId),
      this.projects.countByUser(userId),
    ]);
    return {
      totalWorkspaces: ownedWorkspaces + sharedWorkspaces,
      totalProjects: myProjects,
      ownedWorkspaces,
      sharedWorkspaces,
      myProjects,
    };
  }

  async getWorkspaceOverview(workspaceId: string): Promise<WorkspaceOverview> {
    const ws = await this.workspaces.findById(workspaceId);
    if (!ws) throw new NotFoundError('Không tìm thấy không gian làm việc hoặc đã bị xóa');
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
