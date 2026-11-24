/**
 * UpdateProjectMemberRoleHandler — Use case: `updateProjectMemberRole()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** invariant "không đổi vai trò Owner tại đây"
 * do entity `Project.changeMemberRole()` bảo vệ.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import type { Project } from '../../domain/entities/project.entity';
import { UpdateProjectMemberInput } from '../projects.types';
import { GetProjectByIdHandler } from '../queries/get-project-by-id.handler';
import { ConflictError } from '../../../../shared/domain/errors';

@Injectable()
export class UpdateProjectMemberRoleHandler {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    private readonly getProjectByIdHandler: GetProjectByIdHandler,
  ) {}

  async execute(
    projectId: string,
    memberUserId: string,
    dto: UpdateProjectMemberInput,
  ): Promise<Project> {
    const project = await this.getProjectByIdHandler.execute(projectId);
    // Entity tự kiểm tra invariant:
    //   - Không phải thành viên → NotFoundError.
    //   - Là Project Owner → ValidationError (dùng nhượng quyền — PROJ-11).
    project.changeMemberRole(memberUserId, dto.role);

    const okRole = await this.projects.updateMemberRole(
      projectId,
      memberUserId,
      dto.role,
      dto.expectedVersion,
    );
    if (okRole === null) {
      const actual = (await this.getProjectByIdHandler.execute(projectId)).version;
      throw new ConflictError(
        'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
        { expectedVersion: dto.expectedVersion, actualVersion: actual },
      );
    }
    return this.getProjectByIdHandler.execute(projectId);
  }
}
