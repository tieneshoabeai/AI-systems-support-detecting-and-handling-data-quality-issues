import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './shared/config/env.validation';
import { SharedModule } from './shared/shared.module';
import { DatabaseModule } from './shared/database/database.module';
import { StorageModule } from './shared/storage/storage.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { DatasetsModule } from './modules/datasets/datasets.module';
import { DataViewModule } from './modules/data-view/data-view.module';
import { LineageModule } from './modules/lineage/lineage.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: ['.env', 'src/backend/.env'],
    }),
    SharedModule,
    DatabaseModule,
    StorageModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
    ProjectsModule,
    DatasetsModule,
    DataViewModule,
    LineageModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
