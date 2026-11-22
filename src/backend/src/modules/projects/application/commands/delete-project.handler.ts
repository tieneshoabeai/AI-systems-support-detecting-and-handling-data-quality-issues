/**
 * DeleteProjectHandler — Use case: `deleteProject()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import { GetProjectByIdHandler } from '../queries/get-project-by-id.handler';

@Injectable()
export class DeleteProjectHandler {
  private readonly logger = new Logger(DeleteProjectHandler.name);
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    private readonly getProjectByIdHandler: GetProjectByIdHandler,
  ) {}

  async execute(id: string): Promise<boolean> {
    await this.getProjectByIdHandler.execute(id);
    const deleted = await this.projects.softDelete(id);
    this.logger.log(`Đã xóa mềm Project ID: ${id}`);
    return deleted;
  }
}
