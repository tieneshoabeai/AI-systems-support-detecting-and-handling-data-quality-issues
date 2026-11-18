/**
 * CountUnreadHandler — Use case: `countUnread()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_REPOSITORY_PORT,
  type NotificationRepositoryPort,
} from '../../domain/ports/notification.repository.port';

@Injectable()
export class CountUnreadHandler {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly repo: NotificationRepositoryPort,
  ) {}

  async execute(userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await this.repo.countUnread(userId);
    return { unreadCount };
  }
}
