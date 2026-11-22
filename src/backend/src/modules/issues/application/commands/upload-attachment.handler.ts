/**
 * UploadAttachmentHandler — Use case: `uploadAttachment()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  ISSUE_REPORT_REPOSITORY_PORT,
  type IssueReport,
  type IssueReportRepositoryPort,
} from '../../domain/ports/issue-report.repository.port';
import { STORAGE_PORT, type StoragePort } from '../../../../shared/application/ports/storage.port';
import { randomBytes } from 'crypto';
import { Readable } from 'stream';
import { toResponse } from '../issues.utils';
import { DomainError, ERROR_CODES, NotFoundError, ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class UploadAttachmentHandler {
  constructor(
    @Inject(ISSUE_REPORT_REPOSITORY_PORT)
    private readonly repo: IssueReportRepositoryPort,
    @Optional()
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
  ) {}

  private assertAttachmentAccess(doc: IssueReport, userId: string, role: string): void {
    if (role === 'admin') return;
    if (doc.userId !== userId) {
      throw new NotFoundError('Không tìm thấy tệp đính kèm');
    }
  }

  async execute(
    userId: string,
    role: string,
    issueId: string,
    file: { filename: string; mimeType: string; size: number; stream: Readable },
  ): Promise<Record<string, unknown>> {
    const doc = await this.repo.findById(issueId);
    if (!doc) throw new NotFoundError('Không tìm thấy báo cáo sự cố');
    this.assertAttachmentAccess(doc, userId, role);
    const allowed: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'application/pdf': 'pdf',
    };
    const ext = allowed[file.mimeType];
    if (!ext) {
      const err = new DomainError(ERROR_CODES.UNSUPPORTED_MEDIA_TYPE, `Định dạng tệp không được hỗ trợ: ${file.mimeType}. Chỉ chấp nhận png/jpg/pdf.`);
      throw err;
    }
    if (file.size > 10 * 1024 * 1024) {
      const err = new DomainError(ERROR_CODES.ATTACHMENT_TOO_LARGE, 'Tệp đính kèm vượt quá 10MB');
      throw err;
    }
    if ((doc.attachments ?? []).length >= 3) {
      throw new ValidationError('Mỗi báo cáo chỉ được đính kèm tối đa 3 tệp');
    }
    if (!this.storage) throw new ValidationError('Storage chưa sẵn sàng');
    const attachmentId = randomBytes(12).toString('hex');
    const key = `issue_attachments/${issueId}/${attachmentId}.${ext}`;
    await this.storage.uploadStream(key, file.stream, file.mimeType);
    const updated = await this.repo.addAttachment(issueId, {
      id: attachmentId,
      filename: file.filename.slice(0, 255),
      storageKey: key,
      sizeBytes: file.size,
      contentType: file.mimeType,
    });
    if (!updated) throw new NotFoundError('Không tìm thấy báo cáo sự cố');
    return toResponse(updated);
  }
}
