import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/decorators/current-user.decorator';
import { GetUserOverviewHandler } from '../../application/queries/get-user-overview.handler';
import { GetWorkspaceOverviewHandler } from '../../application/queries/get-workspace-overview.handler';

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
@UseGuards(JwtAuthGuard)
@Controller()
export class OverviewController {
  constructor(
    private readonly getUserOverviewHandler: GetUserOverviewHandler,
    private readonly getWorkspaceOverviewHandler: GetWorkspaceOverviewHandler,
  ) {}

  @Get('overview/workspaces')
  @ApiOperation({
    summary: 'E3: Tổng quan workspace của người dùng (5 chỉ số)',
    description:
      'Trả về: `totalWorkspaces`, `totalProjects`, `ownedWorkspaces`, `sharedWorkspaces`, `myProjects`.',
  })
  @ApiResponse({ status: 200, description: 'Các chỉ số tổng quan workspace' })
  async userWorkspacesOverview(@CurrentUser() user: CurrentUserPayload): Promise<{ totalWorkspaces: number; totalProjects: number; ownedWorkspaces: number; sharedWorkspaces: number; myProjects: number; }> {
    return this.getUserOverviewHandler.execute(user.userId);
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
  async workspaceOverview(@Param('id') id: string): Promise<{ workspaceId: string; projectCount: number; notStartedCount: number; inProgressCount: number; completedCount: number; memberCount: number; storageUsedBytes: number; lastAccessedAt: string | null; }> {
    return this.getWorkspaceOverviewHandler.execute(id);
  }
}
