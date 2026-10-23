import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspaceSchema } from './schemas/workspace.schema';
import { WorkspacesRepository } from './workspaces.repository';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Workspace', schema: WorkspaceSchema }]),
    UsersModule,
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesRepository, WorkspacesService],
  exports: [WorkspacesRepository, WorkspacesService],
})
export class WorkspacesModule {}
