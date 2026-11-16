/**
 * SetHasDatasetHandler — Use case: `setHasDataset()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
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
    const p = await this.getProjectByIdHandler.execute(projectId);
    const ok = await this.projects.setHasDataset(projectId, hasDataset);
    if (hasDataset && p.status === 'not_started')
      await this.projects.setStatus(projectId, 'in_progress');
    if (!hasDataset && p.status !== 'not_started')
      await this.projects.setStatus(projectId, 'not_started');
    return ok;
  }
}
