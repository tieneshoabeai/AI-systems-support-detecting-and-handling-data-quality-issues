/**
 * UpdateNotificationPreferencesHandler — Use case: `updateNotificationPreferences()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port';

@Injectable()
export class UpdateNotificationPreferencesHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(userId: string, enabled: boolean): Promise<boolean> {
    const ok = await this.users.updateNotificationPreferences(userId, enabled);
    if (!ok) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }
    return enabled;
  }
}
