import { Controller, Get, Post, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/casl/check-policies.decorator';
import { Action } from '../../../../shared/casl/actions.enum';
import { SummaryService } from '../../application/summary.service';
import { ProjectAccessService } from '../../application/project-access.service';
import { CurrentUser, CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';

@ApiTags('Summary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class SummaryController {
  constructor(
    private readonly summaryService: SummaryService,
    private readonly access: ProjectAccessService,
  ) {}

  @Post('projects/:projectId/summary')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'SUMMARY-01: Tạo Tổng kết từ kết quả phân tích hệ thống mới nhất', operationId: 'createSummary' })
  @CheckPolicies((ability) => ability.can(Action.Execute, 'Analysis'))
  async create(@Param('projectId') projectId: string, @CurrentUser() user: CurrentUserPayload) {
    await this.access.assertProjectAccess(projectId, user, 'write');
    return this.summaryService.createSummary(projectId);
  }

  @Get('projects/:projectId/summary')
  @ApiOperation({ summary: 'SUMMARY-01: Xem Tổng kết mới nhất', operationId: 'getSummary' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Analysis'))
  async get(@Param('projectId') projectId: string, @CurrentUser() user: CurrentUserPayload) {
    await this.access.assertProjectAccess(projectId, user, 'read');
    return this.summaryService.getSummary(projectId);
  }
}
