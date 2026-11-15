import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectSchema } from './infrastructure/persistence/project.schema';
import { ProjectsRepository } from './infrastructure/persistence/projects.repository';
import { PROJECT_REPOSITORY_PORT } from './domain/ports/project.repository.port';
import { ProjectsService } from './application/projects.service';
import { ProjectsController } from './infrastructure/http/projects.controller';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Project', schema: ProjectSchema }]),
    WorkspacesModule,
    UsersModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsRepository, { provide: PROJECT_REPOSITORY_PORT, useExisting: ProjectsRepository }, ProjectsService],
  exports: [ProjectsRepository, PROJECT_REPOSITORY_PORT, ProjectsService],
})
export class ProjectsModule {}
