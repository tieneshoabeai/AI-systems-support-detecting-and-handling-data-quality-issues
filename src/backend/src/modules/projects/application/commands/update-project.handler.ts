/**
 * UpdateProjectHandler — Use case: `updateProject()`
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
import { UpdateProjectInput } from '../projects.types';
import { GetProjectByIdHandler } from '../queries/get-project-by-id.handler';

@Injectable()
export class UpdateProjectHandler {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    private readonly getProjectByIdHandler: GetProjectByIdHandler,
  ) {}

  async execute(id: string, dto: UpdateProjectInput): Promise<ProjectRecord> {
    const existing = await this.getProjectByIdHandler.execute(id);
    if (dto.name && dto.name.trim() !== existing.name) {
      const dup = await this.projects.findOneByWorkspaceAndName(
        existing.workspaceId,
        dto.name.trim(),
      );
      if (dup && dup.id !== id)
        throw new ConflictException('Tên project đã tồn tại trong workspace');
    }
    const { expectedVersion, ...patch } = dto;
    const updated = await this.projects.updateById(id, patch, expectedVersion);
    if (!updated) {
      if (expectedVersion !== undefined) {
        const actual = (await this.getProjectByIdHandler.execute(id).catch(() => existing)).version;
        throw new ConflictException({
          message: 'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
          error: 'CONFLICT',
          details: { expectedVersion, actualVersion: actual },
        } as never);
      }
      throw new NotFoundException('Không tìm thấy dự án để cập nhật');
    }
    return updated;
  }
}
