import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ProjectsModule } from '../projects/projects.module';
import { OverviewService } from './application/overview.service';
import { OverviewController } from './infrastructure/http/overview.controller';

/**
 * MODULE OVERVIEW — Tổng hợp chỉ số (E3/E4).
 *
 * Module này chỉ ĐỌC dữ liệu từ Workspaces + Projects nên có thể import cả hai
 * mà không tạo vòng phụ thuộc.
 */
@Module({
  imports: [WorkspacesModule, ProjectsModule],
  controllers: [OverviewController],
  providers: [OverviewService],
  exports: [OverviewService],
})
export class OverviewModule {}
