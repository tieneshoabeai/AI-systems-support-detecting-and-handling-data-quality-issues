import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QueryRecordsSchema, QueryRecordsDto } from '../dtos/query-records.dto';
import { QueryRecordsBodySchema, QueryRecordsBodyDto } from '../dtos/query-records-body.dto';
import { JwtAuthGuard } from '../../../../shared/interfaces/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/interfaces/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/interfaces/casl/check-policies.decorator';
import { PolicyResource } from '../../../../shared/interfaces/casl/policy-resource.decorator';
import { Action } from '../../../../shared/domain/security/action';
import { ZodValidationPipe } from '../../../../shared/interfaces/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../../../shared/interfaces/swagger/api-zod.decorator';
import { GetColumnStatsHandler } from '../../application/queries/get-column-stats.handler';
import { GetChartDataHandler } from '../../application/queries/get-chart-data.handler';
import { GetRecordsHandler } from '../../application/queries/get-records.handler';
import { QueryRecordsHandler } from '../../application/queries/query-records.handler';
import { DatasetPolicyLoader } from '../../../datasets';
import type { CursorPaginatedResponse } from '../../../../shared/domain/pagination/cursor-paginated.response';
import type { RecordRow } from '../../../datasets';
import type { ColumnStatsResult } from '../../application/data-view.types';
import type { ChartDataResult } from '../../application/data-view.types';
import { ChartDataSchema, ChartDataDto } from '../dtos/chart-data.dto';

@ApiTags('Data View (Virtual Grid)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('datasets/:datasetId')
export class DataViewController {
  constructor(
    private readonly getRecordsHandler: GetRecordsHandler,
    private readonly queryRecordsHandler: QueryRecordsHandler,
    private readonly getColumnStatsHandler: GetColumnStatsHandler,
    private readonly getChartDataHandler: GetChartDataHandler,
  ) {}

  @Get('records')
  @ApiOperation({
    summary:
      'F5.1 (Wave 4): Keyset pagination cho Virtual Grid - { items, meta: { nextCursor, hasMore } }',
  })
  @ApiZodQuery(QueryRecordsSchema)
  // UC-14 (xem bảng dữ liệu): mọi vai trò đều đọc được.
  @PolicyResource('DataRecord', DatasetPolicyLoader, 'datasetId')
  @CheckPolicies((ability) => ability.can(Action.Read, 'DataRecord'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getRecords(
    @Param('datasetId') datasetId: string,
    @Query(new ZodValidationPipe(QueryRecordsSchema)) query: QueryRecordsDto,
  ): Promise<CursorPaginatedResponse<RecordRow>> {
    return this.getRecordsHandler.execute(datasetId, query);
  }

  @Post('records/query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'F5.4 (Wave 4): Truy van loc/sap xep/tim kiem tren props.cN + keyset pagination',
  })
  @ApiZodBody(QueryRecordsBodySchema)
  @PolicyResource('DataRecord', DatasetPolicyLoader, 'datasetId')
  @CheckPolicies((ability) => ability.can(Action.Read, 'DataRecord'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async queryRecords(
    @Param('datasetId') datasetId: string,
    @Body(new ZodValidationPipe(QueryRecordsBodySchema)) body: QueryRecordsBodyDto,
  ): Promise<CursorPaginatedResponse<RecordRow>> {
    return this.queryRecordsHandler.execute(datasetId, body);
  }

  @Get('columns/:columnKey/stats')
  @ApiOperation({
    summary: 'F5.3 (Wave 4): Thong ke cot theo key on dinh c{i} (chap nhan ca ten hien thi)',
  })
  @PolicyResource('Dataset', DatasetPolicyLoader, 'datasetId')
  @CheckPolicies((ability) => ability.can(Action.Read, 'Dataset'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getColumnStats(
    @Param('datasetId') datasetId: string,
    @Param('columnKey') columnKey: string,
  ): Promise<{ stats: ColumnStatsResult; }> {
    const stats = await this.getColumnStatsHandler.execute(datasetId, columnKey);
    return { stats };
  }

  @Get('charts')
  @ApiOperation({
    summary:
      'GĐ6/E1: So lieu bieu do (histogram, box plot, Top N) cho cac cot cua dataset',
  })
  @ApiZodQuery(ChartDataSchema)
  @PolicyResource('Dataset', DatasetPolicyLoader, 'datasetId')
  @CheckPolicies((ability) => ability.can(Action.Read, 'Dataset'))
  @ApiResponse({ status: 200, description: 'Thanh cong' })
  async getChartData(
    @Param('datasetId') datasetId: string,
    @Query(new ZodValidationPipe(ChartDataSchema)) query: ChartDataDto,
  ): Promise<{ charts: ChartDataResult[]; }> {
    const charts = await this.getChartDataHandler.execute(datasetId, {
      columns: query.columns
        ? query.columns.split(',').map((c) => c.trim()).filter((c) => c.length > 0)
        : undefined,
      topN: query.top_n,
      maxRows: query.max_rows,
    });
    return { charts };
  }
}
