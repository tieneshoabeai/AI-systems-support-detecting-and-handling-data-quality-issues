import { type RealtimePort } from '../../realtime/domain/ports/realtime.port';
import { type AnalysisRepositoryPort } from '../domain/ports/analysis.repository.port';
import { ProjectsService } from '../../projects/application/projects.service';
import { type DatasetRepositoryPort } from '../../datasets/domain/ports/dataset.repository.port';
import { type RecordQueryPort } from '../../data-view/domain/ports/record-query.port';
export interface RunAnalysisInput {
    selected_columns?: string[];
    correlation_method: 'pearson' | 'spearman';
    outlier_method: 'iqr' | 'modified_zscore' | 'both';
    top_n: number;
}
export interface AnalysisConfigInput {
    selected_columns?: string[] | null;
    label_column?: string | null;
    time_column?: string | null;
    time_granularity: 'day' | 'week' | 'month' | 'year';
    value_column?: string | null;
    correlation_method: 'pearson' | 'spearman';
    outlier_method: 'iqr' | 'modified_zscore' | 'both';
    top_n: number;
}
import { ConfigService } from '@nestjs/config';
import { RagFewShotService } from './services/rag-few-shot.service';
export declare class AnalysisService {
    private readonly analysisRepository;
    private readonly projectsService;
    private readonly datasetsRepository;
    private readonly records;
    private readonly configService;
    private readonly realtime?;
    private readonly ragFewShot?;
    private readonly logger;
    constructor(analysisRepository: AnalysisRepositoryPort, projectsService: ProjectsService, datasetsRepository: DatasetRepositoryPort, records: RecordQueryPort, configService: ConfigService, realtime?: RealtimePort | undefined, ragFewShot?: RagFewShotService | undefined);
    private fingerprint;
    runAnalysis(projectId: string, dto: RunAnalysisInput, userId?: string): Promise<Record<string, unknown>>;
    getResult(projectId: string): Promise<Record<string, unknown>>;
    getJob(jobId: string): Promise<Record<string, unknown>>;
    retryJob(jobId: string): Promise<Record<string, unknown>>;
    ingestAiResult(jobId: string, raw: unknown, modelId?: string): Promise<Record<string, unknown>>;
    saveConfig(projectId: string, dto: AnalysisConfigInput): Promise<Record<string, unknown>>;
    getConfig(projectId: string): Promise<Record<string, unknown>>;
    buildPromptForJob(jobId: string): Promise<string>;
    private toApiShape;
}
