import type { IFindingFeedback } from './finding-feedback.schema';
import type { CreateFeedbackRecord, FeedbackRecord } from '../../domain/ports/feedback.repository.port';
export declare function toFeedbackRecord(doc: IFindingFeedback): FeedbackRecord;
export declare function toFeedbackPersistence(data: CreateFeedbackRecord): Record<string, unknown>;
