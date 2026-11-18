/**
 * DeleteDatasetHandler — Use case: `deleteDataset()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** đọc entity `Dataset` để lấy `projectId` /
 * `workspaceId` / `fileSizeBytes` — không cần map thủ công.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import { PROJECT_ACCESS_PORT, type ProjectAccessPort } from '../../../projects';
import { WORKSPACE_ACCESS_PORT, type WorkspaceAccessPort } from '../../../workspaces';
import { NotFoundError } from '../../../../shared/domain/errors';

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
    const dataset = await this.datasets.findById(id);
    if (!dataset) {
      throw new NotFoundError('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
    }
    const deleted = await this.datasets.softDeleteDatasetWithRecords(id);

    await this.projects.setHasDataset(dataset.projectId, false);
    await this.workspaces.incrementStorageUsed(
      dataset.workspaceId,
      -(dataset.fileSizeBytes ?? 0),
    );

    this.logger.log(`Da xoa mem Dataset ID: ${id}`);
    return deleted;
  }
}
