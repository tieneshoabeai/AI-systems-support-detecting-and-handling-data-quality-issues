/**
 * PROJECTS — Adapter cho facade port `PROJECT_ACCESS_PORT`.
 *
 * Sau khi tách `ProjectsService` thành các handler (Command/Query pattern),
 * module khác không còn import được application service. `ProjectAccessPort`
 * vẫn là hợp đồng công khai của module `projects`; adapter này là cầu nối
 * (driving adapter) giữa port và các handler đã tách.
 */
import { Injectable } from '@nestjs/common';

import {
  PROJECT_ACCESS_PORT,
  type ProjectAccessPort,
  type ProjectAccessRole,
} from '../../domain/ports/project.access.port';
import type { Project } from '../../domain/entities/project.entity';
import { GetProjectByIdHandler } from '../../application/queries/get-project-by-id.handler';
import { ResolveUserProjectRoleHandler } from '../../application/queries/resolve-user-project-role.handler';
import { SetHasDatasetHandler } from '../../application/commands/set-has-dataset.handler';

@Injectable()
export class ProjectAccessAdapter implements ProjectAccessPort {
  constructor(
    private readonly getProjectByIdHandler: GetProjectByIdHandler,
    private readonly resolveUserProjectRoleHandler: ResolveUserProjectRoleHandler,
    private readonly setHasDatasetHandler: SetHasDatasetHandler,
  ) {}

  getProjectById(id: string): Promise<Project> {
    return this.getProjectByIdHandler.execute(id);
  }

  resolveUserProjectRole(
    projectId: string,
    userId: string,
    workspaceRole?: 'owner' | 'member' | null,
  ): Promise<ProjectAccessRole | null> {
    return this.resolveUserProjectRoleHandler.execute(projectId, userId, workspaceRole);
  }

  setHasDataset(projectId: string, hasDataset: boolean): Promise<boolean> {
    return this.setHasDatasetHandler.execute(projectId, hasDataset);
  }
}

export { PROJECT_ACCESS_PORT };
