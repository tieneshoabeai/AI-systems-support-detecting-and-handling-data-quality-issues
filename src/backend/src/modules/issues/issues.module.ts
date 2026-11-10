import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IssueReportSchema } from './infrastructure/persistence/issue-report.schema';
import { IssuesRepository } from './infrastructure/persistence/issues.repository';
import { ISSUE_REPORT_REPOSITORY_PORT } from './domain/ports/issue-report.repository.port';
import { IssuesService } from './application/issues.service';
import { IssuesController } from './infrastructure/http/issues.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

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
    IssuesService,
  ],
  exports: [IssuesService, IssuesRepository, ISSUE_REPORT_REPOSITORY_PORT],
})
export class IssuesModule {}
