/**
 * MarkAsReadHandler — Use case: `markAsRead()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** gọi `notification.markAsRead()` để entity
 * tự bảo vệ (đánh dấu đã đọc 2 lần → `ConflictError`).
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_REPOSITORY_PORT,
  type NotificationRepositoryPort,
} from '../../domain/ports/notification.repository.port';
import { toResponse } from '../notifications.utils';
import { NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class MarkAsReadHandler {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly repo: NotificationRepositoryPort,
  ) {}

  async execute(userId: string, id: string): Promise<Record<string, unknown>> {
    const existing = await this.repo.findByIdForUser(id, userId);
    if (!existing) throw new NotFoundError('Không tìm thấy thông báo');
    // Idempotent: đánh dấu đã đọc 2 lần vẫn trả về cùng kết quả (PATCH).
    // Entity vẫn bảo vệ invariant "đọc 1 lần" — handler chỉ gọi khi chưa đọc.
    if (existing.isRead()) {
      return toResponse(existing);
    }
    existing.markAsRead();
    const updated = await this.repo.markAsRead(id, userId);
    if (!updated) throw new NotFoundError('Không tìm thấy thông báo');
    return toResponse(updated);
  }
}
