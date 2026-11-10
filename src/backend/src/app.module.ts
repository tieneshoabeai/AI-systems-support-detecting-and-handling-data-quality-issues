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
import { AnalysisModule } from './modules/analysis/analysis.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { IssuesModule } from './modules/issues/issues.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
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
    AnalysisModule,
    NotificationsModule,
    IssuesModule,
    FeedbackModule,
    RealtimeModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
