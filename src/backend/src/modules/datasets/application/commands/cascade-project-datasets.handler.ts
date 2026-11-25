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
 * ── Nghiêm (strict) về dung lượng — không bỏ sót, không nuốt lỗi ──────────
 * Ba lỗi cũ (đã sửa):
 *
 * 1. Lỗi xóa file R2 / cập nhật `storage_used` bị nuốt trong `try/catch` ⇒
 *    Inbox đánh dấu event `PROJECT_DELETED` là **completed** ⇒ **không bao
 *    giờ retry** ⇒ file R2 bị sót (rò rỉ dung lượng thật) và `storage_used`
 *    của workspace lệch khỏi thực tế vĩnh viễn.
 * 2. `softDeleteByProject()` chỉ trả về dataset **còn sống**. Sau khi
 *    soft-delete thành công mà xóa file thất bại, lần retry tiếp theo thấy
 *    mảng rỗng ⇒ không bao giờ xóa lại file ⇒ rò rỉ vĩnh viễn.
 * 3. `incrementStorageUsed` tự nuốt lỗi bên trong ⇒ try/catch ở đây là
 *    **code chết**, lỗi ghi `storage_used` không bao giờ được log.
 *
 * Cách sửa:
 *   1. Tách **hai bước**: (a) soft-delete dataset + xóa bản ghi, (b) dọn file
 *      R2. Bước (b) dùng `listAllByProjectIncludingDeleted()` ⇒ lần retry vẫn
 *      biết chính xác file nào cần dọn.
 *   2. `deleteFile()` trả `false` (file không tồn tại **hoặc** lỗi R2) ⇒
 *      **ném lỗi** ⇒ Inbox đánh dấu `failed` ⇒ được retry.
 *   3. Trừ `storage_used` **đúng một lần** nhờ cờ idempotent
 *      `storage_released` (xem `DatasetRepositoryPort.markStorageReleased()`)
 *      ⇒ lần retry không trừ trùng ⇒ `storage_used` không bao giờ âm.
 *   4. `incrementStorageUsed` không còn nuốt lỗi (xem `IncrementStorageUsedHandler`)
 *      ⇒ lỗi ghi `storage_used` cũng làm ném ra ⇒ retry.
 *
 * Idempotent: chạy lại không gây tác dụng phụ (file đã xóa ⇒ `deleteFile` trả
 * `false` nhưng `fileExists` xác nhận không tồn tại ⇒ coi như đã dọn xong).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import { STORAGE_PORT, type StoragePort } from '../../../../shared/application/ports/storage.port';
import { WORKSPACE_ACCESS_PORT, type WorkspaceAccessPort } from '../../../workspaces';
import { storageKeyForDataset } from '../../domain/value-objects/dataset-limits.vo';
import { PROJECT_OUTBOX_EVENTS } from '../../../../shared/domain/utils/outbox-events';

/** Lỗi nghiệp vụ: không dọn được file R2 ⇒ event phải được retry. */
class StorageCleanupError extends Error {
  constructor(
    message: string,
    readonly datasetId: string,
  ) {
    super(message);
    this.name = 'StorageCleanupError';
  }
}

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
   * @returns Tổng số byte dung lượng đã được giải phóng **thật**.
   * @throws {StorageCleanupError} khi không dọn được file R2 ⇒ event được retry.
   */
  async execute(projectId: string, workspaceId?: string): Promise<number> {
    if (!/^[0-9a-fA-F]{24}$/.test(projectId)) {
      this.logger.warn(`Bo qua cascade: projectId khong hop le (${projectId})`);
      return 0;
    }

    // ── Bước (a): soft-delete dataset + xóa bản ghi ──────────────────────
    // Chỉ xử lý dataset **còn sống** ⇒ chạy lại không xóa trùng.
    const deleted = await this.datasets.softDeleteByProject(projectId);

    // ── Bước (b): dọn file R2 + trừ `storage_used` ────────────────────────
    // Dùng `listAllByProjectIncludingDeleted()` ⇒ lần retry vẫn thấy dataset
    // đã soft-delete ở lần trước ⇒ không bỏ sót file.
    const all = await this.datasets.listAllByProjectIncludingDeleted(projectId);
    if (all.length === 0) return 0;

    let freedBytes = 0;
    const failures: StorageCleanupError[] = [];

    for (const d of all) {
      const key = d.storageKey || storageKeyForDataset(d.id);
      try {
        await this.deleteFileIfExists(key, d.id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Khong xoa duoc file R2 cua dataset ${d.id}: ${msg}`);
        failures.push(
          err instanceof StorageCleanupError ? err : new StorageCleanupError(msg, d.id),
        );
        continue;
      }

      // File đã dọn xong → đánh dấu đã giải phóng (idempotent) để biết có
      // được phép trừ `storage_used` hay không.
      const firstTime = await this.datasets.markStorageReleased(d.id);
      if (firstTime) {
        freedBytes += d.fileSizeBytes;
      }
    }

    // Trừ `storage_used` cho phần **mới** giải phóng trong lần này.
    if (freedBytes > 0 && workspaceId) {
      await this.workspaces.incrementStorageUsed(workspaceId, -freedBytes);
    }

    if (failures.length > 0) {
      // Ném lỗi ⇒ Inbox đánh dấu `failed` ⇒ **retry** ⇒ lần sau dọn nốt.
      const detail = failures.map((f) => `${f.datasetId}: ${f.message}`).join('; ');
      throw new StorageCleanupError(
        `Khong dung xong ${failures.length}/${all.length} file R2 (project=${projectId}) — ${detail}`,
        failures[0]?.datasetId ?? '',
      );
    }

    this.logger.log(
      `Cascade xoa ${deleted.length} dataset thuoc project ${projectId} (giai phong ${freedBytes} bytes)`,
    );
    return freedBytes;
  }

  /**
   * Xóa file trên storage nếu còn tồn tại.
   *
   * `deleteFile()` trả `false` cho **hai** nguyên nhân khác nhau:
   *   - file **không tồn tại** (đã dọn ở lần trước) → OK, coi như xong.
   *   - lỗi R2/S3 (mạng, credential, 5xx) → **phải ném lỗi** để retry.
   *
   * Vì `deleteFile()` nuốt lỗi bên trong và chỉ trả `false`, ta dùng
   * `fileExists()` để phân biệt hai trường hợp.
   */
  private async deleteFileIfExists(key: string, datasetId: string): Promise<void> {
    const deleted = await this.storage.deleteFile(key);
    if (deleted) return;

    // `deleteFile` trả `false` → kiểm tra xem file còn tồn tại không.
    const stillExists = await this.storage.fileExists(key).catch(() => true);
    if (stillExists) {
      throw new StorageCleanupError(
        `File van con tren storage sau khi goi deleteFile (key=${key})`,
        datasetId,
      );
    }
    // File đã không còn ⇒ dọn xong (idempotent).
  }

  /** Xử lý trực tiếp từ envelope event. */
  async handleEvent(eventType: string, payload: Record<string, unknown>): Promise<number> {
    if (eventType !== PROJECT_OUTBOX_EVENTS.DELETED) return 0;
    const rawProject = payload['project_id'] ?? payload['projectId'];
    const rawWorkspace = payload['workspace_id'] ?? payload['workspaceId'];
    const projectId = typeof rawProject === 'string' ? rawProject : '';
    const workspaceId = typeof rawWorkspace === 'string' ? rawWorkspace : undefined;
    if (!projectId) return 0;
    return this.execute(projectId, workspaceId);
  }
}
