/**
 * MarkCompletedHandler — Use case: `markCompleted()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import { GetProjectByIdHandler } from '../queries/get-project-by-id.handler';

@Injectable()
export class MarkCompletedHandler {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    private readonly getProjectByIdHandler: GetProjectByIdHandler,
  ) {}

  async execute(projectId: string, expectedVersion?: number): Promise<boolean> {
    const p = await this.getProjectByIdHandler.execute(projectId);
    if (expectedVersion === undefined) {
      throw new BadRequestException({
        message: 'Thiếu expectedVersion cho PROJ-12 (optimistic locking)',
        error: 'VALIDATION_ERROR',
      } as never);
    }
    if (p.status !== 'in_progress')
      throw new BadRequestException('Chỉ project in_progress mới được lưu hoàn tất (completed)');
    const ok = await this.projects.markCompleted(projectId, expectedVersion);
    if (ok === null) {
      const actual = (await this.getProjectByIdHandler.execute(projectId).catch(() => p)).version;
      throw new ConflictException({
        message: 'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
        error: 'CONFLICT',
        details: { expectedVersion, actualVersion: actual },
      } as never);
    }
    return ok;
  }
}
