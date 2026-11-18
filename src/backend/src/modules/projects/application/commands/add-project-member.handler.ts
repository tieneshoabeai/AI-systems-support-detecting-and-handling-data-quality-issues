/**
 * AddProjectMemberHandler — Use case: `addProjectMember()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** invariant "đã là thành viên" do entity
 * `Project.addMember()` bảo vệ → ném `ConflictError` với mã lỗi ổn định.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import type { Project } from '../../domain/entities/project.entity';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { AddProjectMemberInput } from '../projects.types';
import { GetProjectByIdHandler } from '../queries/get-project-by-id.handler';
import { NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class AddProjectMemberHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    private readonly getProjectByIdHandler: GetProjectByIdHandler,
  ) {}

  async execute(projectId: string, dto: AddProjectMemberInput): Promise<Project> {
    const project = await this.getProjectByIdHandler.execute(projectId);
    const target = await this.users.findByEmail(dto.email.trim().toLowerCase());
    if (!target) throw new NotFoundError(`Không tìm thấy người dùng với email: ${dto.email}`);

    const role = dto.role ?? 'viewer';
    // Entity tự kiểm tra invariant → ném ConflictError nếu đã là thành viên.
    project.addMember(target.id, role);

    await this.projects.addMember(projectId, { userId: target.id, role });
    return this.getProjectByIdHandler.execute(projectId);
  }
}
