/**
 * DeleteDatasetHandler — Use case: `deleteDataset()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** đọc entity `Dataset` để lấy `projectId` /
 * `workspaceId` / `fileSizeBytes` — không cần map thủ công.
 *
 * ── OPEN-09: xoá dataset + gỡ cờ `hasDataset` của project + trừ dung lượng
 * workspace nằm trong **cùng một transaction** ⇒ không bao giờ có trạng thái
 * "dataset đã xoá nhưng project vẫn báo `hasDataset = true`" hay "workspace
 * vẫn ghi nhận dung lượng đã bị giải phóng".
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import { PROJECT_ACCESS_PORT, type ProjectAccessPort } from '../../../projects';
import { WORKSPACE_ACCESS_PORT, type WorkspaceAccessPort } from '../../../workspaces';
import {
  TRANSACTION_PORT,
  type TransactionPort,
} from '../../../../shared/application/ports/transaction.port';
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
    @Inject(TRANSACTION_PORT)
    private readonly tx: TransactionPort,
  ) {}

  async execute(id: string): Promise<boolean> {
    const dataset = await this.datasets.findById(id);
    if (!dataset) {
      throw new NotFoundError('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
    }

    return this.tx.runInTransaction(async () => {
      const deleted = await this.datasets.softDeleteDatasetWithRecords(id);

      await this.projects.setHasDataset(dataset.projectId, false);
      await this.workspaces.incrementStorageUsed(
        dataset.workspaceId,
        -(dataset.fileSizeBytes ?? 0),
      );

      this.logger.log(`Da xoa mem Dataset ID: ${id}`);
      return deleted;
    });
  }
}
