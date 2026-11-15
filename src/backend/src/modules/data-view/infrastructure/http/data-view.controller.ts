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
import { DataViewService } from '../../application/data-view.service';
import { QueryRecordsSchema, QueryRecordsDto } from './dtos/query-records.dto';
import { QueryRecordsBodySchema, QueryRecordsBodyDto } from './dtos/query-records-body.dto';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/casl/check-policies.decorator';
import { Action } from '../../../../shared/casl/actions.enum';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../../../shared/swagger/api-zod.decorator';

@ApiTags('Data View (Virtual Grid)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('datasets/:datasetId')
export class DataViewController {
  constructor(private readonly dataViewService: DataViewService) {}

  @Get('records')
  @ApiOperation({ summary: 'F5.1 (Wave 4): Keyset pagination cho Virtual Grid - { items, meta: { nextCursor, hasMore } }' })
  @ApiZodQuery(QueryRecordsSchema)
  @CheckPolicies((ability) => ability.can(Action.Read, 'DataRecord'))
  async getRecords(
    @Param('datasetId') datasetId: string,
    @Query(new ZodValidationPipe(QueryRecordsSchema)) query: QueryRecordsDto
  ) {
    return this.dataViewService.getRecords(datasetId, query);
  }

  @Post('records/query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'F5.4 (Wave 4): Truy van loc/sap xep/tim kiem tren props.cN + keyset pagination',
  })
  @ApiZodBody(QueryRecordsBodySchema)
  @CheckPolicies((ability) => ability.can(Action.Read, 'DataRecord'))
  async queryRecords(
    @Param('datasetId') datasetId: string,
    @Body(new ZodValidationPipe(QueryRecordsBodySchema)) body: QueryRecordsBodyDto,
  ) {
    return this.dataViewService.queryRecords(datasetId, body);
  }

  @Get('columns/:columnKey/stats')
  @ApiOperation({ summary: 'F5.3 (Wave 4): Thong ke cot theo key on dinh c{i} (chap nhan ca ten hien thi)' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Dataset'))
  async getColumnStats(
    @Param('datasetId') datasetId: string,
    @Param('columnKey') columnKey: string
  ) {
    const stats = await this.dataViewService.getColumnStats(datasetId, columnKey);
    return { stats };
  }
}
