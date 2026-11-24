/** FEEDBACK — Module (Template Simple). */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FindingFeedbackSchema } from './finding-feedback.schema';
import { FeedbackRepository } from './feedback.repository';
import { FEEDBACK_REPOSITORY_PORT } from './feedback.types';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
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
  exports: [FEEDBACK_REPOSITORY_PORT, FeedbackRepository],
})
export class FeedbackModule {}
