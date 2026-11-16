/**
 * GetProjectByIdHandler — Use case: `getProjectById()`
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
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';

@Injectable()
export class GetProjectByIdHandler {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async execute(id: string, touch = false): Promise<ProjectRecord> {
    if (!isObjectIdHex(id)) throw new BadRequestException('ID Dự án không hợp lệ');
    const project = await this.projects.findById(id);
    if (!project) throw new NotFoundException('Không tìm thấy dự án hoặc dự án đã bị xóa');
    if (touch) await this.projects.touchLastAccessed(id).catch(() => undefined);
    return project;
  }
}
