import { type AnalysisRepositoryPort } from '../domain/ports/analysis.repository.port';
import { ProjectsService } from '../../projects/application/projects.service';
export declare class SummaryService {
    private readonly analysisRepository;
    private readonly projectsService;
    constructor(analysisRepository: AnalysisRepositoryPort, projectsService: ProjectsService);
    createSummary(projectId: string): Promise<Record<string, unknown>>;
    getSummary(projectId: string): Promise<Record<string, unknown>>;
}
