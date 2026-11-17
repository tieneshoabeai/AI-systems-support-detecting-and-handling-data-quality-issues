import type { IIssueReport } from './issue-report.schema';
import type { CreateIssueRecord, IssueReportRecord } from '../../domain/ports/issue-report.repository.port';
export declare function toIssueRecord(doc: IIssueReport): IssueReportRecord;
export declare function toIssuePersistence(data: CreateIssueRecord): Record<string, unknown>;
