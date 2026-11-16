import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import {
  ISSUE_REPORT_REPOSITORY_PORT,
  type CreateIssueRecord,
  type IssueReportRecord,
  type IssueReportRepositoryPort,
  type IssueListQuery,
} from '../domain/ports/issue-report.repository.port';
import { assertAllowedIssueTransition, type IssueStatus } from '../domain/value-objects/issue-status.vo';
import type { IssueType } from '../domain/value-objects/issue-type.vo';
import { CursorCodec } from '../../../shared/pagination/cursor-codec';
import { isObjectIdHex } from '../../../shared/utils/object-id.util';
import {
  NOTIFICATION_REPOSITORY_PORT,
  type NotificationRepositoryPort,
} from '../../notifications/domain/ports/notification.repository.port';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../users/domain/ports/user.repository.port';
import {
  REALTIME_PORT,
  type RealtimePort,
} from '../../realtime/domain/ports/realtime.port';
import { isMandatoryNotification, shouldDispatch } from '../../notifications/domain/value-objects/notification-type.vo';
import { STORAGE_PORT, type StoragePort } from '../../../shared/ports/storage.port';
import { randomBytes } from 'crypto';
import { Readable } from 'stream';

/** Application inputs — controller map DTO sang, không import DTO http. */
export interface CreateIssueInput {
  issueType: IssueType;
  title: string;
  description: string;
  workspaceId?: string;
  apiPath?: string;
  errorMessage?: string;
  occurredAt?: string;
}

export interface ListIssuesInput {
  cursor?: string;
  limit: number;
  sortBy: 'createdAt' | 'updatedAt' | 'status';
  sortOrder: 'asc' | 'desc';
  status?: IssueStatus;
}

export interface AdminListIssuesInput {
  cursor?: string;
  limit: number;
  sortBy: 'createdAt' | 'updatedAt' | 'status' | 'severity';
  sortOrder: 'asc' | 'desc';
  status?: IssueStatus;
}

function toResponse(doc: IssueReportRecord): Record<string, unknown> {
  return {
    id: doc.id,
    userId: doc.userId,
    workspaceId: doc.workspaceId,
    issueType: doc.issueType,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    attachments: (doc.attachments ?? []).map((a) => ({
      ...(a as unknown as Record<string, unknown>),
      downloadUrl: `/api/v1/issues/${doc.id}/attachments/${(a as unknown as { id: string }).id}`,
    })),
    context: doc.context,
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function dispatchViaPorts(
  repo: NotificationRepositoryPort,
  users: UserRepositoryPort,
  realtime: RealtimePort | undefined,
  params: { userId: string; type: 'issue_needs_info' | 'issue_resolved'; title: string; summary: string; targetId: string; isMandatory: boolean },
): Promise<void> {
  const user = await users.findById(params.userId).catch(() => null);
  const enabled = user ? user.notificationsEnabled : undefined;
  const mandatory = isMandatoryNotification(params.type, params.isMandatory);
  if (!shouldDispatch(enabled, mandatory)) return;
  const created = await repo.createIfEventNotExists({
    userId: params.userId,
    type: params.type,
    title: params.title,
    summary: params.summary,
    payload: { targetType: 'issue', targetId: params.targetId },
    sourceEventId: null,
    isMandatory: mandatory,
  });
  if (created) {
    try {
      realtime?.emitToUser(params.userId, 'notification.created', {
        notificationId: created.id,
        notificationType: created.type,
      });
    } catch {
      // realtime không bao giờ làm hỏng luồng nghiệp vụ chính
    }
  }
}

/**
 * ISSUES — Application orchestrator.
 * Chỉ phụ thuộc domain ports (ISSUE_REPORT / NOTIFICATION / USER / REALTIME).
 * Không import Mongoose, schema, repository cụ thể, DTO http.
 */
@Injectable()
export class IssuesService {
  constructor(
    @Inject(ISSUE_REPORT_REPOSITORY_PORT)
    private readonly repo: IssueReportRepositoryPort,
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly notifications: NotificationRepositoryPort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Optional() @Inject(REALTIME_PORT)
    private readonly realtime?: RealtimePort,
    @Optional() @Inject(STORAGE_PORT)
    private readonly storage?: StoragePort,
  ) {}

  async createReport(userId: string, dto: CreateIssueInput): Promise<Record<string, unknown>> {
    let workspaceId: string | null = null;
    if (dto.workspaceId) {
      if (!isObjectIdHex(dto.workspaceId)) {
        throw new BadRequestException('workspaceId không hợp lệ');
      }
      workspaceId = dto.workspaceId;
    }
    let occurredAt: Date | null = null;
    if (dto.occurredAt) {
      const d = new Date(dto.occurredAt);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('occurredAt không hợp lệ');
      occurredAt = d;
    }
    const input: CreateIssueRecord = {
      userId,
      workspaceId: workspaceId ?? null,
      issueType: dto.issueType,
      title: dto.title.trim(),
      description: dto.description.trim(),
      context: {
        apiPath: dto.apiPath ?? null,
        errorMessage: dto.errorMessage ?? null,
        occurredAt,
      },
    };
    const doc = await this.repo.create(input);
    return toResponse(doc);
  }

  private parseCursor(cursor: string | undefined): { createdAt?: Date; id?: string } {
    if (!cursor) return {};
    const decoded = CursorCodec.decode<{ createdAt?: string; id?: string }>(cursor);
    if (!decoded || !decoded.createdAt || !decoded.id || !isObjectIdHex(decoded.id)) {
      throw new BadRequestException('Cursor không hợp lệ');
    }
    const d = new Date(decoded.createdAt);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Cursor không hợp lệ');
    return { createdAt: d, id: decoded.id };
  }

  private buildPage(docs: IssueReportRecord[], limit: number): { items: Record<string, unknown>[]; meta: { nextCursor: string | null; hasMore: boolean } } {
    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;
    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1] as IssueReportRecord;
      nextCursor = CursorCodec.encode({
        createdAt: (last.createdAt as Date).toISOString(),
        id: last.id,
      });
    }
    return { items: page.map(toResponse), meta: { nextCursor, hasMore } };
  }

  async listMine(userId: string, query: ListIssuesInput): Promise<{ items: Record<string, unknown>[]; meta: { nextCursor: string | null; hasMore: boolean } }> {
    const c = this.parseCursor(query.cursor);
    const q: IssueListQuery = {
      userId,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      status: query.status,
      cursorCreatedAt: c.createdAt,
      cursorId: c.id,
    };
    const docs = await this.repo.list(q);
    return this.buildPage(docs, query.limit);
  }

  async getMine(userId: string, id: string): Promise<Record<string, unknown>> {
    const doc = await this.repo.findByIdForUser(id, userId);
    if (!doc) throw new NotFoundException('Không tìm thấy báo cáo sự cố');
    return toResponse(doc);
  }

  async listForAdmin(query: AdminListIssuesInput): Promise<{ items: Record<string, unknown>[]; meta: { nextCursor: string | null; hasMore: boolean } }> {
    const sortBy = query.sortBy === 'severity' ? 'createdAt' : query.sortBy;
    const c = this.parseCursor(query.cursor);
    const docs = await this.repo.list({
      limit: query.limit,
      sortBy,
      sortOrder: query.sortOrder,
      status: query.status,
      cursorCreatedAt: c.createdAt,
      cursorId: c.id,
    });
    return this.buildPage(docs, query.limit);
  }

  async getForAdmin(id: string, role: string): Promise<Record<string, unknown>> {
    if (role !== 'admin') throw new ForbiddenException('Chỉ quản trị viên được xem báo cáo của người khác');
    const doc = await this.repo.findById(id);
    if (!doc) throw new NotFoundException('Không tìm thấy báo cáo sự cố');
    return toResponse(doc);
  }

  async updateStatus(id: string, role: string, status: IssueStatus, expectedVersion: number): Promise<Record<string, unknown>> {
    if (role !== 'admin') throw new ForbiddenException('Chỉ quản trị viên được đổi trạng thái báo cáo');
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Không tìm thấy báo cáo sự cố');
    try {
      assertAllowedIssueTransition(existing.status, status);
    } catch {
      throw new BadRequestException(`Chuyển trạng thái không hợp lệ: ${existing.status} -> ${status}`);
    }
    const updated = await this.repo.updateStatus(id, status, expectedVersion);
    if (!updated) {
      throw new ConflictException('Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)');
    }
    if (status === 'new') {
      await dispatchViaPorts(this.notifications, this.users, this.realtime, {
        userId: updated.userId,
        type: 'issue_needs_info',
        title: 'Báo cáo của bạn cần bổ sung thông tin',
        summary: `Báo cáo "${updated.title}" cần bổ sung thêm thông tin.`,
        targetId: updated.id,
        isMandatory: true,
      });
    } else if (status === 'resolved') {
      await dispatchViaPorts(this.notifications, this.users, this.realtime, {
        userId: updated.userId,
        type: 'issue_resolved',
        title: 'Báo cáo sự cố đã được xử lý',
        summary: `Báo cáo "${updated.title}" đã được xử lý.`,
        targetId: updated.id,
        isMandatory: false,
      });
    }
    return toResponse(updated);
  }

  private assertAttachmentAccess(doc: IssueReportRecord, userId: string, role: string): void {
    if (role === 'admin') return;
    if (doc.userId !== userId) {
      throw new NotFoundException('Không tìm thấy tệp đính kèm');
    }
  }

  async uploadAttachment(userId: string, role: string, issueId: string, file: { filename: string; mimeType: string; size: number; stream: Readable }): Promise<Record<string, unknown>> {
    const doc = await this.repo.findById(issueId);
    if (!doc) throw new NotFoundException('Không tìm thấy báo cáo sự cố');
    this.assertAttachmentAccess(doc, userId, role);
    const allowed: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' };
    const ext = allowed[file.mimeType];
    if (!ext) {
      const err = new BadRequestException({
        message: `Định dạng tệp không được hỗ trợ: ${file.mimeType}. Chỉ chấp nhận png/jpg/pdf.`,
        error: 'UNSUPPORTED_MEDIA_TYPE',
      } as never);
      throw err;
    }
    if (file.size > 10 * 1024 * 1024) {
      const err = new BadRequestException({
        message: 'Tệp đính kèm vượt quá 10MB',
        error: 'ATTACHMENT_TOO_LARGE',
      } as never);
      throw err;
    }
    if ((doc.attachments ?? []).length >= 3) {
      throw new BadRequestException('Mỗi báo cáo chỉ được đính kèm tối đa 3 tệp');
    }
    if (!this.storage) throw new BadRequestException('Storage chưa sẵn sàng');
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
    if (!updated) throw new NotFoundException('Không tìm thấy báo cáo sự cố');
    return toResponse(updated);
  }

  async downloadAttachment(userId: string, role: string, issueId: string, attachmentId: string): Promise<{ stream: Readable; filename: string; contentType: string; sizeBytes: number; workspaceId: string | null }> {
    const doc = isObjectIdHex(issueId)
      ? role === 'admin'
        ? await this.repo.findById(issueId)
        : await this.repo.findByIdForUser(issueId, userId)
      : null;
    if (!doc) throw new NotFoundException('Không tìm thấy tệp đính kèm');
    const att = (doc.attachments ?? []).find((a) => String((a as Record<string, unknown>).id) === String(attachmentId)) as unknown as Record<string, unknown> | undefined;
    if (!att) throw new NotFoundException('Không tìm thấy tệp đính kèm');
    const storageKey = String((att as Record<string, unknown>).storageKey ?? '');
    if (!storageKey || !this.storage) throw new NotFoundException('Không tìm thấy tệp đính kèm');
    const stream = await this.storage.downloadStream(storageKey);
    return {
      stream,
      filename: String((att as Record<string, unknown>).filename ?? 'attachment'),
      contentType: String((att as Record<string, unknown>).contentType ?? 'application/octet-stream'),
      sizeBytes: Number((att as Record<string, unknown>).sizeBytes ?? 0),
      workspaceId: doc.workspaceId,
    };
  }

}

