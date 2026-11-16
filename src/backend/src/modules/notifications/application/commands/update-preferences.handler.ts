/**
 * UpdatePreferencesHandler — Use case: `updatePreferences()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';

@Injectable()
export class UpdatePreferencesHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(userId: string, enabled: boolean): Promise<{ notificationsEnabled: boolean }> {
    const ok = await this.users.updateNotificationPreferences(userId, enabled);
    if (!ok) throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    return { notificationsEnabled: enabled };
  }
}
