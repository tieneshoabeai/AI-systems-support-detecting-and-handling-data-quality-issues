/**
 * AiQualityMetricsHandler — Use case: `aiQualityMetrics()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  FEEDBACK_REPOSITORY_PORT,
  type FeedbackRepositoryPort,
} from '../../domain/ports/feedback.repository.port';
import { PROJECT_ACCESS_PORT, type ProjectAccessPort } from '../../../projects';
import { WORKSPACE_ACCESS_PORT, type WorkspaceAccessPort } from '../../../workspaces';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import { ForbiddenError, ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class AiQualityMetricsHandler {
  constructor(
    @Inject(PROJECT_ACCESS_PORT)
    private readonly projects: ProjectAccessPort,
    @Inject(WORKSPACE_ACCESS_PORT)
    private readonly workspaces: WorkspaceAccessPort,
    @Inject(FEEDBACK_REPOSITORY_PORT)
    private readonly repo: FeedbackRepositoryPort,
  ) {}

  private ensureNotAdmin(role: string): void {
    if (role === 'admin') {
      throw new ForbiddenError('Quản trị viên hệ thống không có quyền với nhóm nhận xét (FB-*)',);
    }
  }

  private async resolveProjectAccess(
    projectId: string,
    userId: string,
  ): Promise<{ projectRole: string; workspaceRole: string | null; workspaceId: string }> {
    const project = await this.projects.getProjectById(projectId);
    const workspaceId = project.workspaceId;
    const workspaceRole = await this.workspaces.resolveUserWorkspaceRole(workspaceId, userId);
    const projectRole = await this.projects.resolveUserProjectRole(
      projectId,
      userId,
      workspaceRole,
    );
    if (!projectRole) {
      throw new ForbiddenError('Không có quyền truy cập project này');
    }
    return { projectRole, workspaceRole, workspaceId };
  }

  async execute(userId: string, role: string, projectId: string): Promise<Record<string, unknown>> {
    this.ensureNotAdmin(role);
    if (!isObjectIdHex(projectId)) throw new ValidationError('ID Dự án không hợp lệ');
    const { projectRole, workspaceRole } = await this.resolveProjectAccess(projectId, userId);
    const allowed =
      workspaceRole === 'owner' || projectRole === 'owner' || projectRole === 'member';
    if (!allowed) {
      throw new ForbiddenError('Chỉ Owner/Member mới xem thống kê chất lượng AI');
    }
    const [groups, total, runs] = await Promise.all([
      this.repo.aggregateByProject(projectId),
      this.repo.countByProject(projectId),
      this.repo.countDistinctRuns(projectId),
    ]);
    const byLabel: Record<string, number> = {};
    for (const g of groups) byLabel[g.label] = g.count;
    const fp = byLabel['false_positive'] ?? 0;
    const missed = byLabel['missed_issue'] ?? 0;
    return {
      projectId,
      total,
      distinctRuns: runs,
      byLabel,
      falsePositiveCount: fp,
      missedIssueCount: missed,
      falsePositiveRate: total > 0 ? fp / total : null,
      missedIssueRate: total > 0 ? missed / total : null,
    };
  }
}
