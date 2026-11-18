/**
 * RemoveHandler — Use case: `remove()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  FEEDBACK_REPOSITORY_PORT,
  type FeedbackRepositoryPort,
} from '../../domain/ports/feedback.repository.port';
import { PROJECT_ACCESS_PORT, type ProjectAccessPort } from '../../../projects';
import { WORKSPACE_ACCESS_PORT, type WorkspaceAccessPort } from '../../../workspaces';
import { ForbiddenError, NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class RemoveHandler {
  private readonly logger = new Logger(RemoveHandler.name);
  constructor(
    @Inject(FEEDBACK_REPOSITORY_PORT)
    private readonly repo: FeedbackRepositoryPort,
    @Inject(PROJECT_ACCESS_PORT)
    private readonly projects: ProjectAccessPort,
    @Inject(WORKSPACE_ACCESS_PORT)
    private readonly workspaces: WorkspaceAccessPort,
  ) {}

  async execute(userId: string, role: string, id: string): Promise<{ deleted: boolean }> {
    const existing = await this.repo.findByIdActive(id);
    if (!existing) throw new NotFoundError('Không tìm thấy nhận xét');
    const isMine = existing.authorId === userId;
    if (isMine) {
      if (role === 'admin') {
        this.logger.warn(`SYS-ADMIN tu xoa nhan xet ${id} (ghi log kiem toan)`);
      }
      await this.repo.softDelete(id);
      return { deleted: true };
    }
    if (role === 'admin') {
      this.logger.warn(
        `SYS-ADMIN xoa nhan xet vi pham ${id} cua ${existing.authorId} (ghi log kiem toan)`,
      );
      await this.repo.softDelete(id);
      return { deleted: true };
    }
    const projectId = existing.projectId;
    const project = await this.projects.getProjectById(projectId);
    const workspaceId = project.workspaceId;
    const workspaceRole = await this.workspaces.resolveUserWorkspaceRole(workspaceId, userId);
    const projectRole = await this.projects.resolveUserProjectRole(
      projectId,
      userId,
      workspaceRole,
    );
    const canModerate = projectRole === 'owner' || workspaceRole === 'owner';
    if (!canModerate) {
      throw new ForbiddenError('Chỉ chủ nhận xét hoặc Project/Workspace Owner (xử lý vi phạm) được xoá',);
    }
    this.logger.warn(
      `Owner ${userId} (${projectRole}/${workspaceRole}) xoa nhan xet vi pham ${id} (ghi log kiem toan)`,
    );
    await this.repo.softDelete(id);
    return { deleted: true };
  }
}
