/**
 * UpdateMyReportHandler — Use case: `updateMyReport()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  ISSUE_REPORT_REPOSITORY_PORT,
  type IssueReportRepositoryPort,
} from '../../domain/ports/issue-report.repository.port';
import { STORAGE_PORT, type StoragePort } from '../../../../shared/application/ports/storage.port';
import { toResponse } from '../issues.utils';
import { ConflictError, NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class UpdateMyReportHandler {
  constructor(
    @Inject(ISSUE_REPORT_REPOSITORY_PORT)
    private readonly repo: IssueReportRepositoryPort,
    @Optional()
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
  ) {}

  async execute(
    userId: string,
    id: string,
    input: {
      title?: string;
      description?: string;
      removeAttachmentIds?: string[];
      expectedVersion: number;
    },
  ): Promise<Record<string, unknown>> {
    const existing = await this.repo.findByIdForUser(id, userId);
    if (!existing) throw new NotFoundError('Không tìm thấy báo cáo sự cố');
    if (existing.version !== input.expectedVersion) {
      throw new ConflictError('Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',);
    }
    // Chỉ gỡ được tệp đính kèm đang thực sự thuộc báo cáo này.
    const ownedAttachments = new Map((existing.attachments ?? []).map((a) => [String(a.id), a]));
    const removeAttachmentIds = (input.removeAttachmentIds ?? []).filter((aid) =>
      ownedAttachments.has(String(aid)),
    );

    // Entity áp dụng invariant "chỉ sửa được khi needs_info" + giới hạn độ dài
    // và chuyển trạng thái về `in_progress` (luồng "gửi lại sau khi bổ sung").
    existing.updateByUser({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(removeAttachmentIds.length > 0 ? { removeAttachmentIds } : {}),
    });

    const updated = await this.repo.updateByUser(id, {
      userId,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(removeAttachmentIds.length > 0 ? { removeAttachmentIds } : {}),
      expectedVersion: input.expectedVersion,
    });
    if (!updated) {
      throw new ConflictError('Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',);
    }

    // Dọn tệp đính kèm đã gỡ khỏi storage (best-effort — không chặn luồng chính).
    for (const aid of removeAttachmentIds) {
      const att = ownedAttachments.get(String(aid));
      const key = att?.storageKey;
      if (!key || !this.storage) continue;
      try {
        await this.storage.deleteFile(key);
      } catch {
        // Bỏ qua — tệp orphan sẽ được dọn bởi tiến trình bảo trì storage.
      }
    }

    return toResponse(updated);
  }
}
