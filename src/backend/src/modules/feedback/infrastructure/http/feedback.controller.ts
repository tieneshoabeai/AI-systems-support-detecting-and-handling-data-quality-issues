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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../../../shared/swagger/api-zod.decorator';
import {
  CreateFeedbackSchema,
  CreateFeedbackDto,
  UpdateFeedbackSchema,
  UpdateFeedbackDto,
  ListFeedbackQuerySchema,
  ListFeedbackQueryDto,
} from './dtos/feedback.dto';
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
  async createFindingFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('analysisId') analysisId: string,
    @Param('findingId') findingId: string,
    @Body(new ZodValidationPipe(CreateFeedbackSchema)) dto: CreateFeedbackDto,
  ) {
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
  async createRunFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('analysisId') analysisId: string,
    @Body(new ZodValidationPipe(CreateFeedbackSchema)) dto: CreateFeedbackDto,
  ) {
    return this.createRunFeedbackHandler.execute(user.userId, user.role, analysisId, dto);
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
  async listRunFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('analysisId') analysisId: string,
    @Query(new ZodValidationPipe(ListFeedbackQuerySchema)) query: ListFeedbackQueryDto,
  ) {
    return this.listRunFeedbackHandler.execute(user.userId, user.role, analysisId, query);
  }

  @Patch('feedback/:id')
  @ApiOperation({ summary: 'FB-05: Sửa nhận xét của chính mình' })
  @ApiZodBody(UpdateFeedbackSchema)
  async updateMine(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateFeedbackSchema)) dto: UpdateFeedbackDto,
  ) {
    return this.updateMineHandler.execute(user.userId, id, dto);
  }

  @Delete('feedback/:id')
  @ApiOperation({ summary: 'FB-05: Xoá nhận xét (chủ hoặc Owner xử lý vi phạm)' })
  async remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.removeHandler.execute(user.userId, user.role, id);
  }

  @Get('projects/:projectId/ai-quality-metrics')
  @ApiOperation({ summary: 'FB-06: Thống kê chất lượng AI theo project' })
  async aiQualityMetrics(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
  ) {
    return this.aiQualityMetricsHandler.execute(user.userId, user.role, projectId);
  }
}
