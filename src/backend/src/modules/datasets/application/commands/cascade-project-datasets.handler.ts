/**
 * CASCADE — consumer của event `PROJECT_DELETED` (module `datasets`).
 *
 * Vì sao cần:
 * Khi project bị xóa (trực tiếp hoặc do cascade từ workspace), dataset thuộc
 * project đó phải đi theo: dataset bị soft-delete, bản ghi (`dataset_records`)
 * bị xóa, file CSV gốc trên R2 bị xóa và `storage_used` của workspace được
 * trừ lại — nếu không thì vẫn còn **rò rỉ dung lượng**.
 *
 * Vì sao dùng event:
 * Module `datasets` đã import `projects` (chiều `datasets → projects`), nên
 * module `projects` **không được** import ngược lại (CA9 — không chu trình).
 * Module `datasets` là chủ sở hữu collection `datasets` + `dataset_records` →
 * nó tự xóa dữ liệu của mình khi nhận event.
 *
 * Idempotent: chỉ xử lý dataset **còn sống**; chạy lại không gây tác dụng phụ.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import { STORAGE_PORT, type StoragePort } from '../../../../shared/application/ports/storage.port';
import { WORKSPACE_ACCESS_PORT, type WorkspaceAccessPort } from '../../../workspaces';
import { storageKeyForDataset } from '../../domain/value-objects/dataset-limits.vo';

@Injectable()
export class CascadeProjectDatasetsHandler {
  private readonly logger = new Logger(CascadeProjectDatasetsHandler.name);

  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
    @Inject(WORKSPACE_ACCESS_PORT)
    private readonly workspaces: WorkspaceAccessPort,
  ) {}

  /**
   * Xóa dataset + bản ghi + file R2 của một project đã bị xóa.
   *
   * @returns Tổng số byte dung lượng đã được giải phóng.
   */
  async execute(projectId: string, workspaceId?: string): Promise<number> {
    if (!/^[0-9a-fA-F]{24}$/.test(projectId)) {
      this.logger.warn(`Bo qua cascade: projectId khong hop le (${projectId})`);
      return 0;
    }
    const deleted = await this.datasets.softDeleteByProject(projectId);
    if (deleted.length === 0) return 0;

    let freedBytes = 0;
    for (const d of deleted) {
      freedBytes += d.fileSizeBytes;
      try {
        await this.storage.deleteFile(storageKeyForDataset(d.id));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Khong xoa duoc file R2 cua dataset ${d.id}: ${msg}`);
      }
    }

    if (freedBytes > 0 && workspaceId) {
      try {
        await this.workspaces.incrementStorageUsed(workspaceId, -freedBytes);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Khong tru duoc storage_used cua workspace ${workspaceId}: ${msg}`);
      }
    }

    this.logger.log(
      `Cascade xoa ${deleted.length} dataset thuoc project ${projectId} (giai phong ${freedBytes} bytes)`,
    );
    return freedBytes;
  }

  /** Xử lý trực tiếp từ envelope event. */
  async handleEvent(eventType: string, payload: Record<string, unknown>): Promise<number> {
    if (eventType !== 'PROJECT_DELETED') return 0;
    const rawProject = payload['project_id'] ?? payload['projectId'];
    const rawWorkspace = payload['workspace_id'] ?? payload['workspaceId'];
    const projectId = typeof rawProject === 'string' ? rawProject : '';
    const workspaceId = typeof rawWorkspace === 'string' ? rawWorkspace : undefined;
    if (!projectId) return 0;
    return this.execute(projectId, workspaceId);
  }
}
