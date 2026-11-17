import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { WORKSPACE_REPOSITORY_PORT, type WorkspaceRepositoryPort } from '../../modules/workspaces/domain/ports/workspace.repository.port';
import { PROJECT_REPOSITORY_PORT, type ProjectRepositoryPort } from '../../modules/projects/domain/ports/project.repository.port';
import { DATASET_REPOSITORY_PORT, type DatasetRepositoryPort } from '../../modules/datasets/domain/ports/dataset.repository.port';

/** Resolve membership from persisted resources, never from a client-selected workspace or stale JWT claims. */
@Injectable()
export class ManagementAccessGuard implements CanActivate {
  constructor(private readonly modules: ModuleRef) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user, params = {} } = context.switchToHttp().getRequest<{
      user?: { userId: string; role: string }; params?: Record<string, string>;
    }>();
    if (!user || user.role !== 'analyst') throw new ForbiddenException('Chỉ tài khoản nghiệp vụ được truy cập workspace/project.');
    const controller = context.getClass().name;
    const operation = context.getHandler().name;
    if (controller === 'WorkspacesController' && ['createWorkspace', 'listWorkspaces'].includes(operation)) return true;
    const workspaces = this.modules.get<WorkspaceRepositoryPort>(WORKSPACE_REPOSITORY_PORT, { strict: false });
    let workspaceId = params.workspaceId;
    let projectId = params.projectId;
    if (controller === 'WorkspacesController') workspaceId = params.id;
    else if (controller === 'ProjectsController') projectId = params.id;
    else if (controller === 'DatasetsController' && params.id) {
      const dataset = await this.modules.get<DatasetRepositoryPort>(DATASET_REPOSITORY_PORT, { strict: false }).findById(params.id);
      if (!dataset) throw new NotFoundException('Không tìm thấy dataset.');
      projectId = dataset.projectId;
    }
    const project = projectId
      ? await this.modules.get<ProjectRepositoryPort>(PROJECT_REPOSITORY_PORT, { strict: false }).findById(projectId) : null;
    if (projectId && !project) throw new NotFoundException('Không tìm thấy project.');
    workspaceId = project?.workspaceId ?? workspaceId;
    if (!workspaceId) throw new ForbiddenException('Thiếu phạm vi tài nguyên.');
    const workspace = await workspaces.findById(workspaceId);
    if (!workspace) throw new NotFoundException('Không tìm thấy workspace.');
    const owner = workspace.ownerId === user.userId;
    const member = owner || workspace.members.some(m => m.userId === user.userId);
    if (!member) throw new ForbiddenException('Bạn không còn thuộc workspace này.');
    const role = project?.members.find(m => m.userId === user.userId)?.role ?? 'viewer';
    const readOperations: Record<string, string[]> = {
      WorkspacesController: ['getWorkspaceById', 'listMembers', 'leave'],
      ProjectsController: ['listByWorkspace', 'getProjectById', 'listMembers'],
      DatasetsController: ['getDatasetByProject', 'getDatasetById', 'getDatasetSchema', 'downloadDatasetFile'],
    };
    if (readOperations[controller]?.includes(operation)) return true;
    if (controller === 'WorkspacesController' && owner && ['updateWorkspace', 'deleteWorkspace', 'addMember', 'removeMember', 'transferOwner'].includes(operation)) return true;
    if (controller === 'ProjectsController') {
      if (['createProject', 'deleteProject'].includes(operation) && owner) return true;
      if (['updateProject', 'addMember', 'updateMember', 'removeMember', 'transferOwner'].includes(operation) && (owner || role === 'owner')) return true;
      if (operation === 'markCompleted' && (owner || role === 'owner' || role === 'member')) return true;
    }
    if (controller === 'DatasetsController') {
      if (operation === 'uploadDataset' && (owner || role === 'owner')) return true;
      if (['renameColumns', 'resetColumnNames'].includes(operation) && (owner || role === 'owner' || role === 'member')) return true;
      // Legacy dataset update/delete are deliberately not exposed as manager actions.
    }
    throw new ForbiddenException('Vai trò hiện tại không được thực hiện thao tác này.');
  }
}
