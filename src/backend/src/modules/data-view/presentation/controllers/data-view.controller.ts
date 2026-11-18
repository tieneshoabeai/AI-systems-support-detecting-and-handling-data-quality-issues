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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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
import { GetRecordsHandler } from '../../application/queries/get-records.handler';
import { QueryRecordsHandler } from '../../application/queries/query-records.handler';
import { DatasetPolicyLoader } from '../../../datasets';
import type { CursorPaginatedResponse } from '../../../../shared/domain/pagination/cursor-paginated.response';
import type { RecordRow } from '../../../datasets';
import type { ColumnStatsResult } from '../../application/data-view.types';

@ApiTags('Data View (Virtual Grid)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('datasets/:datasetId')
export class DataViewController {
  constructor(
    private readonly getRecordsHandler: GetRecordsHandler,
    private readonly queryRecordsHandler: QueryRecordsHandler,
    private readonly getColumnStatsHandler: GetColumnStatsHandler,
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
  async getColumnStats(
    @Param('datasetId') datasetId: string,
    @Param('columnKey') columnKey: string,
  ): Promise<{ stats: ColumnStatsResult; }> {
    const stats = await this.getColumnStatsHandler.execute(datasetId, columnKey);
    return { stats };
  }
}
