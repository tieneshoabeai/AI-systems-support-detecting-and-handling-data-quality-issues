import { Model } from 'mongoose';
import { type IIssueReport } from './issue-report.schema';
import { type CreateIssueRecord, type IssueListQuery, type IssueReportRecord, type IssueReportRepositoryPort } from '../../domain/ports/issue-report.repository.port';
import type { IssueStatus } from '../../domain/value-objects/issue-status.vo';
export declare class IssuesRepository implements IssueReportRepositoryPort {
    private readonly model;
    constructor(model: Model<IIssueReport>);
    create(doc: CreateIssueRecord): Promise<IssueReportRecord>;
    findById(id: string): Promise<IssueReportRecord | null>;
    findByIdForUser(id: string, userId: string): Promise<IssueReportRecord | null>;
    list(opts: IssueListQuery): Promise<IssueReportRecord[]>;
    addAttachment(id: string, attachment: {
        id: string;
        filename: string;
        storageKey: string;
        sizeBytes: number;
        contentType: string;
    }): Promise<IssueReportRecord | null>;
    updateStatus(id: string, status: IssueStatus, expectedVersion: number): Promise<IssueReportRecord | null>;
    findStatusById(id: string): Promise<IssueStatus | null>;
}
