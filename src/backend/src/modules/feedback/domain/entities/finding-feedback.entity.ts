import { assertReasonForLabel, type FeedbackLabel } from '../value-objects/feedback-label.vo';

export interface FindingFeedbackProps {
  id: string;
  findingId: string | null;
  label: FeedbackLabel;
  reason: string | null;
}

export class FindingFeedback {
  private constructor(private readonly props: FindingFeedbackProps) {}

  static create(props: FindingFeedbackProps): FindingFeedback {
    assertReasonForLabel(props.label, props.reason);
    return new FindingFeedback({ ...props });
  }

  assertUpdatable(nextLabel: string, nextReason: string | null | undefined): void {
    assertReasonForLabel(nextLabel, nextReason ?? this.props.reason);
  }
}
