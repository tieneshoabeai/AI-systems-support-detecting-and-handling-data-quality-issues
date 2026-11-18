import { type RealtimePort } from '../../realtime/domain/ports/realtime.port';
import { type FeedbackRepositoryPort } from '../domain/ports/feedback.repository.port';
import { type AnalysisRepositoryPort } from '../../analysis/domain/ports/analysis.repository.port';
import { ProjectsService } from '../../projects/application/projects.service';
import { WorkspacesService } from '../../workspaces/application/workspaces.service';
import { UsersService } from '../../users/application/users.service';
export interface CreateFeedbackInput {
    label: string;
    reason?: string | null;
    suggestedSeverity?: string | null;
}
export interface UpdateFeedbackInput {
    label?: string;
    reason?: string | null;
    suggestedSeverity?: string | null;
}
export interface ListFeedbackQueryInput {
    limit: number;
    cursor?: string;
    label?: string;
    sortOrder: 'asc' | 'desc';
}
import { RagFewShotService } from '../../analysis/application/services/rag-few-shot.service';
export declare class FeedbackService {
    private readonly repo;
    private readonly analysisRepository;
    private readonly projectsService;
    private readonly workspacesService;
    private readonly usersService;
    private readonly realtime?;
    private readonly ragFewShot?;
    private readonly logger;
    constructor(repo: FeedbackRepositoryPort, analysisRepository: AnalysisRepositoryPort, projectsService: ProjectsService, workspacesService: WorkspacesService, usersService: UsersService, realtime?: RealtimePort | undefined, ragFewShot?: RagFewShotService | undefined);
    private ensureNotAdmin;
    private parseCursor;
    private buildPage;
    private resolveProjectAccess;
    private resolveRunProject;
    private authorNames;
    private checkReason;
    private promoteFindingToStore;
    createFindingFeedback(userId: string, role: string, analysisId: string, findingId: string, dto: CreateFeedbackInput): Promise<Record<string, unknown>>;
    createRunFeedback(userId: string, role: string, analysisId: string, dto: CreateFeedbackInput): Promise<Record<string, unknown>>;
    listFindingFeedback(userId: string, role: string, analysisId: string, findingId: string, query: ListFeedbackQueryInput): Promise<{
        items: Record<string, unknown>[];
        meta: {
            nextCursor: string | null;
            hasMore: boolean;
        };
        summary: Record<string, number>;
    }>;
    listRunFeedback(userId: string, role: string, analysisId: string, query: ListFeedbackQueryInput): Promise<{
        items: Record<string, unknown>[];
        meta: {
            nextCursor: string | null;
            hasMore: boolean;
        };
        summary: Record<string, number>;
    }>;
    updateMine(userId: string, id: string, dto: UpdateFeedbackInput): Promise<Record<string, unknown>>;
    remove(userId: string, role: string, id: string): Promise<{
        deleted: boolean;
    }>;
    aiQualityMetrics(userId: string, role: string, projectId: string): Promise<Record<string, unknown>>;
}
