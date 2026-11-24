/**
 * GetProjectByIdHandler — Use case: `getProjectById()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** trả về **entity** `Project` (không phải
 * record trần) → các handler khác có thể gọi hành vi của entity để kiểm tra
 * invariant trước khi ghi.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import type { Project } from '../../domain/entities/project.entity';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class GetProjectByIdHandler {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async execute(id: string, touch = false): Promise<Project> {
    if (!isObjectIdHex(id)) throw new ValidationError('ID Dự án không hợp lệ');
    const project = await this.projects.findById(id);
    if (!project) throw new NotFoundError('Không tìm thấy dự án hoặc dự án đã bị xóa');
    if (touch) await this.projects.touchLastAccessed(id).catch(() => undefined);
    return project;
  }
}
