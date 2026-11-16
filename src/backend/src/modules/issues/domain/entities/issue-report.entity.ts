import { assertAllowedIssueTransition, type IssueStatus } from '../value-objects/issue-status.vo';
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
    const allowed = { new: ['in_progress'], in_progress: ['resolved', 'new'], resolved: ['closed'], closed: [] } as Record<IssueStatus, IssueStatus[]>;
    return (allowed[this.props.status] ?? []).includes(next);
  }

  assertCanTransitionTo(next: IssueStatus): void {
    assertAllowedIssueTransition(this.props.status, next);
  }
}
