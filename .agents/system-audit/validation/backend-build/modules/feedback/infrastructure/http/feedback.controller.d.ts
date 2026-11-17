import { CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
import { FeedbackService } from '../../application/feedback.service';
import { CreateFeedbackDto, UpdateFeedbackDto, ListFeedbackQueryDto } from './dtos/feedback.dto';
export declare class FeedbackController {
    private readonly feedbackService;
    constructor(feedbackService: FeedbackService);
    createFindingFeedback(user: CurrentUserPayload, analysisId: string, findingId: string, dto: CreateFeedbackDto): Promise<Record<string, unknown>>;
    createRunFeedback(user: CurrentUserPayload, analysisId: string, dto: CreateFeedbackDto): Promise<Record<string, unknown>>;
    listFindingFeedback(user: CurrentUserPayload, analysisId: string, findingId: string, query: ListFeedbackQueryDto): Promise<{
        items: Record<string, unknown>[];
        meta: {
            nextCursor: string | null;
            hasMore: boolean;
        };
        summary: Record<string, number>;
    }>;
    listRunFeedback(user: CurrentUserPayload, analysisId: string, query: ListFeedbackQueryDto): Promise<{
        items: Record<string, unknown>[];
        meta: {
            nextCursor: string | null;
            hasMore: boolean;
        };
        summary: Record<string, number>;
    }>;
    updateMine(user: CurrentUserPayload, id: string, dto: UpdateFeedbackDto): Promise<Record<string, unknown>>;
    remove(user: CurrentUserPayload, id: string): Promise<{
        deleted: boolean;
    }>;
    aiQualityMetrics(user: CurrentUserPayload, projectId: string): Promise<Record<string, unknown>>;
}
