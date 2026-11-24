/**
 * RemoveProjectMemberHandler — Use case: `removeProjectMember()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** invariant "không xoá được Project Owner"
 * do entity `Project.removeMember()` bảo vệ → `ValidationError` ổn định.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import type { Project } from '../../domain/entities/project.entity';
import { GetProjectByIdHandler } from '../queries/get-project-by-id.handler';

@Injectable()
export class RemoveProjectMemberHandler {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    private readonly getProjectByIdHandler: GetProjectByIdHandler,
  ) {}

  async execute(projectId: string, memberUserId: string): Promise<Project> {
    const project = await this.getProjectByIdHandler.execute(projectId);
    // Entity tự kiểm tra invariant:
    //   - Không phải thành viên → NotFoundError.
    //   - Là Project Owner → ValidationError (phải nhượng quyền trước — PROJ-11).
    project.removeMember(memberUserId);

    await this.projects.removeMember(projectId, memberUserId);
    return this.getProjectByIdHandler.execute(projectId);
  }
}
