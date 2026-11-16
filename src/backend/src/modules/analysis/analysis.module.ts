import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalysisRunSchema } from './infrastructure/persistence/analysis-run.schema';
import { AnalysisResultSchema } from './infrastructure/persistence/analysis-result.schema';
import { AiJobSchema } from './infrastructure/persistence/ai-job.schema';
import { FewShotExampleSchema } from './infrastructure/persistence/few-shot-example.schema';
import { CellEvidenceSchema } from './infrastructure/persistence/cell-evidence.schema';
import { ProjectSaveSchema } from './infrastructure/persistence/project-save.schema';
import { ReportJobSchema } from './infrastructure/persistence/report-job.schema';
import { AnalysisConfigSchema } from './infrastructure/persistence/analysis-config.schema';
import { ReportWorkerService } from './application/report-worker.service';
import { SummaryController } from './infrastructure/http/summary.controller';
import { ReportController } from './infrastructure/http/report.controller';
import { AnalysisRepository } from './infrastructure/persistence/analysis.repository';
import { ANALYSIS_REPOSITORY_PORT } from './domain/ports/analysis.repository.port';
import { RAG_FEW_SHOT_PORT } from './domain/ports/rag-few-shot.port';
import { AiInferencePort } from './application/ports/ai-inference.port';
import { LocalInferenceAdapter } from './infrastructure/ai/local-inference.adapter';
import { AiWorkerService } from './application/services/ai-worker.service';
import { RagFewShotService } from './application/services/rag-few-shot.service';
import { AnalysisController } from './infrastructure/http/analysis.controller';
import { ProjectsModule } from '../projects/projects.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { DatasetsModule } from '../datasets/datasets.module';
import { BuildPromptForJobHandler } from './application/commands/build-prompt-for-job.handler';
import { GetConfigHandler } from './application/queries/get-config.handler';
import { GetJobHandler } from './application/queries/get-job.handler';
import { GetResultHandler } from './application/queries/get-result.handler';
import { IngestAiResultHandler } from './application/commands/ingest-ai-result.handler';
import { RetryJobHandler } from './application/commands/retry-job.handler';
import { RunAnalysisHandler } from './application/commands/run-analysis.handler';
import { SaveConfigHandler } from './application/commands/save-config.handler';
import { CreateSummaryHandler } from './application/commands/create-summary.handler';
import { GetSummaryHandler } from './application/queries/get-summary.handler';
import { DownloadReportFileHandler } from './application/queries/download-report-file.handler';
import { GetReportFileMetaHandler } from './application/queries/get-report-file-meta.handler';
import { RequestReportHandler } from './application/commands/request-report.handler';

/**
 * ANALYSIS — Module phân tích chất lượng dữ liệu + AI.
 *
 * L2 (R3/CA6): KHÔNG khai báo schema Mongoose `DatasetRecord` (thuộc `datasets`).
 * Việc đọc bản ghi đi qua `RECORD_QUERY_PORT` do module `datasets` export.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'AnalysisRun', schema: AnalysisRunSchema },
      { name: 'AnalysisResult', schema: AnalysisResultSchema },
      { name: 'AiJob', schema: AiJobSchema },
      { name: 'FewShotExample', schema: FewShotExampleSchema },
      { name: 'CellEvidence', schema: CellEvidenceSchema },
      { name: 'ProjectSave', schema: ProjectSaveSchema },
      { name: 'ReportJob', schema: ReportJobSchema },
      { name: 'AnalysisConfig', schema: AnalysisConfigSchema },
    ]),
    ProjectsModule,
    DatasetsModule,
    StorageModule,
  ],
  controllers: [AnalysisController, SummaryController, ReportController],
  providers: [
    AnalysisRepository,
    { provide: ANALYSIS_REPOSITORY_PORT, useExisting: AnalysisRepository },
    BuildPromptForJobHandler,
    IngestAiResultHandler,
    RetryJobHandler,
    RunAnalysisHandler,
    SaveConfigHandler,
    GetConfigHandler,
    GetJobHandler,
    GetResultHandler,
    CreateSummaryHandler,
    GetSummaryHandler,
    RequestReportHandler,
    DownloadReportFileHandler,
    GetReportFileMetaHandler,
    ReportWorkerService,
    { provide: AiInferencePort, useClass: LocalInferenceAdapter },
    AiWorkerService,
    RagFewShotService,
    { provide: RAG_FEW_SHOT_PORT, useExisting: RagFewShotService },
  ],
  exports: [AnalysisRepository, ANALYSIS_REPOSITORY_PORT, RAG_FEW_SHOT_PORT, RagFewShotService],
})
export class AnalysisModule {}
