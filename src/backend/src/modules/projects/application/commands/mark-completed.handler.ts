/**
 * MarkCompletedHandler — Use case: `markCompleted()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** invariant "chỉ `in_progress` mới lưu hoàn
 * tất" do entity `Project.markCompleted()` bảo vệ → `ValidationError`.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import { GetProjectByIdHandler } from '../queries/get-project-by-id.handler';
import { ConflictError, ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class MarkCompletedHandler {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    private readonly getProjectByIdHandler: GetProjectByIdHandler,
  ) {}

  async execute(projectId: string, expectedVersion?: number): Promise<boolean> {
    const project = await this.getProjectByIdHandler.execute(projectId);
    if (expectedVersion === undefined) {
      throw new ValidationError('Thiếu expectedVersion cho PROJ-12 (optimistic locking)');
    }
    // Entity tự kiểm tra invariant → ValidationError nếu chưa `in_progress`.
    project.markCompleted();

    const ok = await this.projects.markCompleted(projectId, expectedVersion);
    if (ok === null) {
      const actual = (await this.getProjectByIdHandler.execute(projectId).catch(() => project)).version;
      throw new ConflictError(
        'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
        { expectedVersion, actualVersion: actual },
      );
    }
    return ok;
  }
}
