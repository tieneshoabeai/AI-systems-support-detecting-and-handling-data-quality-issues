/**
 * GetUserOverviewHandler — Use case: `getUserOverview()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import { WORKSPACE_REPOSITORY_PORT, type WorkspaceRepositoryPort } from '../../../workspaces';
import { PROJECT_REPOSITORY_PORT, type ProjectRepositoryPort } from '../../../projects';

@Injectable()
export class GetUserOverviewHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async execute(userId: string): Promise<{
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
}
