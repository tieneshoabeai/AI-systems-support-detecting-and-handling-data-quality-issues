import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RunAnalysisSchema, RunAnalysisDto } from '../dtos/run-analysis.dto';
import { JwtAuthGuard } from '../../../../shared/interfaces/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/interfaces/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/interfaces/casl/check-policies.decorator';
import { PolicyResource } from '../../../../shared/interfaces/casl/policy-resource.decorator';
import { Action } from '../../../../shared/domain/security/action';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/interfaces/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/interfaces/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../../../shared/interfaces/swagger/api-zod.decorator';
import { ProjectScopePolicyLoader } from '../../../projects';
import { AnalysisJobPolicyLoader } from '../../application/policy-loaders/analysis-job-policy.loader';
import { GetJobHandler } from '../../application/queries/get-job.handler';
import { GetResultHandler } from '../../application/queries/get-result.handler';
import { IngestAiResultHandler } from '../../application/commands/ingest-ai-result.handler';
import { RetryJobHandler } from '../../application/commands/retry-job.handler';
import { RunAnalysisHandler } from '../../application/commands/run-analysis.handler';
import { GetEvidenceSamplesHandler } from '../../application/queries/get-evidence-samples.handler';
import { AnalysisRunPolicyLoader } from '../../application/policy-loaders/analysis-run-policy.loader';
import { ListEvidenceSamplesQueryDto, ListEvidenceSamplesQuerySchema } from '../dtos/evidence-samples.dto';

@ApiTags('Analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class AnalysisController {
  constructor(
    private readonly ingestAiResultHandler: IngestAiResultHandler,
    private readonly retryJobHandler: RetryJobHandler,
    private readonly runAnalysisHandler: RunAnalysisHandler,
    private readonly getJobHandler: GetJobHandler,
    private readonly getResultHandler: GetResultHandler,
    private readonly getEvidenceSamplesHandler: GetEvidenceSamplesHandler,
  ) {}

  @Post('projects/:projectId/analysis')
  @ApiOperation({
    summary: 'ANALYSIS-02: Chạy phân tích hệ thống (đồng bộ) + tạo AI job corr-v1 (bất đồng bộ)',
    operationId: 'runAnalysis',
  })
  @ApiZodBody(RunAnalysisSchema)
  // UC-20 (chạy phân tích): PROJ-MEMBER trở lên.
  @PolicyResource('Analysis', ProjectScopePolicyLoader, 'projectId')
  @CheckPolicies((ability) => ability.can(Action.Execute, 'Analysis'))
  @ApiResponse({ status: 201, description: 'Tạo mới thành công' })
  async runAnalysis(
    @Param('projectId') projectId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(RunAnalysisSchema)) dto: RunAnalysisDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.runAnalysisHandler.execute(projectId, dto, user.userId);
    return data;
  }

  @Get('projects/:projectId/analysis/result')
  @ApiOperation({
    summary:
      'ANALYSIS-03: Kết quả phân tích (DQ-05 có điều kiện + ma trận tương quan + VIF + nhận xét AI)',
    operationId: 'getAnalysisResult',
  })
  @PolicyResource('Analysis', ProjectScopePolicyLoader, 'projectId')
  @CheckPolicies((ability) => ability.can(Action.Read, 'Analysis'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getResult(@Param('projectId') projectId: string): Promise<Record<string, unknown>> {
    return this.getResultHandler.execute(projectId);
  }

  @Get('analyses/:analysisRunId/evidence-samples')
  @ApiOperation({
    summary: 'ANALYSIS-04: Xem evidence samples đã che PII của một finding',
    operationId: 'listAnalysisEvidenceSamples',
  })
  @ApiZodQuery(ListEvidenceSamplesQuerySchema)
  @PolicyResource('Analysis', AnalysisRunPolicyLoader, 'analysisRunId')
  @CheckPolicies((ability) => ability.can(Action.Read, 'Analysis'))
  @ApiResponse({
    status: 200,
    description: 'Samples đã lưu; rowIndex bắt đầu từ 0 và không tính hàng tiêu đề.',
    schema: {
      type: 'object',
      required: ['items', 'meta'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['findingId', 'kind', 'column', 'rowIndex', 'reason', 'valueMasked'],
            properties: {
              findingId: { type: 'string' },
              kind: { type: 'string', enum: ['missing', 'duplicate', 'invalid_type', 'outlier'] },
              column: { type: 'string' },
              rowIndex: { type: 'integer', minimum: 0, description: 'Zero-based index của bản ghi dữ liệu, không tính hàng tiêu đề.' },
              reason: { type: 'string', nullable: true },
              valueMasked: { type: 'string', nullable: true, description: 'Giá trị đã che PII; không bao giờ trả raw value.' },
            },
          },
        },
        meta: {
          type: 'object',
          required: ['limit', 'hasMore', 'nextCursor'],
          properties: {
            limit: { type: 'integer' },
            hasMore: { type: 'boolean' },
            nextCursor: { type: 'string', nullable: true, description: 'Cursor dùng để lấy trang tiếp theo.' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Query hoặc findingId không hợp lệ' })
  @ApiResponse({ status: 403, description: 'Không có quyền đọc Analysis' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy Analysis run' })
  async listEvidenceSamples(
    @Param('analysisRunId') analysisRunId: string,
    @Query(new ZodValidationPipe(ListEvidenceSamplesQuerySchema)) query: ListEvidenceSamplesQueryDto,
  ) {
    return this.getEvidenceSamplesHandler.execute(analysisRunId, query);
  }

  @Get('analysis/jobs/:jobId')
  @ApiOperation({ summary: 'AI-01: Trạng thái AI job corr-v1', operationId: 'getAiJob' })
  // UC-21 (xem trạng thái job AI): mọi vai trò đọc được project đều xem được.
  @PolicyResource('Analysis', AnalysisJobPolicyLoader, 'jobId')
  @CheckPolicies((ability) => ability.can(Action.Read, 'Analysis'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getJob(@Param('jobId') jobId: string): Promise<Record<string, unknown>> {
    return this.getJobHandler.execute(jobId);
  }

  @Post('analysis/jobs/:jobId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'AI-01: Thử lại AI job (không giới hạn — job cũ thành skipped)', operationId: 'retryAiJob' })
  // UC-22 (thử lại AI): PROJ-MEMBER trở lên.
  @PolicyResource('Analysis', AnalysisJobPolicyLoader, 'jobId')
  @CheckPolicies((ability) => ability.can(Action.Execute, 'Analysis'))
  @ApiResponse({ status: 202, description: 'Đã tiếp nhận yêu cầu (xử lý bất đồng bộ)' })
  async retryJob(@Param('jobId') jobId: string): Promise<Record<string, unknown>> {
    return this.retryJobHandler.execute(jobId);
  }

  @Post('analysis/jobs/:jobId/result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI nội bộ: Gắn kết quả AI corr-v1 đã grounding vào analysis_result',
    operationId: 'ingestAiResult',
  })
  @PolicyResource('Analysis', AnalysisJobPolicyLoader, 'jobId')
  @CheckPolicies((ability) => ability.can(Action.Execute, 'Analysis'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async ingestAiResult(
    @Param('jobId') jobId: string,
    @Body() body: { result: unknown; modelId?: string },
  ): Promise<Record<string, unknown>> {
    const raw = (body?.result ?? {}) as unknown;
    const modelId = typeof body?.modelId === 'string' ? body.modelId : undefined;
    return this.ingestAiResultHandler.execute(jobId, raw, modelId);
  }
}
