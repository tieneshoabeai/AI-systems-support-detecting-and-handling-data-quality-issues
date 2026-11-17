import { Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuditService } from '../../../audit/application/audit.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnalysisService } from '../../application/analysis.service';
import { RunAnalysisSchema, RunAnalysisDto } from './dtos/run-analysis.dto';
import { AnalysisConfigSchema } from './dtos/analysis-config.dto';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/casl/check-policies.decorator';
import { Action } from '../../../../shared/casl/actions.enum';
import { CurrentUser, CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../../../shared/swagger/api-zod.decorator';

@ApiTags('Analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly audit: AuditService,
  ) {}

  @Post('projects/:projectId/analysis/config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ANALYSIS-01: Lưu cấu hình cột phân tích (selected/label/time/value + phương pháp)', operationId: 'saveAnalysisConfig' })
  @ApiZodBody(AnalysisConfigSchema)
  @CheckPolicies((ability) => ability.can(Action.Execute, 'Analysis'))
  async saveConfig(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(AnalysisConfigSchema)) dto: unknown,
  ) {
    return this.analysisService.saveConfig(projectId, dto as never);
  }

  @Get('projects/:projectId/analysis/config')
  @ApiOperation({ summary: 'ANALYSIS-01: Xem cấu hình cột phân tích', operationId: 'getAnalysisConfig' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Analysis'))
  async getConfig(@Param('projectId') projectId: string) {
    return this.analysisService.getConfig(projectId);
  }

  @Post('projects/:projectId/analysis')
  @ApiOperation({ summary: 'ANALYSIS-02: Chạy phân tích hệ thống (đồng bộ) + tạo AI job corr-v1 (bất đồng bộ)', operationId: 'runAnalysis' })
  @ApiZodBody(RunAnalysisSchema)
  @CheckPolicies((ability) => ability.can(Action.Execute, 'Analysis'))
  async runAnalysis(
    @Param('projectId') projectId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(RunAnalysisSchema)) dto: RunAnalysisDto,
  ) {
    const data = await this.analysisService.runAnalysis(projectId, dto, user.userId);
    return data;
  }

  @Get('projects/:projectId/analysis/result')
  @ApiOperation({ summary: 'ANALYSIS-03: Kết quả phân tích (DQ-05 có điều kiện + ma trận tương quan + VIF + nhận xét AI)', operationId: 'getAnalysisResult' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Analysis'))
  async getResult(@Param('projectId') projectId: string) {
    return this.analysisService.getResult(projectId);
  }

  @Get('analysis/jobs/:jobId')
  @ApiOperation({ summary: 'AI-01: Trạng thái AI job corr-v1', operationId: 'getAiJob' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Analysis'))
  async getJob(@Param('jobId') jobId: string, @CurrentUser() user: CurrentUserPayload) {
    await this.analysisService.assertJobAccess(jobId, user);
    return this.analysisService.getJob(jobId);
  }

  @Post('analysis/jobs/:jobId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'AI-01: Thử lại AI job (tối đa 2 retry)', operationId: 'retryAiJob' })
  @CheckPolicies((ability) => ability.can(Action.Execute, 'Analysis'))
  async retryJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    await this.analysisService.assertJobAccess(jobId, user, true);
    const out = await this.analysisService.retryJob(jobId);
    await this.audit.log({
      actorId: user?.userId ?? null,
      actorRole: user?.role ?? null,
      action: 'AI_JOB_RETRIED',
      targetType: 'ai_job',
      targetId: jobId,
      ipAddress: (req.ip ?? null) as string | null,
      userAgent: (req.headers['user-agent'] as string) ?? null,
      metadata: { jobId, attempt: out.attempt ?? null },
    });
    return out;
  }

  @Post('analysis/jobs/:jobId/result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI nội bộ (chỉ SYS-ADMIN): Gắn kết quả AI corr-v1 đã grounding vào analysis_result', operationId: 'ingestAiResult' })
  // Phan 6 v7 muc 3.20: chi SYS-ADMIN (Manage all) — user thuong khong duoc tu gan nhan xet AI
  @CheckPolicies((ability) => ability.can(Action.Manage, 'all'))
  async ingestAiResult(
    @Param('jobId') jobId: string,
    @Body() body: { result: unknown; modelId?: string },
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    const raw = (body?.result ?? {}) as unknown;
    const modelId = typeof body?.modelId === 'string' ? body.modelId : undefined;
    const out = await this.analysisService.ingestAiResult(jobId, raw, modelId);
    await this.audit.log({
      actorId: user?.userId ?? null,
      actorRole: user?.role ?? null,
      action: 'AI_RESULT_INGESTED',
      targetType: 'ai_job',
      targetId: jobId,
      ipAddress: (req.ip ?? null) as string | null,
      userAgent: (req.headers['user-agent'] as string) ?? null,
      metadata: { jobId, status: out.status ?? null, modelId: modelId ?? null },
    });
    return out;
  }
}
