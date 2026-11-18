import { ReportService } from '../../application/report.service';
import { AuditService } from '../../../audit/application/audit.service';
import { CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
import type { Response, Request } from 'express';
export declare class ReportController {
    private readonly reportService;
    private readonly audit;
    constructor(reportService: ReportService, audit: AuditService);
    request(projectId: string): Promise<Record<string, unknown>>;
    download(projectId: string, reportId: string, actor: CurrentUserPayload, req: Request, res: Response): Promise<void>;
}
