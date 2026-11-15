import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../workspaces';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../projects';

/**
 * OVERVIEW — Application service tổng hợp chỉ số (E3/E4).
 *
 * Tách riêng khỏi `WorkspacesService` để tránh phụ thuộc vòng
 * `workspaces ⇄ projects` (vi phạm CA9). Module này là "composition root"
 * chỉ để đọc — không ghi dữ liệu.
 */
@Injectable()
export class OverviewService {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  /**
   * E3 — Tổng quan workspace của người dùng hiện tại (5 chỉ số).
   *
   * - `totalWorkspaces`: tổng số workspace user đó tham gia (sở hữu + được chia).
   * - `totalProjects`: tổng số project user đó tham gia.
   * - `ownedWorkspaces`: số workspace user đó làm chủ sở hữu.
   * - `sharedWorkspaces`: số workspace được chia sẻ cho user đó.
   * - `myProjects`: số project user đó là thành viên/owner.
   */
  async getUserOverview(userId: string): Promise<{
    totalWorkspaces: number;
    totalProjects: number;
    ownedWorkspaces: number;
    sharedWorkspaces: number;
    myProjects: number;
  }> {
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

  /**
   * E4 — Tổng quan một workspace:
   * tổng project / chưa xử lý / đang xử lý / đã xử lý.
   */
  async getWorkspaceOverview(workspaceId: string): Promise<{
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
