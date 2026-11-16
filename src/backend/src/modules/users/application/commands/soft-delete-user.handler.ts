/**
 * SoftDeleteUserHandler — Use case: `softDeleteUser()`
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
export class SoftDeleteUserHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(userId: string): Promise<boolean> {
    const ok = await this.users.softDeleteUser(userId);
    if (!ok) {
      throw new NotFoundException('Không tìm thấy tài khoản hoặc tài khoản đã bị xóa');
    }
    return true;
  }
}
