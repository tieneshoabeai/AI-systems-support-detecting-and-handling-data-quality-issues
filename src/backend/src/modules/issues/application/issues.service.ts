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
    attachments: doc.attachments,
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
}
