import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspaceSchema } from './infrastructure/persistence/workspace.schema';
import { WorkspacesRepository } from './infrastructure/persistence/workspaces.repository';
import { WORKSPACE_REPOSITORY_PORT } from './domain/ports/workspace.repository.port';
import { WorkspacesService } from './application/workspaces.service';
import { WorkspacesController } from './infrastructure/http/workspaces.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Workspace', schema: WorkspaceSchema }]), UsersModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesRepository, { provide: WORKSPACE_REPOSITORY_PORT, useExisting: WorkspacesRepository }, WorkspacesService],
  exports: [WorkspacesRepository, WORKSPACE_REPOSITORY_PORT, WorkspacesService],
})
export class WorkspacesModule {}
