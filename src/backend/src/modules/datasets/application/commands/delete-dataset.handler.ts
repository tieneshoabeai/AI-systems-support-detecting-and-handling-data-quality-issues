/**
 * DeleteDatasetHandler — Use case: `deleteDataset()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import { PROJECT_ACCESS_PORT, type ProjectAccessPort } from '../../../projects';
import { WORKSPACE_ACCESS_PORT, type WorkspaceAccessPort } from '../../../workspaces';

@Injectable()
export class DeleteDatasetHandler {
  private readonly logger = new Logger(DeleteDatasetHandler.name);
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
    @Inject(PROJECT_ACCESS_PORT)
    private readonly projects: ProjectAccessPort,
    @Inject(WORKSPACE_ACCESS_PORT)
    private readonly workspaces: WorkspaceAccessPort,
  ) {}

  async execute(id: string): Promise<boolean> {
    const raw = await this.datasets.findById(id);
    if (!raw) {
      throw new NotFoundException('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
    }
    const deleted = await this.datasets.softDeleteDatasetWithRecords(id);

    await this.projects.setHasDataset(raw.projectId, false);
    await this.workspaces.incrementStorageUsed(raw.workspaceId, -(raw.fileSizeBytes ?? 0));

    this.logger.log(`Da xoa mem Dataset ID: ${id}`);
    return deleted;
  }
}
