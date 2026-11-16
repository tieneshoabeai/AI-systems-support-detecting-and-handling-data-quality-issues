/**
 * UpdateStatusHandler — Use case: `updateStatus()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  ISSUE_REPORT_REPOSITORY_PORT,
  type IssueReportRepositoryPort,
} from '../../domain/ports/issue-report.repository.port';
import {
  assertAllowedIssueTransition,
  type IssueStatus,
} from '../../domain/value-objects/issue-status.vo';
import {
  NOTIFICATION_REPOSITORY_PORT,
  type NotificationRepositoryPort,
} from '../../../notifications';
import { REALTIME_PORT, type RealtimePort } from '../../../realtime';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { dispatchViaPorts, toResponse } from '../issues.utils';

@Injectable()
export class UpdateStatusHandler {
  constructor(
    @Inject(ISSUE_REPORT_REPOSITORY_PORT)
    private readonly repo: IssueReportRepositoryPort,
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly notifications: NotificationRepositoryPort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Optional()
    @Inject(REALTIME_PORT)
    private readonly realtime: RealtimePort,
  ) {}

  async execute(
    id: string,
    role: string,
    status: IssueStatus,
    expectedVersion: number,
  ): Promise<Record<string, unknown>> {
    if (role !== 'admin')
      throw new ForbiddenException('Chỉ quản trị viên được đổi trạng thái báo cáo');
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Không tìm thấy báo cáo sự cố');
    try {
      assertAllowedIssueTransition(existing.status, status);
    } catch {
      throw new BadRequestException(
        `Chuyển trạng thái không hợp lệ: ${existing.status} -> ${status}`,
      );
    }
    const updated = await this.repo.updateStatus(id, status, expectedVersion);
    if (!updated) {
      throw new ConflictException(
        'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
      );
    }
    // `needs_info` = admin yêu cầu user bổ sung thông tin (luồng mới).
    // `new` giữ lại để tương thích ngược với luồng cũ (in_progress → new).
    if (status === 'needs_info' || status === 'new') {
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
