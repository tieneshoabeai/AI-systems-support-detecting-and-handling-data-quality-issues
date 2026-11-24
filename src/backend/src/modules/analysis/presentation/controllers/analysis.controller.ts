import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { ApiZodBody } from '../../../../shared/interfaces/swagger/api-zod.decorator';
import { ProjectScopePolicyLoader } from '../../../projects';
import { AnalysisJobPolicyLoader } from '../../application/policy-loaders/analysis-job-policy.loader';
import { GetJobHandler } from '../../application/queries/get-job.handler';
import { GetResultHandler } from '../../application/queries/get-result.handler';
import { IngestAiResultHandler } from '../../application/commands/ingest-ai-result.handler';
import { RetryJobHandler } from '../../application/commands/retry-job.handler';
import { RunAnalysisHandler } from '../../application/commands/run-analysis.handler';
import { NotFoundError } from '../../../../shared/domain/errors';

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
    // @Optional: test module tự khai provider (vd e2e analysis-report-summary) không cần ConfigService.
    @Optional() private readonly config?: ConfigService,
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
  async retryJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Record<string, unknown>> {
    return this.retryJobHandler.execute(jobId, { userId: user.userId, role: user.role ?? null });
  }

  @Post('analysis/jobs/:jobId/result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI nội bộ: Gắn kết quả AI corr-v1 đã grounding vào analysis_result (chỉ SYS-ADMIN, tắt ở production)',
    operationId: 'ingestAiResult',
  })
  // Phần 6 v9 §3.22 / Phần 7 v15 §3.25 VA-1: chỉ SYS-ADMIN (rule `manage all` chỉ admin có);
  // worker AI gọi thẳng IngestAiResultHandler, không qua route này.
  @PolicyResource('Analysis', AnalysisJobPolicyLoader, 'jobId')
  @CheckPolicies((ability) => ability.can(Action.Manage, 'all'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 404, description: 'Tắt khi NODE_ENV=production' })
  async ingestAiResult(
    @Param('jobId') jobId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { result: unknown; modelId?: string },
  ): Promise<Record<string, unknown>> {
    // Thiếu ConfigService vẫn đọc NODE_ENV để không vô tình mở route ở production.
    const nodeEnv = this.config?.get<string>('NODE_ENV') ?? process.env.NODE_ENV;
    if (nodeEnv === 'production') {
      throw new NotFoundError('Không tìm thấy tài nguyên');
    }
    const raw = (body?.result ?? {}) as unknown;
    const modelId = typeof body?.modelId === 'string' ? body.modelId : undefined;
    return this.ingestAiResultHandler.execute(jobId, raw, modelId, {
      userId: user.userId,
      role: user.role ?? null,
    });
  }
}
