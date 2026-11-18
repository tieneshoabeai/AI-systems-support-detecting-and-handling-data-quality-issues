import {
  Inject,
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/interfaces/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/interfaces/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/interfaces/casl/check-policies.decorator';
import { PolicyResource } from '../../../../shared/interfaces/casl/policy-resource.decorator';
import { Action } from '../../../../shared/domain/security/action';
import { AUDIT_LOGGER_PORT, type AuditLoggerPort } from '../../../audit';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/interfaces/decorators/current-user.decorator';
import type { Response, Request } from 'express';
import { ProjectScopePolicyLoader } from '../../../projects';
import { DownloadReportFileHandler } from '../../application/queries/download-report-file.handler';
import { GetReportFileMetaHandler } from '../../application/queries/get-report-file-meta.handler';
import { RequestReportHandler } from '../../application/commands/request-report.handler';

@ApiTags('Report')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class ReportController {
  constructor(
    private readonly requestReportHandler: RequestReportHandler,

    private readonly downloadReportFileHandler: DownloadReportFileHandler,

    private readonly getReportFileMetaHandler: GetReportFileMetaHandler,
    @Inject(AUDIT_LOGGER_PORT)
    private readonly audit: AuditLoggerPort,
  ) {}

  @Post('projects/:projectId/report')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'REPORT-01: Yêu cầu sinh PDF ở worker (202, không sinh tại API)',
    operationId: 'requestReport',
  })
  // UC-23 (tạo Tổng kết): PROJ-MEMBER trở lên.
  @PolicyResource('Analysis', ProjectScopePolicyLoader, 'projectId')
  @CheckPolicies((ability) => ability.can(Action.Execute, 'Analysis'))
  async request(@Param('projectId') projectId: string): Promise<Record<string, unknown>> {
    return this.requestReportHandler.execute(projectId);
  }

  @Get('projects/:projectId/report/:reportId/file')
  @ApiOperation({
    summary: 'REPORT-01: Tải file PDF do worker sinh',
    operationId: 'downloadReport',
  })
  // UC-26 (tải PDF Tổng kết): PROJ-VIEWER cũng được tải.
  @PolicyResource('Analysis', ProjectScopePolicyLoader, 'projectId')
  @CheckPolicies((ability) => ability.can(Action.Read, 'Analysis'))
  async download(
    @Param('projectId') projectId: string,
    @Param('reportId') reportId: string,
    @CurrentUser() actor: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const meta = await this.getReportFileMetaHandler.execute(projectId, reportId);
    if (meta.status !== 'succeeded') {
      res.status(202).json(meta);
      return;
    }
    try {
      const { stream, fileSizeBytes } = await this.downloadReportFileHandler.execute(
        projectId,
        reportId,
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''report-${reportId}.pdf`);
      if (typeof fileSizeBytes === 'number') res.setHeader('Content-Length', String(fileSizeBytes));
      await this.audit.log({
        actorId: actor?.userId ?? null,
        actorRole: ((actor as unknown as Record<string, unknown>)?.role as string) ?? null,
        action: 'REPORT_FILE_DOWNLOADED',
        targetType: 'report',
        targetId: reportId,
        projectId,
        ipAddress: (req.ip ?? null) as string | null,
        userAgent: (req.headers['user-agent'] as string) ?? null,
        metadata: { projectId, reportId, fileSizeBytes: fileSizeBytes ?? null },
      });
      stream.pipe(res);
    } catch {
      res.status(202).json(meta);
    }
  }
}
