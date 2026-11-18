import { DataViewService } from '../../application/data-view.service';
import { QueryRecordsDto } from './dtos/query-records.dto';
import { QueryRecordsBodyDto } from './dtos/query-records-body.dto';
export declare class DataViewController {
    private readonly dataViewService;
    constructor(dataViewService: DataViewService);
    getRecords(datasetId: string, query: QueryRecordsDto): Promise<import("../../../../shared/pagination/cursor-paginated.response").CursorPaginatedResponse<import("../../domain/ports/record-query.port").RecordRow>>;
    queryRecords(datasetId: string, body: QueryRecordsBodyDto): Promise<import("../../../../shared/pagination/cursor-paginated.response").CursorPaginatedResponse<import("../../domain/ports/record-query.port").RecordRow>>;
    getColumnStats(datasetId: string, columnKey: string): Promise<{
        stats: import("../../application/data-view.service").ColumnStatsResult;
    }>;
}
