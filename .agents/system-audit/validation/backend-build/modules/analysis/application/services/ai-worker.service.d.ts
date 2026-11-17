import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AnalysisRepositoryPort } from '../../domain/ports/analysis.repository.port';
import { AnalysisService } from '../analysis.service';
import { AiInferencePort } from '../ports/ai-inference.port';
export declare class AiWorkerService implements OnModuleInit {
    private readonly repository;
    private readonly analysisService;
    private readonly inference;
    private readonly config;
    private readonly logger;
    private timer;
    private busy;
    constructor(repository: AnalysisRepositoryPort, analysisService: AnalysisService, inference: AiInferencePort, config: ConfigService);
    onModuleInit(): void;
    tick(): Promise<void>;
    private processJob;
}
