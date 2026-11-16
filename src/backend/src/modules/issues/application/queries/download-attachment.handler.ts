/**
 * DownloadAttachmentHandler — Use case: `downloadAttachment()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  ISSUE_REPORT_REPOSITORY_PORT,
  type IssueReportRepositoryPort,
} from '../../domain/ports/issue-report.repository.port';
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';
import { STORAGE_PORT, type StoragePort } from '../../../../shared/ports/storage.port';
import { Readable } from 'stream';

@Injectable()
export class DownloadAttachmentHandler {
  constructor(
    @Inject(ISSUE_REPORT_REPOSITORY_PORT)
    private readonly repo: IssueReportRepositoryPort,
    @Optional()
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
  ) {}

  async execute(
    userId: string,
    role: string,
    issueId: string,
    attachmentId: string,
  ): Promise<{
    stream: Readable;
    filename: string;
    contentType: string;
    sizeBytes: number;
    workspaceId: string | null;
  }> {
    const doc = isObjectIdHex(issueId)
      ? role === 'admin'
        ? await this.repo.findById(issueId)
        : await this.repo.findByIdForUser(issueId, userId)
      : null;
    if (!doc) throw new NotFoundException('Không tìm thấy tệp đính kèm');
    const att = (doc.attachments ?? []).find(
      (a) => String((a as Record<string, unknown>).id) === String(attachmentId),
    ) as unknown as Record<string, unknown> | undefined;
    if (!att) throw new NotFoundException('Không tìm thấy tệp đính kèm');
    const storageKey = String((att as Record<string, unknown>).storageKey ?? '');
    if (!storageKey || !this.storage) throw new NotFoundException('Không tìm thấy tệp đính kèm');
    const stream = await this.storage.downloadStream(storageKey);
    return {
      stream,
      filename: String((att as Record<string, unknown>).filename ?? 'attachment'),
      contentType: String(
        (att as Record<string, unknown>).contentType ?? 'application/octet-stream',
      ),
      sizeBytes: Number((att as Record<string, unknown>).sizeBytes ?? 0),
      workspaceId: doc.workspaceId,
    };
  }
}
