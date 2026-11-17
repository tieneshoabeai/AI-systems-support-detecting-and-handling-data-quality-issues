import { Model } from 'mongoose';
import { IFindingFeedback } from './finding-feedback.schema';
import { type CreateFeedbackRecord, type FeedbackListQuery, type FeedbackRecord, type FeedbackRepositoryPort, type FeedbackScope } from '../../domain/ports/feedback.repository.port';
export declare class FeedbackRepository implements FeedbackRepositoryPort {
    private readonly model;
    constructor(model: Model<IFindingFeedback>);
    create(doc: CreateFeedbackRecord): Promise<FeedbackRecord>;
    listByScope(params: FeedbackListQuery): Promise<FeedbackRecord[]>;
    listActiveByRun(analysisRunId: string): Promise<FeedbackRecord[]>;
    findByIdActive(id: string): Promise<FeedbackRecord | null>;
    updateById(id: string, update: Partial<CreateFeedbackRecord> & Record<string, unknown>): Promise<FeedbackRecord | null>;
    softDelete(id: string): Promise<boolean>;
    countByProject(projectId: string): Promise<number>;
    countDistinctAuthors(scope: FeedbackScope): Promise<number>;
    countDistinctRuns(projectId: string): Promise<number>;
    aggregateByProject(projectId: string): Promise<Array<{
        label: string;
        count: number;
    }>>;
}
