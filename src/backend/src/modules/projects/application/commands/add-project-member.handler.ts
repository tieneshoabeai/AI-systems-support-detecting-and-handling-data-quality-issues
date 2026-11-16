/**
 * AddProjectMemberHandler — Use case: `addProjectMember()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRecord,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { AddProjectMemberInput } from '../projects.types';
import { GetProjectByIdHandler } from '../queries/get-project-by-id.handler';

@Injectable()
export class AddProjectMemberHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    private readonly getProjectByIdHandler: GetProjectByIdHandler,
  ) {}

  async execute(projectId: string, dto: AddProjectMemberInput): Promise<ProjectRecord> {
    const p = await this.getProjectByIdHandler.execute(projectId);
    const target = await this.users.findByEmail(dto.email.trim().toLowerCase());
    if (!target) throw new NotFoundException(`Không tìm thấy người dùng với email: ${dto.email}`);
    if ((p.members || []).some((m) => m.userId === target.id))
      throw new ConflictException('Người dùng đã là thành viên project');
    await this.projects.addMember(projectId, { userId: target.id, role: dto.role ?? 'viewer' });
    return this.getProjectByIdHandler.execute(projectId);
  }
}
