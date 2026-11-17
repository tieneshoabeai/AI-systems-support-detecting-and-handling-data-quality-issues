import { type FeedbackLabel } from '../value-objects/feedback-label.vo';
export interface FindingFeedbackProps {
    id: string;
    findingId: string | null;
    label: FeedbackLabel;
    reason: string | null;
}
export declare class FindingFeedback {
    private readonly props;
    private constructor();
    static create(props: FindingFeedbackProps): FindingFeedback;
    assertUpdatable(nextLabel: string, nextReason: string | null | undefined): void;
}
