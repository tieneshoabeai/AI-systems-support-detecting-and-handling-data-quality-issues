import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspaceSchema } from './infrastructure/persistence/workspace.schema';
import { WorkspacesRepository } from './infrastructure/persistence/workspaces.repository';
import { WORKSPACE_REPOSITORY_PORT } from './domain/ports/workspace.repository.port';
import { WORKSPACE_ACCESS_PORT } from './domain/ports/workspace.access.port';
import { WorkspacesController } from './presentation/controllers/workspaces.controller';
import { UsersModule } from '../users/users.module';
import { WorkspaceAccessAdapter } from './infrastructure/adapters/workspace-access.adapter';
import { AddMemberHandler } from './application/commands/add-member.handler';
import { CheckWorkspaceUploadQuotaHandler } from './application/queries/check-workspace-upload-quota.handler';
import { CreateWorkspaceHandler } from './application/commands/create-workspace.handler';
import { DeleteWorkspaceHandler } from './application/commands/delete-workspace.handler';
import { GetWorkspaceByIdHandler } from './application/queries/get-workspace-by-id.handler';
import { GetWorkspacesHandler } from './application/queries/get-workspaces.handler';
import { IncrementStorageUsedHandler } from './application/commands/increment-storage-used.handler';
import { LeaveWorkspaceHandler } from './application/commands/leave-workspace.handler';
import { ListMembersHandler } from './application/queries/list-members.handler';
import { ListWorkspacesHandler } from './application/queries/list-workspaces.handler';
import { RemoveMemberHandler } from './application/commands/remove-member.handler';
import { ResolveUserWorkspaceRoleHandler } from './application/queries/resolve-user-workspace-role.handler';
import { TransferOwnerHandler } from './application/commands/transfer-owner.handler';
import { UpdateWorkspaceHandler } from './application/commands/update-workspace.handler';
import { WorkspaceContextAdapter } from './infrastructure/adapters/workspace-context.adapter';
import { WorkspacePolicyLoader } from './application/policy-loaders/workspace-policy.loader';
import { WORKSPACE_CONTEXT_PORT } from '../../shared/application/ports/workspace-context.port';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Workspace', schema: WorkspaceSchema }]),
    UsersModule,
  ],
  controllers: [WorkspacesController],
  providers: [
    WorkspacesRepository,
    { provide: WORKSPACE_REPOSITORY_PORT, useExisting: WorkspacesRepository },
    AddMemberHandler,
    CreateWorkspaceHandler,
    DeleteWorkspaceHandler,
    GetWorkspaceByIdHandler,
    IncrementStorageUsedHandler,
    LeaveWorkspaceHandler,
    RemoveMemberHandler,
    TransferOwnerHandler,
    UpdateWorkspaceHandler,
    CheckWorkspaceUploadQuotaHandler,
    GetWorkspacesHandler,
    ListMembersHandler,
    ListWorkspacesHandler,
    ResolveUserWorkspaceRoleHandler,
    WorkspaceAccessAdapter,
    { provide: WORKSPACE_ACCESS_PORT, useExisting: WorkspaceAccessAdapter },
    WorkspaceContextAdapter,
    { provide: WORKSPACE_CONTEXT_PORT, useExisting: WorkspaceContextAdapter },
    WorkspacePolicyLoader,
  ],
  exports: [
    WorkspacesRepository,
    WORKSPACE_REPOSITORY_PORT,
    WORKSPACE_ACCESS_PORT,
    WORKSPACE_CONTEXT_PORT,
    WorkspacePolicyLoader,
  ],
})
export class WorkspacesModule {}
