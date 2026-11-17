import { AnalysisService } from '../../application/analysis.service';
import { RunAnalysisDto } from './dtos/run-analysis.dto';
import { CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
export declare class AnalysisController {
    private readonly analysisService;
    constructor(analysisService: AnalysisService);
    saveConfig(projectId: string, dto: unknown): Promise<Record<string, unknown>>;
    getConfig(projectId: string): Promise<Record<string, unknown>>;
    runAnalysis(projectId: string, user: CurrentUserPayload, dto: RunAnalysisDto): Promise<Record<string, unknown>>;
    getResult(projectId: string): Promise<Record<string, unknown>>;
    getJob(jobId: string): Promise<Record<string, unknown>>;
    retryJob(jobId: string): Promise<Record<string, unknown>>;
    ingestAiResult(jobId: string, body: {
        result: unknown;
        modelId?: string;
    }): Promise<Record<string, unknown>>;
}
