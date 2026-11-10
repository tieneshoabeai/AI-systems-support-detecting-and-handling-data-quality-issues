export const FEEDBACK_EVENTS = {
  SUBMITTED: 'feedback.submitted',
  PROMOTED: 'feedback.promoted',
} as const;

export type FeedbackEventName = (typeof FEEDBACK_EVENTS)[keyof typeof FEEDBACK_EVENTS];
