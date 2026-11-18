export declare const FEEDBACK_EVENTS: {
    readonly SUBMITTED: 'feedback.submitted';
    readonly PROMOTED: 'feedback.promoted';
};
export type FeedbackEventName = (typeof FEEDBACK_EVENTS)[keyof typeof FEEDBACK_EVENTS];
