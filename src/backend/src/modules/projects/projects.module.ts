import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectSchema } from './infrastructure/persistence/project.schema';
import { ProjectsRepository } from './infrastructure/persistence/projects.repository';
import { PROJECT_REPOSITORY_PORT } from './domain/ports/project.repository.port';
import { PROJECT_ACCESS_PORT } from './domain/ports/project.access.port';
import { ProjectsController } from './presentation/controllers/projects.controller';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';
import { ProjectAccessAdapter } from './infrastructure/adapters/project-access.adapter';
import { AddProjectMemberHandler } from './application/commands/add-project-member.handler';
import { CreateProjectHandler } from './application/commands/create-project.handler';
import { DeleteProjectHandler } from './application/commands/delete-project.handler';
import { GetProjectByIdHandler } from './application/queries/get-project-by-id.handler';
import { GetProjectsByWorkspaceHandler } from './application/queries/get-projects-by-workspace.handler';
import { GetWorkspaceNameHandler } from './application/queries/get-workspace-name.handler';
import { ListMembersHandler } from './application/queries/list-members.handler';
import { ListProjectsByWorkspaceHandler } from './application/queries/list-projects-by-workspace.handler';
import { MarkCompletedHandler } from './application/commands/mark-completed.handler';
import { RemoveProjectMemberHandler } from './application/commands/remove-project-member.handler';
import { ResolveUserProjectRoleHandler } from './application/queries/resolve-user-project-role.handler';
import { SetHasDatasetHandler } from './application/commands/set-has-dataset.handler';
import { TransferProjectOwnerHandler } from './application/commands/transfer-project-owner.handler';
import { UpdateProjectHandler } from './application/commands/update-project.handler';
import { UpdateProjectMemberRoleHandler } from './application/commands/update-project-member-role.handler';
import { ProjectContextAdapter } from './infrastructure/adapters/project-context.adapter';
import { ProjectPolicyLoader } from './application/policy-loaders/project-policy.loader';
import { ProjectScopePolicyLoader } from './application/policy-loaders/project-scope-policy.loader';
import { WorkspaceScopePolicyLoader } from './application/policy-loaders/workspace-scope-policy.loader';
import { PROJECT_CONTEXT_PORT } from '../../shared/application/ports/project-context.port';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Project', schema: ProjectSchema }]),
    WorkspacesModule,
    UsersModule,
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectsRepository,
    { provide: PROJECT_REPOSITORY_PORT, useExisting: ProjectsRepository },
    AddProjectMemberHandler,
    CreateProjectHandler,
    DeleteProjectHandler,
    GetProjectByIdHandler,
    MarkCompletedHandler,
    RemoveProjectMemberHandler,
    SetHasDatasetHandler,
    TransferProjectOwnerHandler,
    UpdateProjectMemberRoleHandler,
    UpdateProjectHandler,
    GetProjectsByWorkspaceHandler,
    GetWorkspaceNameHandler,
    ListMembersHandler,
    ListProjectsByWorkspaceHandler,
    ResolveUserProjectRoleHandler,
    ProjectAccessAdapter,
    { provide: PROJECT_ACCESS_PORT, useExisting: ProjectAccessAdapter },
    ProjectContextAdapter,
    { provide: PROJECT_CONTEXT_PORT, useExisting: ProjectContextAdapter },
    ProjectPolicyLoader,
    ProjectScopePolicyLoader,
    WorkspaceScopePolicyLoader,
  ],
  exports: [
    ProjectsRepository,
    PROJECT_REPOSITORY_PORT,
    PROJECT_ACCESS_PORT,
    PROJECT_CONTEXT_PORT,
    ProjectPolicyLoader,
    ProjectScopePolicyLoader,
    WorkspaceScopePolicyLoader,
  ],
})
export class ProjectsModule {}
