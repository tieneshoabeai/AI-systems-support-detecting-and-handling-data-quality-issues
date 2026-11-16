import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RunAnalysisSchema, RunAnalysisDto } from './dtos/run-analysis.dto';
import { AnalysisConfigSchema } from './dtos/analysis-config.dto';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/casl/check-policies.decorator';
import { Action } from '../../../../shared/casl/actions.enum';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../../../shared/swagger/api-zod.decorator';
import { GetConfigHandler } from '../../application/queries/get-config.handler';
import { GetJobHandler } from '../../application/queries/get-job.handler';
import { GetResultHandler } from '../../application/queries/get-result.handler';
import { IngestAiResultHandler } from '../../application/commands/ingest-ai-result.handler';
import { RetryJobHandler } from '../../application/commands/retry-job.handler';
import { RunAnalysisHandler } from '../../application/commands/run-analysis.handler';
import { SaveConfigHandler } from '../../application/commands/save-config.handler';

@ApiTags('Analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class AnalysisController {
  constructor(
    private readonly ingestAiResultHandler: IngestAiResultHandler,
    private readonly retryJobHandler: RetryJobHandler,
    private readonly runAnalysisHandler: RunAnalysisHandler,
    private readonly saveConfigHandler: SaveConfigHandler,
    private readonly getConfigHandler: GetConfigHandler,
    private readonly getJobHandler: GetJobHandler,
    private readonly getResultHandler: GetResultHandler,
  ) {}

  @Post('projects/:projectId/analysis/config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'ANALYSIS-01: Lưu cấu hình cột phân tích (selected/label/time/value + phương pháp)',
    operationId: 'saveAnalysisConfig',
  })
  @ApiZodBody(AnalysisConfigSchema)
  @CheckPolicies((ability) => ability.can(Action.Execute, 'Analysis'))
  async saveConfig(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(AnalysisConfigSchema)) dto: unknown,
  ) {
    return this.saveConfigHandler.execute(projectId, dto as never);
  }

  @Get('projects/:projectId/analysis/config')
  @ApiOperation({
    summary: 'ANALYSIS-01: Xem cấu hình cột phân tích',
    operationId: 'getAnalysisConfig',
  })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Analysis'))
  async getConfig(@Param('projectId') projectId: string) {
    return this.getConfigHandler.execute(projectId);
  }

  @Post('projects/:projectId/analysis')
  @ApiOperation({
    summary: 'ANALYSIS-02: Chạy phân tích hệ thống (đồng bộ) + tạo AI job corr-v1 (bất đồng bộ)',
    operationId: 'runAnalysis',
  })
  @ApiZodBody(RunAnalysisSchema)
  @CheckPolicies((ability) => ability.can(Action.Execute, 'Analysis'))
  async runAnalysis(
    @Param('projectId') projectId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(RunAnalysisSchema)) dto: RunAnalysisDto,
  ) {
    const data = await this.runAnalysisHandler.execute(projectId, dto, user.userId);
    return data;
  }

  @Get('projects/:projectId/analysis/result')
  @ApiOperation({
    summary:
      'ANALYSIS-03: Kết quả phân tích (DQ-05 có điều kiện + ma trận tương quan + VIF + nhận xét AI)',
    operationId: 'getAnalysisResult',
  })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Analysis'))
  async getResult(@Param('projectId') projectId: string) {
    return this.getResultHandler.execute(projectId);
  }

  @Get('analysis/jobs/:jobId')
  @ApiOperation({ summary: 'AI-01: Trạng thái AI job corr-v1', operationId: 'getAiJob' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Analysis'))
  async getJob(@Param('jobId') jobId: string) {
    return this.getJobHandler.execute(jobId);
  }

  @Post('analysis/jobs/:jobId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'AI-01: Thử lại AI job (tối đa 2 retry)', operationId: 'retryAiJob' })
  @CheckPolicies((ability) => ability.can(Action.Execute, 'Analysis'))
  async retryJob(@Param('jobId') jobId: string) {
    return this.retryJobHandler.execute(jobId);
  }

  @Post('analysis/jobs/:jobId/result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI nội bộ: Gắn kết quả AI corr-v1 đã grounding vào analysis_result',
    operationId: 'ingestAiResult',
  })
  @CheckPolicies((ability) => ability.can(Action.Execute, 'Analysis'))
  async ingestAiResult(
    @Param('jobId') jobId: string,
    @Body() body: { result: unknown; modelId?: string },
  ) {
    const raw = (body?.result ?? {}) as unknown;
    const modelId = typeof body?.modelId === 'string' ? body.modelId : undefined;
    return this.ingestAiResultHandler.execute(jobId, raw, modelId);
  }
}
