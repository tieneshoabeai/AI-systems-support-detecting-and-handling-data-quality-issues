import { SummaryService } from '../../application/summary.service';
export declare class SummaryController {
    private readonly summaryService;
    constructor(summaryService: SummaryService);
    create(projectId: string): Promise<Record<string, unknown>>;
    get(projectId: string): Promise<Record<string, unknown>>;
}
