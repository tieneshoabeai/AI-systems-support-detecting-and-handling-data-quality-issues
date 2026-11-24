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
import { JwtAuthGuard } from '../../shared/interfaces/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../shared/interfaces/casl/policies.guard';
import { CheckPolicies } from '../../shared/interfaces/casl/check-policies.decorator';
import { PolicyResource } from '../../shared/interfaces/casl/policy-resource.decorator';
import { Action } from '../../shared/domain/security/action';
import { ZodValidationPipe } from '../../shared/interfaces/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../shared/interfaces/swagger/api-zod.decorator';
import { DataViewService } from './data-view.service';
import { DatasetPolicyLoader } from '../datasets';
import type { CursorPaginatedResponse } from '../../shared/domain/pagination/cursor-paginated.response';
import type { RecordRow } from '../datasets';
import type { ColumnStatsResult } from './data-view.types';
import type { ChartDataResult } from './data-view.types';

import { z } from 'zod';

// --- DTO gop tu presentation/dtos (Template Simple: DTO 1 noi trong controller) ---
export const QueryRecordsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sort_field: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
});

export type QueryRecordsDto = z.infer<typeof QueryRecordsSchema>;

/**
 * Phần 7 v6 mục 3.7 — Bộ lọc Data Views.
 * Lọc + sắp xếp + tìm kiếm chạy phía server (MongoDB) để không tải toàn bộ
 * 200.000 bản ghi vào bộ nhớ/JS. Phân trang bằng cursor (keyset) theo row_index.
 */

export const RecordFilterOperatorSchema = z.enum([
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'between',
  'in',
  'isEmpty',
  'isNotEmpty',
]);

export type RecordFilterOperator = z.infer<typeof RecordFilterOperatorSchema>;

export const RecordFilterSchema = z
  .object({
    column: z.string().min(1).max(120),
    operator: RecordFilterOperatorSchema,
    value: z.unknown().optional(),
  })
  .refine(
    (f) : boolean =>
      f.operator === 'isEmpty' ||
      f.operator === 'isNotEmpty' ||
      (f.value !== undefined && f.value !== null && f.value !== ''),
    { message: 'Bộ lọc yêu cầu có value (trừ isEmpty/isNotEmpty)' },
  )
  .refine((f) : boolean => f.operator !== 'between' || (Array.isArray(f.value) && f.value.length === 2), {
    message: 'Bộ lọc "between" yêu cầu value là mảng 2 phần tử [min, max]',
  })
  .refine((f) : boolean => f.operator !== 'in' || (Array.isArray(f.value) && f.value.length > 0), {
    message: 'Bộ lọc "in" yêu cầu value là mảng khác rỗng',
  });

export type RecordFilterDto = z.infer<typeof RecordFilterSchema>;

export const RecordSortSchema = z.object({
  column: z.string().min(1).max(120),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type RecordSortDto = z.infer<typeof RecordSortSchema>;

export const RecordSearchSchema = z.object({
  columns: z.array(z.string().min(1).max(120)).min(1).max(20),
  value: z.string().max(200),
});

export type RecordSearchDto = z.infer<typeof RecordSearchSchema>;

export const QueryRecordsBodySchema = z.object({
  filters: z.array(RecordFilterSchema).max(30).optional().default([]),
  sort: z.array(RecordSortSchema).max(5).optional().default([]),
  search: RecordSearchSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type QueryRecordsBodyDto = z.infer<typeof QueryRecordsBodySchema>;

/**
 * GĐ6 — Tham số truy vấn dữ liệu biểu đồ.
 *
 * `top_n` mặc định 5, giới hạn 1–20 (mục 3.21 feature catalog).
 */
export const ChartDataSchema = z.object({
  columns: z.string().optional(),
  top_n: z.coerce.number().int().min(1).max(20).default(5),
  max_rows: z.coerce.number().int().min(1).max(50_000).optional(),
});

export type ChartDataDto = z.infer<typeof ChartDataSchema>;

@ApiTags('Data View (Virtual Grid)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('datasets/:datasetId')
export class DataViewController {
  constructor(private readonly dataViewService: DataViewService) {}

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
    return this.dataViewService.getRecords(datasetId, query);
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
    return this.dataViewService.queryRecords(datasetId, body);
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
    const stats = await this.dataViewService.getColumnStats(datasetId, columnKey);
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
    const charts = await this.dataViewService.getChartData(datasetId, {
      columns: query.columns
        ? query.columns.split(',').map((c) => c.trim()).filter((c) => c.length > 0)
        : undefined,
      topN: query.top_n,
      maxRows: query.max_rows,
    });
    return { charts };
  }
}
