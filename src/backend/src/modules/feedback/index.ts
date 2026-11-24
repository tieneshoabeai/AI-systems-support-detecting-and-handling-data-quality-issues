/** Public contract cua module FEEDBACK (Template Simple). */
export {
  FEEDBACK_REPOSITORY_PORT,
  type CreateFeedbackRecord,
  type FeedbackListQuery,
  type Feedback,
  type FeedbackRepositoryPort,
  type FeedbackScope,
  FEEDBACK_LABELS,
  FEEDBACK_SEVERITIES,
  LABELS_REQUIRING_REASON,
  requiresReason,
  type FeedbackLabel,
  type FeedbackSeverity,
  FEEDBACK_EVENTS,
  type FeedbackEventName,
  MAX_FEEDBACK_REASON_LENGTH,
  MAX_FEEDBACK_AI_RATIONALE_LENGTH,
  MAX_FEEDBACK_FINDING_ID_LENGTH,
  type FeedbackProps,
  type CreateFeedbackInput,
  type UpdateFeedbackInput,
  type ListFeedbackQueryInput,
} from './feedback.types';
export { Feedback as FeedbackEntity } from './feedback.types';
export { FeedbackService } from './feedback.service';
export { FeedbackRepository } from './feedback.repository';
export {
  CreateFeedbackSchema,
  UpdateFeedbackSchema,
  ListFeedbackQuerySchema,
  type CreateFeedbackDto,
  type UpdateFeedbackDto,
  type ListFeedbackQueryDto,
} from './feedback.controller';
