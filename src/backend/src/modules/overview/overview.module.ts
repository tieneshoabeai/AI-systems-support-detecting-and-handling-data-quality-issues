import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ProjectsModule } from '../projects/projects.module';
import { OverviewController } from './infrastructure/http/overview.controller';
import { GetUserOverviewHandler } from './application/queries/get-user-overview.handler';
import { GetWorkspaceOverviewHandler } from './application/queries/get-workspace-overview.handler';

/**
 * MODULE OVERVIEW — Tổng hợp chỉ số (E3/E4).
 *
 * Module này chỉ ĐỌC dữ liệu từ Workspaces + Projects nên có thể import cả hai
 * mà không tạo vòng phụ thuộc.
 */
@Module({
  imports: [WorkspacesModule, ProjectsModule],
  controllers: [OverviewController],
  providers: [GetUserOverviewHandler, GetWorkspaceOverviewHandler],
  exports: [],
})
export class OverviewModule {}
