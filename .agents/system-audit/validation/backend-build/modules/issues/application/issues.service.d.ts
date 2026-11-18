import { type IssueReportRepositoryPort } from '../domain/ports/issue-report.repository.port';
import { type IssueStatus } from '../domain/value-objects/issue-status.vo';
import type { IssueType } from '../domain/value-objects/issue-type.vo';
import { type NotificationRepositoryPort } from '../../notifications/domain/ports/notification.repository.port';
import { type UserRepositoryPort } from '../../users/domain/ports/user.repository.port';
import { type RealtimePort } from '../../realtime/domain/ports/realtime.port';
import { type StoragePort } from '../../../shared/ports/storage.port';
import { Readable } from 'stream';
export interface CreateIssueInput {
    issueType: IssueType;
    title: string;
    description: string;
    workspaceId?: string;
    apiPath?: string;
    errorMessage?: string;
    occurredAt?: string;
}
export interface ListIssuesInput {
    cursor?: string;
    limit: number;
    sortBy: 'createdAt' | 'updatedAt' | 'status';
    sortOrder: 'asc' | 'desc';
    status?: IssueStatus;
}
export interface AdminListIssuesInput {
    cursor?: string;
    limit: number;
    sortBy: 'createdAt' | 'updatedAt' | 'status' | 'severity';
    sortOrder: 'asc' | 'desc';
    status?: IssueStatus;
}
export declare class IssuesService {
    private readonly repo;
    private readonly notifications;
    private readonly users;
    private readonly realtime?;
    private readonly storage?;
    constructor(repo: IssueReportRepositoryPort, notifications: NotificationRepositoryPort, users: UserRepositoryPort, realtime?: RealtimePort | undefined, storage?: StoragePort | undefined);
    createReport(userId: string, dto: CreateIssueInput): Promise<Record<string, unknown>>;
    private parseCursor;
    private buildPage;
    listMine(userId: string, query: ListIssuesInput): Promise<{
        items: Record<string, unknown>[];
        meta: {
            nextCursor: string | null;
            hasMore: boolean;
        };
    }>;
    getMine(userId: string, id: string): Promise<Record<string, unknown>>;
    listForAdmin(query: AdminListIssuesInput): Promise<{
        items: Record<string, unknown>[];
        meta: {
            nextCursor: string | null;
            hasMore: boolean;
        };
    }>;
    getForAdmin(id: string, role: string): Promise<Record<string, unknown>>;
    updateStatus(id: string, role: string, status: IssueStatus, expectedVersion: number): Promise<Record<string, unknown>>;
    private assertAttachmentAccess;
    uploadAttachment(userId: string, role: string, issueId: string, file: {
        filename: string;
        mimeType: string;
        size: number;
        stream: Readable;
    }): Promise<Record<string, unknown>>;
    downloadAttachment(userId: string, role: string, issueId: string, attachmentId: string): Promise<{
        stream: Readable;
        filename: string;
        contentType: string;
        sizeBytes: number;
        workspaceId: string | null;
    }>;
}
