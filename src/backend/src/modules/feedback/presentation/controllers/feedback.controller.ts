import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/interfaces/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/interfaces/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/interfaces/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../../../shared/interfaces/swagger/api-zod.decorator';
import {
  CreateFeedbackSchema,
  CreateFeedbackDto,
  UpdateFeedbackSchema,
  UpdateFeedbackDto,
  ListFeedbackQuerySchema,
  ListFeedbackQueryDto,
} from '../dtos/feedback.dto';
import { AiQualityMetricsHandler } from '../../application/commands/ai-quality-metrics.handler';
import { CreateFindingFeedbackHandler } from '../../application/commands/create-finding-feedback.handler';
import { CreateRunFeedbackHandler } from '../../application/commands/create-run-feedback.handler';
import { ListFindingFeedbackHandler } from '../../application/queries/list-finding-feedback.handler';
import { ListRunFeedbackHandler } from '../../application/queries/list-run-feedback.handler';
import { RemoveHandler } from '../../application/commands/remove.handler';
import { UpdateMineHandler } from '../../application/commands/update-mine.handler';

@ApiTags('Feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class FeedbackController {
  constructor(
    private readonly aiQualityMetricsHandler: AiQualityMetricsHandler,
    private readonly createFindingFeedbackHandler: CreateFindingFeedbackHandler,
    private readonly createRunFeedbackHandler: CreateRunFeedbackHandler,
    private readonly removeHandler: RemoveHandler,
    private readonly updateMineHandler: UpdateMineHandler,
    private readonly listFindingFeedbackHandler: ListFindingFeedbackHandler,
    private readonly listRunFeedbackHandler: ListRunFeedbackHandler,
  ) {}

  @Post('analyses/:analysisId/findings/:findingId/feedback')
  @ApiOperation({ summary: 'FB-01: Nhận xét một phát hiện' })
  @ApiZodBody(CreateFeedbackSchema)
  @ApiResponse({ status: 201, description: 'Tạo mới thành công' })
  async createFindingFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('analysisId') analysisId: string,
    @Param('findingId') findingId: string,
    @Body(new ZodValidationPipe(CreateFeedbackSchema)) dto: CreateFeedbackDto,
  ): Promise<Record<string, unknown>> {
    return this.createFindingFeedbackHandler.execute(
      user.userId,
      user.role,
      analysisId,
      findingId,
      dto,
    );
  }

  @Post('analyses/:analysisId/feedback')
  @ApiOperation({ summary: 'FB-02: Nhận xét cả lần phân tích' })
  @ApiZodBody(CreateFeedbackSchema)
  @ApiResponse({ status: 201, description: 'Tạo mới thành công' })
  async createRunFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('analysisId') analysisId: string,
    @Body(new ZodValidationPipe(CreateFeedbackSchema)) dto: CreateFeedbackDto,
  ): Promise<Record<string, unknown>> {
    return this.createRunFeedbackHandler.execute(user.userId, user.role, analysisId, dto);
  }

  @Get('analyses/:analysisId/findings/:findingId/feedback')
  @ApiOperation({ summary: 'FB-03: Xem nhận xét của một phát hiện' })
  @ApiZodQuery(ListFeedbackQuerySchema)
  @ApiResponse({ status: 200, description: 'Thành công' })
  async listFindingFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('analysisId') analysisId: string,
    @Param('findingId') findingId: string,
    @Query(new ZodValidationPipe(ListFeedbackQuerySchema)) query: ListFeedbackQueryDto,
  ): Promise<{ items: Record<string, unknown>[]; meta: { nextCursor: string | null; hasMore: boolean; }; summary: Record<string, number>; }> {
    return this.listFindingFeedbackHandler.execute(
      user.userId,
      user.role,
      analysisId,
      findingId,
      query,
    );
  }

  @Get('analyses/:analysisId/feedback')
  @ApiOperation({ summary: 'FB-04: Xem nhận xét của một lần phân tích' })
  @ApiZodQuery(ListFeedbackQuerySchema)
  @ApiResponse({ status: 200, description: 'Thành công' })
  async listRunFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('analysisId') analysisId: string,
    @Query(new ZodValidationPipe(ListFeedbackQuerySchema)) query: ListFeedbackQueryDto,
  ): Promise<{ items: Record<string, unknown>[]; meta: { nextCursor: string | null; hasMore: boolean; }; summary: Record<string, number>; }> {
    return this.listRunFeedbackHandler.execute(user.userId, user.role, analysisId, query);
  }

  @Patch('feedback/:id')
  @ApiOperation({ summary: 'FB-05: Sửa nhận xét của chính mình (System Admin bị chặn)' })
  @ApiZodBody(UpdateFeedbackSchema)
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 403, description: 'System Admin không có quyền với nhóm nhận xét' })
  async updateMine(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateFeedbackSchema)) dto: UpdateFeedbackDto,
  ): Promise<Record<string, unknown>> {
    return this.updateMineHandler.execute(user.userId, user.role, id, dto);
  }

  @Delete('feedback/:id')
  @ApiOperation({ summary: 'FB-05: Xoá nhận xét (chủ, Owner xử lý vi phạm, hoặc System Admin kiểm duyệt)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string): Promise<{ deleted: boolean; }> {
    return this.removeHandler.execute(user.userId, user.role, id);
  }

  @Get('projects/:projectId/ai-quality-metrics')
  @ApiOperation({ summary: 'FB-06: Thống kê chất lượng AI theo project (System Admin bị chặn)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async aiQualityMetrics(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
  ): Promise<Record<string, unknown>> {
    return this.aiQualityMetricsHandler.execute(user.userId, user.role, projectId);
  }
}
