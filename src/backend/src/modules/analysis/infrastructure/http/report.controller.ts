import { Controller, Get, Post, Param, UseGuards, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/casl/check-policies.decorator';
import { Action } from '../../../../shared/casl/actions.enum';
import { ReportService } from '../../application/report.service';
import type { Response } from 'express';

@ApiTags('Report')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('projects/:projectId/report')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'REPORT-01: Yêu cầu sinh PDF ở worker (202, không sinh tại API)', operationId: 'requestReport' })
  @CheckPolicies((ability) => ability.can(Action.Execute, 'Analysis'))
  async request(@Param('projectId') projectId: string) {
    return this.reportService.requestReport(projectId);
  }

  @Get('projects/:projectId/report/:reportId/file')
  @ApiOperation({ summary: 'REPORT-01: Tải file báo cáo do worker sinh', operationId: 'downloadReport' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Analysis'))
  async download(
    @Param('projectId') projectId: string,
    @Param('reportId') reportId: string,
    @Res() res: Response,
  ): Promise<void> {
    const meta = await this.reportService.getReportFileMeta(projectId, reportId);
    if (meta.status !== 'succeeded') {
      res.status(202).json(meta);
      return;
    }
    try {
      const { stream, fileSizeBytes } = await this.reportService.downloadReportFile(projectId, reportId);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''report-${reportId}.txt`);
      if (typeof fileSizeBytes === 'number') res.setHeader('Content-Length', String(fileSizeBytes));
      stream.pipe(res);
    } catch {
      res.status(202).json(meta);
    }
  }
}
