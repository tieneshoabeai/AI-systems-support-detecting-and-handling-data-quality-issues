/**
 * SoftDeleteUserHandler — Use case: `softDeleteUser()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** gọi `user.softDelete()` để entity tự bảo vệ
 * (xoá 2 lần → `ConflictError`; xoá mềm đồng thời chặn đăng nhập).
 * Việc **thu hồi toàn bộ phiên** vẫn ở repository (thao tác hàng loạt trên
 * collection `user_sessions` — không thuộc aggregate `User`).
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port';
import { NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class SoftDeleteUserHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(userId: string): Promise<boolean> {
    const current = await this.users.findById(userId);
    if (!current) {
      throw new NotFoundError('Không tìm thấy tài khoản hoặc tài khoản đã bị xóa');
    }
    current.softDelete();
    const ok = await this.users.softDeleteUser(userId);
    if (!ok) {
      throw new NotFoundError('Không tìm thấy tài khoản hoặc tài khoản đã bị xóa');
    }
    return true;
  }
}
