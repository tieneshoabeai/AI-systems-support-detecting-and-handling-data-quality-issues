import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AnalysisRepositoryPort } from '../domain/ports/analysis.repository.port';
import { type StoragePort } from '../../../shared/ports/storage.port';
export declare class ReportWorkerService implements OnModuleInit {
    private readonly repository;
    private readonly storage;
    private readonly config;
    private readonly logger;
    private timer;
    private busy;
    constructor(repository: AnalysisRepositoryPort, storage: StoragePort, config: ConfigService);
    onModuleInit(): void;
    tick(): Promise<void>;
    buildPdf(reportId: string): Promise<void>;
}
