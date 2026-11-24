import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ProjectsModule } from '../projects/projects.module';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';


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
  exports: [],
})
export class OverviewModule {}
