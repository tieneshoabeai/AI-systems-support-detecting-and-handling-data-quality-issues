/** FEEDBACK — Routes (Template Simple). Gop controller + DTO inline. Giu nguyen route + guard. */
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
import { JwtAuthGuard } from '../../shared/interfaces/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../shared/interfaces/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../shared/interfaces/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../shared/interfaces/swagger/api-zod.decorator';
import { z } from 'zod';
import { FeedbackService } from './feedback.service';

// --- DTO gop tu presentation/dtos (Template Simple: DTO 1 noi trong routes) ---

export const FeedbackLabelSchema = z.enum([
  'correct',
  'partially_correct',
  'false_positive',
  'missed_issue',
  'other',
]);

export const FeedbackSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const CreateFeedbackSchema = z
  .object({
    label: FeedbackLabelSchema,
    reason: z.string().max(2000).optional().nullable(),
    suggestedSeverity: FeedbackSeveritySchema.optional().nullable(),
  })
  .superRefine((v, ctx) : void => {
    if (
      (v.label === 'false_positive' || v.label === 'missed_issue' || v.label === 'other') &&
      (!v.reason || v.reason.trim().length === 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Nhãn này bắt buộc kèm lý do (reason)',
        path: ['reason'],
      });
    }
  });

export type CreateFeedbackDto = z.infer<typeof CreateFeedbackSchema>;

export const UpdateFeedbackSchema = z
  .object({
    label: FeedbackLabelSchema.optional(),
    reason: z.string().max(2000).optional().nullable(),
    suggestedSeverity: FeedbackSeveritySchema.optional().nullable(),
  })
  .refine((v) : boolean => v.label !== undefined || v.reason !== undefined || v.suggestedSeverity !== undefined, {
    message: 'Phải cung cấp ít nhất một trường để sửa',
  });

export type UpdateFeedbackDto = z.infer<typeof UpdateFeedbackSchema>;

export const ListFeedbackQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  label: FeedbackLabelSchema.optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListFeedbackQueryDto = z.infer<typeof ListFeedbackQuerySchema>;

@ApiTags('Feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

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
    return this.feedbackService.createFindingFeedback(
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
    return this.feedbackService.createRunFeedback(user.userId, user.role, analysisId, dto);
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
    return this.feedbackService.listFindingFeedback(
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
    return this.feedbackService.listRunFeedback(user.userId, user.role, analysisId, query);
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
    return this.feedbackService.updateMine(user.userId, user.role, id, dto);
  }

  @Delete('feedback/:id')
  @ApiOperation({ summary: 'FB-05: Xoá nhận xét (chủ, Owner xử lý vi phạm, hoặc System Admin kiểm duyệt)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string): Promise<{ deleted: boolean; }> {
    return this.feedbackService.remove(user.userId, user.role, id);
  }

  @Get('projects/:projectId/ai-quality-metrics')
  @ApiOperation({ summary: 'FB-06: Thống kê chất lượng AI theo project (System Admin bị chặn)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async aiQualityMetrics(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
  ): Promise<Record<string, unknown>> {
    return this.feedbackService.aiQualityMetrics(user.userId, user.role, projectId);
  }
}
