import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalysisRunSchema } from './infrastructure/persistence/analysis-run.schema';
import { AnalysisResultSchema } from './infrastructure/persistence/analysis-result.schema';
import { AiJobSchema } from './infrastructure/persistence/ai-job.schema';
import { FewShotExampleSchema } from './infrastructure/persistence/few-shot-example.schema';
import { DatasetRecordSchema } from '../datasets/infrastructure/persistence/dataset-record.schema';
import { CellEvidenceSchema } from './infrastructure/persistence/cell-evidence.schema';
import { ProjectSaveSchema } from './infrastructure/persistence/project-save.schema';
import { ReportJobSchema } from './infrastructure/persistence/report-job.schema';
import { AnalysisConfigSchema } from './infrastructure/persistence/analysis-config.schema';
import { SummaryService } from './application/summary.service';
import { ReportService } from './application/report.service';
import { ReportWorkerService } from './application/report-worker.service';
import { SummaryController } from './infrastructure/http/summary.controller';
import { ReportController } from './infrastructure/http/report.controller';
import { AnalysisRepository } from './infrastructure/persistence/analysis.repository';
import { ANALYSIS_REPOSITORY_PORT } from './domain/ports/analysis.repository.port';
import { AiInferencePort } from './application/ports/ai-inference.port';
import { LocalInferenceAdapter } from './infrastructure/ai/local-inference.adapter';
import { AiWorkerService } from './application/services/ai-worker.service';
import { RagFewShotService } from './application/services/rag-few-shot.service';
import { AnalysisService } from './application/analysis.service';
import { AnalysisController } from './infrastructure/http/analysis.controller';
import { ProjectsModule } from '../projects/projects.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { DatasetsModule } from '../datasets/datasets.module';
import { DataViewModule } from '../data-view/data-view.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'AnalysisRun', schema: AnalysisRunSchema },
      { name: 'AnalysisResult', schema: AnalysisResultSchema },
      { name: 'AiJob', schema: AiJobSchema },
      { name: 'FewShotExample', schema: FewShotExampleSchema },
      { name: 'DatasetRecord', schema: DatasetRecordSchema },
      { name: 'CellEvidence', schema: CellEvidenceSchema },
      { name: 'ProjectSave', schema: ProjectSaveSchema },
      { name: 'ReportJob', schema: ReportJobSchema },
      { name: 'AnalysisConfig', schema: AnalysisConfigSchema },
    ]),
    ProjectsModule,
    DatasetsModule,
    DataViewModule,
    StorageModule,
  ],
  controllers: [AnalysisController, SummaryController, ReportController],
  providers: [
    AnalysisRepository,
    { provide: ANALYSIS_REPOSITORY_PORT, useExisting: AnalysisRepository },
    AnalysisService,
    SummaryService,
    ReportService,
    ReportWorkerService,
    { provide: AiInferencePort, useClass: LocalInferenceAdapter },
    AiWorkerService,
    RagFewShotService,
  ],
  exports: [AnalysisRepository, ANALYSIS_REPOSITORY_PORT, AnalysisService, SummaryService, ReportService, RagFewShotService],
})
export class AnalysisModule {}
