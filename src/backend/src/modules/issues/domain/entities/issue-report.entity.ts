import { ALLOWED_ISSUE_TRANSITIONS, assertAllowedIssueTransition, type IssueStatus } from '../value-objects/issue-status.vo';
import type { IssueType } from '../value-objects/issue-type.vo';

export interface IssueReportProps {
  id: string;
  issueType: IssueType;
  status: IssueStatus;
  title: string;
  version: number;
}

export class IssueReport {
  private constructor(private readonly props: IssueReportProps) {}

  static create(props: IssueReportProps): IssueReport {
    return new IssueReport({ ...props });
  }

  canTransitionTo(next: IssueStatus): boolean {
    const allowed = ALLOWED_ISSUE_TRANSITIONS[this.props.status] ?? [];
    return allowed.includes(next);
  }

  assertCanTransitionTo(next: IssueStatus): void {
    assertAllowedIssueTransition(this.props.status, next);
  }
}
