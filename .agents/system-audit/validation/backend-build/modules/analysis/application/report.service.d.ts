import type { Readable } from 'stream';
import { type AnalysisRepositoryPort } from '../domain/ports/analysis.repository.port';
import { ProjectsService } from '../../projects/application/projects.service';
import { type StoragePort } from '../../../shared/ports/storage.port';
export declare class ReportService {
    private readonly analysisRepository;
    private readonly projectsService;
    private readonly storage;
    constructor(analysisRepository: AnalysisRepositoryPort, projectsService: ProjectsService, storage: StoragePort);
    requestReport(projectId: string): Promise<Record<string, unknown>>;
    downloadReportFile(projectId: string, reportId: string): Promise<{
        stream: Readable;
        fileSizeBytes: number | null;
    }>;
    getReportFileMeta(projectId: string, reportId: string): Promise<Record<string, unknown>>;
}
