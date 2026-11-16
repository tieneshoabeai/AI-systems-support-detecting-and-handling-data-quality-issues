import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IssueReportSchema } from './infrastructure/persistence/issue-report.schema';
import { IssuesRepository } from './infrastructure/persistence/issues.repository';
import { ISSUE_REPORT_REPOSITORY_PORT } from './domain/ports/issue-report.repository.port';
import { IssuesController } from './infrastructure/http/issues.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { CreateReportHandler } from './application/commands/create-report.handler';
import { DownloadAttachmentHandler } from './application/queries/download-attachment.handler';
import { GetForAdminHandler } from './application/queries/get-for-admin.handler';
import { GetMineHandler } from './application/queries/get-mine.handler';
import { ListForAdminHandler } from './application/queries/list-for-admin.handler';
import { ListMineHandler } from './application/queries/list-mine.handler';
import { UpdateMyReportHandler } from './application/commands/update-my-report.handler';
import { UpdateStatusHandler } from './application/commands/update-status.handler';
import { UploadAttachmentHandler } from './application/commands/upload-attachment.handler';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'IssueReport', schema: IssueReportSchema }]),
    NotificationsModule,
    UsersModule,
  ],
  controllers: [IssuesController],
  providers: [
    IssuesRepository,
    { provide: ISSUE_REPORT_REPOSITORY_PORT, useExisting: IssuesRepository },
    CreateReportHandler,
    UpdateMyReportHandler,
    UpdateStatusHandler,
    UploadAttachmentHandler,
    DownloadAttachmentHandler,
    GetForAdminHandler,
    GetMineHandler,
    ListForAdminHandler,
    ListMineHandler,
  ],
  exports: [IssuesRepository, ISSUE_REPORT_REPOSITORY_PORT],
})
export class IssuesModule {}
