/**
 * UpdateProjectHandler — Use case: `updateProject()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** invariant "tên không được rỗng / quá dài"
 * do entity `Project.rename()` bảo vệ → `ValidationError` có mã lỗi ổn định.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import type { Project } from '../../domain/entities/project.entity';
import { UpdateProjectInput } from '../projects.types';
import { GetProjectByIdHandler } from '../queries/get-project-by-id.handler';
import { ConflictError, NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class UpdateProjectHandler {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    private readonly getProjectByIdHandler: GetProjectByIdHandler,
  ) {}

  async execute(id: string, dto: UpdateProjectInput): Promise<Project> {
    const existing = await this.getProjectByIdHandler.execute(id);
    if (dto.name && dto.name.trim() !== existing.name) {
      const dup = await this.projects.findOneByWorkspaceAndName(
        existing.workspaceId,
        dto.name.trim(),
      );
      if (dup && dup.id !== id) {
        throw new ConflictError('Tên project đã tồn tại trong workspace');
      }
    }

    const { expectedVersion, ...patch } = dto;
    // Entity kiểm tra invariant trước khi ghi → ValidationError nếu tên rỗng/quá dài.
    existing.rename(patch.name, patch.description);

    const updated = await this.projects.updateById(id, patch, expectedVersion);
    if (!updated) {
      if (expectedVersion !== undefined) {
        const actual = (await this.getProjectByIdHandler.execute(id).catch(() => existing)).version;
        throw new ConflictError(
          'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
          { expectedVersion, actualVersion: actual },
        );
      }
      throw new NotFoundError('Không tìm thấy dự án để cập nhật');
    }
    return updated;
  }
}
