import { Controller, Get, Post, Param, UseGuards, HttpCode, HttpStatus, Res, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/casl/check-policies.decorator';
import { Action } from '../../../../shared/casl/actions.enum';
import { ReportService } from '../../application/report.service';
import { ProjectAccessService } from '../../application/project-access.service';
import { AuditService } from '../../../audit/application/audit.service';
import { CurrentUser, CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
import type { Response, Request } from 'express';

@ApiTags('Report')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly audit: AuditService,
    private readonly access: ProjectAccessService,
  ) {}

  @Post('projects/:projectId/report')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'REPORT-01: Yêu cầu sinh PDF ở worker (202, không sinh tại API) — Viewer được phép', operationId: 'requestReport' })
  // Phan 6 v7 muc 3.21: Viewer duoc yeu cau sinh + tai PDF (quyet dinh 2026-11-17) -> chi can quyen Read
  @CheckPolicies((ability) => ability.can(Action.Read, 'Analysis'))
  async request(@Param('projectId') projectId: string, @CurrentUser() actor: CurrentUserPayload) {
    await this.access.assertProjectAccess(projectId, actor, 'read');
    return this.reportService.requestReport(projectId);
  }

  @Get('projects/:projectId/report/:reportId/file')
  @ApiOperation({ summary: 'REPORT-01: Tải file PDF do worker sinh', operationId: 'downloadReport' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Analysis'))
  async download(
    @Param('projectId') projectId: string,
    @Param('reportId') reportId: string,
    @CurrentUser() actor: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.access.assertProjectAccess(projectId, actor, 'read');
    const meta = await this.reportService.getReportFileMeta(projectId, reportId);
    if (meta.status !== 'succeeded') {
      res.status(202).json(meta);
      return;
    }
    try {
      const { stream, fileSizeBytes } = await this.reportService.downloadReportFile(projectId, reportId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''report-${reportId}.pdf`);
      if (typeof fileSizeBytes === 'number') res.setHeader('Content-Length', String(fileSizeBytes));
      await this.audit.log({
        actorId: actor?.userId ?? null,
        actorRole: (actor as unknown as Record<string, unknown>)?.role as string ?? null,
        action: 'REPORT_FILE_DOWNLOADED',
        targetType: 'report',
        targetId: reportId,
        projectId,
        ipAddress: (req.ip ?? null) as string | null,
        userAgent: (req.headers['user-agent'] as string ?? null),
        metadata: { projectId, reportId, fileSizeBytes: fileSizeBytes ?? null },
      });
      stream.pipe(res);
    } catch {
      res.status(202).json(meta);
    }
  }
}
