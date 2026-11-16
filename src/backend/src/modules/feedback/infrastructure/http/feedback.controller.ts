import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../../../shared/swagger/api-zod.decorator';
import { FeedbackService } from '../../application/feedback.service';
import {
  CreateFeedbackSchema,
  CreateFeedbackDto,
  UpdateFeedbackSchema,
  UpdateFeedbackDto,
  ListFeedbackQuerySchema,
  ListFeedbackQueryDto,
} from './dtos/feedback.dto';

@ApiTags('Feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post('analyses/:analysisId/findings/:findingId/feedback')
  @ApiOperation({ summary: 'FB-01: Nhận xét một phát hiện' })
  @ApiZodBody(CreateFeedbackSchema)
  async createFindingFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('analysisId') analysisId: string,
    @Param('findingId') findingId: string,
    @Body(new ZodValidationPipe(CreateFeedbackSchema)) dto: CreateFeedbackDto,
  ) {
    return this.feedbackService.createFindingFeedback(user.userId, user.role, analysisId, findingId, dto);
  }

  @Post('analyses/:analysisId/feedback')
  @ApiOperation({ summary: 'FB-02: Nhận xét cả lần phân tích' })
  @ApiZodBody(CreateFeedbackSchema)
  async createRunFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('analysisId') analysisId: string,
    @Body(new ZodValidationPipe(CreateFeedbackSchema)) dto: CreateFeedbackDto,
  ) {
    return this.feedbackService.createRunFeedback(user.userId, user.role, analysisId, dto);
  }

  @Get('analyses/:analysisId/findings/:findingId/feedback')
  @ApiOperation({ summary: 'FB-03: Xem nhận xét của một phát hiện' })
  @ApiZodQuery(ListFeedbackQuerySchema)
  async listFindingFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('analysisId') analysisId: string,
    @Param('findingId') findingId: string,
    @Query(new ZodValidationPipe(ListFeedbackQuerySchema)) query: ListFeedbackQueryDto,
  ) {
    return this.feedbackService.listFindingFeedback(user.userId, user.role, analysisId, findingId, query);
  }

  @Get('analyses/:analysisId/feedback')
  @ApiOperation({ summary: 'FB-04: Xem nhận xét của một lần phân tích' })
  @ApiZodQuery(ListFeedbackQuerySchema)
  async listRunFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('analysisId') analysisId: string,
    @Query(new ZodValidationPipe(ListFeedbackQuerySchema)) query: ListFeedbackQueryDto,
  ) {
    return this.feedbackService.listRunFeedback(user.userId, user.role, analysisId, query);
  }

  @Patch('feedback/:id')
  @ApiOperation({ summary: 'FB-05: Sửa nhận xét của chính mình' })
  @ApiZodBody(UpdateFeedbackSchema)
  async updateMine(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateFeedbackSchema)) dto: UpdateFeedbackDto,
  ) {
    return this.feedbackService.updateMine(user.userId, id, dto);
  }

  @Delete('feedback/:id')
  @ApiOperation({ summary: 'FB-05: Xoá nhận xét (chủ hoặc Owner xử lý vi phạm)' })
  async remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.feedbackService.remove(user.userId, user.role, id);
  }

  @Get('projects/:projectId/ai-quality-metrics')
  @ApiOperation({ summary: 'FB-06: Thống kê chất lượng AI theo project' })
  async aiQualityMetrics(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
  ) {
    return this.feedbackService.aiQualityMetrics(user.userId, user.role, projectId);
  }
}
