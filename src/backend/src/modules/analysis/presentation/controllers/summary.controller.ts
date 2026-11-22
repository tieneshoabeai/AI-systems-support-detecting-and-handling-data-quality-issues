import { Controller, Get, Post, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/interfaces/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/interfaces/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/interfaces/casl/check-policies.decorator';
import { PolicyResource } from '../../../../shared/interfaces/casl/policy-resource.decorator';
import { Action } from '../../../../shared/domain/security/action';
import { ProjectScopePolicyLoader } from '../../../projects';
import { CreateSummaryHandler } from '../../application/commands/create-summary.handler';
import { GetSummaryHandler } from '../../application/queries/get-summary.handler';

@ApiTags('Summary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class SummaryController {
  constructor(
    private readonly createSummaryHandler: CreateSummaryHandler,
    private readonly getSummaryHandler: GetSummaryHandler,
  ) {}

  @Post('projects/:projectId/summary')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'SUMMARY-01: Tạo Tổng kết từ kết quả phân tích hệ thống mới nhất',
    operationId: 'createSummary',
  })
  // UC-23 (tạo Tổng kết): PROJ-MEMBER trở lên.
  @PolicyResource('Analysis', ProjectScopePolicyLoader, 'projectId')
  @CheckPolicies((ability) => ability.can(Action.Execute, 'Analysis'))
  @ApiResponse({ status: 201, description: 'Tạo mới thành công' })
  async create(@Param('projectId') projectId: string): Promise<Record<string, unknown>> {
    return this.createSummaryHandler.execute(projectId);
  }

  @Get('projects/:projectId/summary')
  @ApiOperation({ summary: 'SUMMARY-01: Xem Tổng kết mới nhất', operationId: 'getSummary' })
  // UC-23/UC-24: PROJ-VIEWER cũng xem được Tổng kết.
  @PolicyResource('Analysis', ProjectScopePolicyLoader, 'projectId')
  @CheckPolicies((ability) => ability.can(Action.Read, 'Analysis'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async get(@Param('projectId') projectId: string): Promise<Record<string, unknown>> {
    return this.getSummaryHandler.execute(projectId);
  }
}
