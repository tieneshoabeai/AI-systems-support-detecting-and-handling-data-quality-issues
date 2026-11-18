import { type IssueStatus } from '../value-objects/issue-status.vo';
import type { IssueType } from '../value-objects/issue-type.vo';
export interface IssueReportProps {
    id: string;
    issueType: IssueType;
    status: IssueStatus;
    title: string;
    version: number;
}
export declare class IssueReport {
    private readonly props;
    private constructor();
    static create(props: IssueReportProps): IssueReport;
    canTransitionTo(next: IssueStatus): boolean;
    assertCanTransitionTo(next: IssueStatus): void;
}
