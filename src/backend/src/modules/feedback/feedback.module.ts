import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FindingFeedbackSchema } from './infrastructure/persistence/finding-feedback.schema';
import { FeedbackRepository } from './infrastructure/persistence/feedback.repository';
import { FEEDBACK_REPOSITORY_PORT } from './domain/ports/feedback.repository.port';
import { FeedbackController } from './presentation/controllers/feedback.controller';
import { ProjectsModule } from '../projects/projects.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { AiQualityMetricsHandler } from './application/commands/ai-quality-metrics.handler';
import { CreateFindingFeedbackHandler } from './application/commands/create-finding-feedback.handler';
import { CreateRunFeedbackHandler } from './application/commands/create-run-feedback.handler';
import { ListFindingFeedbackHandler } from './application/queries/list-finding-feedback.handler';
import { ListRunFeedbackHandler } from './application/queries/list-run-feedback.handler';
import { RemoveHandler } from './application/commands/remove.handler';
import { UpdateMineHandler } from './application/commands/update-mine.handler';

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
    AiQualityMetricsHandler,
    CreateFindingFeedbackHandler,
    CreateRunFeedbackHandler,
    RemoveHandler,
    UpdateMineHandler,
    ListFindingFeedbackHandler,
    ListRunFeedbackHandler,
  ],
  exports: [FEEDBACK_REPOSITORY_PORT, FeedbackRepository],
})
export class FeedbackModule {}
