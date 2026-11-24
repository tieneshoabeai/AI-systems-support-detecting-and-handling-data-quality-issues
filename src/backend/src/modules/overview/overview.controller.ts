import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/interfaces/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../shared/interfaces/casl/policies.guard';
import { CheckPolicies } from '../../shared/interfaces/casl/check-policies.decorator';
import { PolicyResource } from '../../shared/interfaces/casl/policy-resource.decorator';
import { Action } from '../../shared/domain/security/action';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../shared/interfaces/decorators/current-user.decorator';
import { WorkspacePolicyLoader } from '../workspaces';
import { OverviewService } from './overview.service';
import type { UserOverview, WorkspaceOverview } from './overview.types';

/**
 * OVERVIEW — Các endpoint tổng quan (E3/E4).
 *
 * **Về đường dẫn:** E3 dùng `GET /overview/workspaces` (không phải
 * `GET /workspaces/overview`) để **không xung đột** với route
 * `GET /workspaces/:id` của `WorkspacesController` — nếu dùng
 * `/workspaces/overview` thì NestJS có thể phân giải chuỗi `overview`
 * thành `:id` tùy thứ tự đăng ký route.
 *
 * E4 dùng `GET /workspaces/:id/overview` (3 phân đoạn) — không xung đột
 * với bất kỳ route nào hiện có.
 */
@ApiTags('Overview')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class OverviewController {
  constructor(
    private readonly overviewService: OverviewService,
  ) {}

  @Get('overview/workspaces')
  @ApiOperation({
    summary: 'E3: Tổng quan workspace của người dùng (5 chỉ số)',
    description:
      'Trả về: `totalWorkspaces`, `totalProjects`, `ownedWorkspaces`, `sharedWorkspaces`, `myProjects`.',
  })
  @ApiResponse({ status: 200, description: 'Các chỉ số tổng quan workspace' })
  // E3: tổng quan của chính user → không cần instance check.
  @CheckPolicies((ability) => ability.can(Action.Read, 'Workspace'))
  async userWorkspacesOverview(@CurrentUser() user: CurrentUserPayload): Promise<UserOverview> {
    return this.overviewService.getUserOverview(user.userId);
  }

  @Get('workspaces/:id/overview')
  @ApiOperation({
    summary: 'E4: Tổng quan một không gian làm việc',
    description:
      'Trả về: `projectCount`, `notStartedCount`, `inProgressCount`, `completedCount`, ' +
      '`memberCount`, `storageUsedBytes`, `lastAccessedAt`.',
  })
  @ApiResponse({ status: 200, description: 'Các chỉ số tổng quan workspace' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy không gian làm việc' })
  // E4: chỉ WS-OWNER/WS-MEMBER của workspace đó mới xem được tổng quan.
  @PolicyResource('Workspace', WorkspacePolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Read, 'Workspace'))
  async workspaceOverview(@Param('id') id: string): Promise<WorkspaceOverview> {
    return this.overviewService.getWorkspaceOverview(id);
  }
}
