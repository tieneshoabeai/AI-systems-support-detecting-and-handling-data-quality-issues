/**
 * SetHasDatasetHandler — Use case: `setHasDataset()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** `status` **suy ra** từ `hasDataset`
 * (Phần 2 v11 §3.36.1) → entity `Project.setHasDataset()` tự tính lại trạng
 * thái, handler chỉ ghi kết quả xuống persistence.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import { GetProjectByIdHandler } from '../queries/get-project-by-id.handler';

@Injectable()
export class SetHasDatasetHandler {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    private readonly getProjectByIdHandler: GetProjectByIdHandler,
  ) {}

  async execute(projectId: string, hasDataset: boolean): Promise<boolean> {
    const project = await this.getProjectByIdHandler.execute(projectId);
    const previousStatus = project.status;

    // Entity suy ra lại `status` từ `hasDataset` (một nguồn sự thật duy nhất).
    project.setHasDataset(hasDataset);

    const ok = await this.projects.setHasDataset(projectId, hasDataset);
    if (project.status !== previousStatus) {
      await this.projects.setStatus(projectId, project.status);
    }
    return ok;
  }
}
