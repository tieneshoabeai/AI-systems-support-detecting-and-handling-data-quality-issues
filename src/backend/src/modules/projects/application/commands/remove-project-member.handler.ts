/**
 * RemoveProjectMemberHandler — Use case: `removeProjectMember()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRecord,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import { GetProjectByIdHandler } from '../queries/get-project-by-id.handler';

@Injectable()
export class RemoveProjectMemberHandler {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    private readonly getProjectByIdHandler: GetProjectByIdHandler,
  ) {}

  async execute(projectId: string, memberUserId: string): Promise<ProjectRecord> {
    const p = await this.getProjectByIdHandler.execute(projectId);
    const m = (p.members || []).find((x) => x.userId === memberUserId);
    if (!m) throw new NotFoundException('Người dùng không thuộc project này');
    if (m.role === 'owner')
      throw new BadRequestException(
        'Không thể xóa Project Owner — hãy nhượng quyền trước (PROJ-11)',
      );
    await this.projects.removeMember(projectId, memberUserId);
    return this.getProjectByIdHandler.execute(projectId);
  }
}
