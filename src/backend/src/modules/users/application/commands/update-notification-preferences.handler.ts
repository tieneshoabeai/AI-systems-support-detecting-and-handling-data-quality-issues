/**
 * UpdateNotificationPreferencesHandler — Use case: `updateNotificationPreferences()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** gọi `user.setNotificationsEnabled()`.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port';
import { NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class UpdateNotificationPreferencesHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(userId: string, enabled: boolean): Promise<boolean> {
    const current = await this.users.findById(userId);
    if (!current) {
      throw new NotFoundError('Không tìm thấy tài khoản người dùng');
    }
    current.setNotificationsEnabled(enabled);
    const ok = await this.users.updateNotificationPreferences(userId, enabled);
    if (!ok) {
      throw new NotFoundError('Không tìm thấy tài khoản người dùng');
    }
    return enabled;
  }
}
