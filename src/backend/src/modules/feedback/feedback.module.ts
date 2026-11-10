import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FindingFeedbackSchema } from './infrastructure/persistence/finding-feedback.schema';
import { FeedbackRepository } from './infrastructure/persistence/feedback.repository';
import { FEEDBACK_REPOSITORY_PORT } from './domain/ports/feedback.repository.port';
import { FeedbackService } from './application/feedback.service';
import { FeedbackController } from './infrastructure/http/feedback.controller';
import { ProjectsModule } from '../projects/projects.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'FindingFeedback', schema: FindingFeedbackSchema }]),
    ProjectsModule,
    WorkspacesModule,
    UsersModule,
    AnalysisModule,
  ],
  controllers: [FeedbackController],
  providers: [
    FeedbackRepository,
    { provide: FEEDBACK_REPOSITORY_PORT, useExisting: FeedbackRepository },
    FeedbackService,
  ],
  exports: [FeedbackService, FEEDBACK_REPOSITORY_PORT, FeedbackRepository],
})
export class FeedbackModule {}
