/**
 * GetDetailHandler — Use case: `getDetail()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  NOTIFICATION_REPOSITORY_PORT,
  type NotificationRepositoryPort,
} from '../../domain/ports/notification.repository.port';
import { toResponse } from '../notifications.utils';

@Injectable()
export class GetDetailHandler {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly repo: NotificationRepositoryPort,
  ) {}

  async execute(userId: string, id: string): Promise<Record<string, unknown>> {
    const doc = await this.repo.findByIdForUser(id, userId);
    if (!doc) throw new NotFoundException('Không tìm thấy thông báo');
    if (!doc.readAt) {
      const updated = await this.repo.markAsRead(id, userId);
      return toResponse(updated ?? doc);
    }
    return toResponse(doc);
  }
}
