import { CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
import { IssuesService } from '../../application/issues.service';
import { AuditService } from '../../../audit/application/audit.service';
import type { Request, Response } from 'express';
import { CreateIssueDto, ListIssuesQueryDto, AdminListIssuesQueryDto, UpdateIssueStatusDto } from './dtos/create-issue.dto';
export declare class IssuesController {
    private readonly issuesService;
    private readonly audit;
    constructor(issuesService: IssuesService, audit: AuditService);
    createReport(user: CurrentUserPayload, dto: CreateIssueDto): Promise<Record<string, unknown>>;
    listMine(user: CurrentUserPayload, query: ListIssuesQueryDto): Promise<{
        items: Record<string, unknown>[];
        meta: {
            nextCursor: string | null;
            hasMore: boolean;
        };
    }>;
    uploadAttachment(user: CurrentUserPayload, id: string, req: Request): Promise<Record<string, unknown>>;
    downloadAttachment(user: CurrentUserPayload, id: string, attachmentId: string, req: Request, res: Response): Promise<void>;
    getMine(user: CurrentUserPayload, id: string): Promise<Record<string, unknown>>;
    listForAdmin(query: AdminListIssuesQueryDto): Promise<{
        items: Record<string, unknown>[];
        meta: {
            nextCursor: string | null;
            hasMore: boolean;
        };
    }>;
    getForAdmin(user: CurrentUserPayload, id: string): Promise<Record<string, unknown>>;
    updateStatus(user: CurrentUserPayload, id: string, dto: UpdateIssueStatusDto): Promise<Record<string, unknown>>;
}
