import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DataViewService } from './data-view.service';
import { QueryRecordsSchema, QueryRecordsDto } from './dto/query-records.dto';
import { UpdateCellSchema, UpdateCellDto } from './dto/update-cell.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../shared/casl/policies.guard';
import { CheckPolicies } from '../../shared/casl/check-policies.decorator';
import { Action } from '../../shared/casl/actions.enum';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../shared/swagger/api-zod.decorator';

@ApiTags('Data View (Virtual Grid)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('datasets/:datasetId')
export class DataViewController {
  constructor(private readonly dataViewService: DataViewService) {}

  @Get('records')
  @ApiOperation({ summary: 'F5.1: Phân trang Cursor/Keyset siêu tốc cho Virtual Grid' })
  @ApiZodQuery(QueryRecordsSchema)
  @CheckPolicies((ability) => ability.can(Action.Read, 'DataRecord'))
  async getRecords(
    @Param('datasetId') datasetId: string,
    @Query(new ZodValidationPipe(QueryRecordsSchema)) query: QueryRecordsDto
  ) {
    return this.dataViewService.getRecords(datasetId, query);
  }

  @Patch('records/:rowIndex')
  @ApiOperation({ summary: 'F5.2: In-place Cell Edit sửa ô dữ liệu trực tiếp trong lưới' })
  @ApiZodBody(UpdateCellSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'DataRecord'))
  async updateCell(
    @Param('datasetId') datasetId: string,
    @Param('rowIndex', ParseIntPipe) rowIndex: number,
    @Body(new ZodValidationPipe(UpdateCellSchema)) dto: UpdateCellDto
  ) {
    const record = await this.dataViewService.updateCell(datasetId, rowIndex, dto);
    return {
      message: 'Cập nhật ô dữ liệu thành công',
      record,
    };
  }

  @Get('columns/:columnName/stats')
  @ApiOperation({ summary: 'F5.3: Thống kê cột và biểu đồ phân phối Histogram 10 khoảng' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Dataset'))
  async getColumnStats(
    @Param('datasetId') datasetId: string,
    @Param('columnName') columnName: string
  ) {
    const stats = await this.dataViewService.getColumnStats(datasetId, columnName);
    return { stats };
  }
}
