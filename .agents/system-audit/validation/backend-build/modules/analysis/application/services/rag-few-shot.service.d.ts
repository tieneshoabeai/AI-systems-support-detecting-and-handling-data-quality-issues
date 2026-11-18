import { ConfigService } from '@nestjs/config';
import { type AnalysisRepositoryPort } from '../../domain/ports/analysis.repository.port';
export declare class RagFewShotService {
    private readonly repository;
    private readonly config;
    private readonly logger;
    constructor(repository: AnalysisRepositoryPort, config: ConfigService);
    embeddingDim(): number;
    embedQueryText(text: string): number[];
    buildQueryText(errorType: string, columnTraits: string, description: string): string;
    buildFewShotBlockFromText(params: {
        workspaceId: string;
        queryText: string;
        errorType?: string;
        language?: string;
    }): Promise<string>;
    buildFewShotBlock(params: {
        workspaceId: string;
        embedding: number[] | null;
        errorType?: string;
        language?: string;
    }): Promise<string>;
}
